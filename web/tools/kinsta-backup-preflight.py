"""Inspect a protected Kinsta ZIP without extracting or executing its contents."""

import hashlib
import io
import json
import os
from pathlib import Path
import signal
import stat
import struct
import sys
import zipfile
import zlib


GIB = 1024**3
CHUNK = 1024**2
MAX_DIRECTORY = 8 * CHUNK
MAX_MEMBERS = 100_000
MAX_ARCHIVE = 64 * GIB
MAX_PAYLOAD = 128 * GIB
DEADLINE = 600


class Rejected(Exception):
    """A fixed reason safe to report without exposing archive data."""


class BoundedReader(io.BufferedReader):
    def read(self, size=-1):
        if size < 0:
            size = max(0, os.fstat(self.fileno()).st_size - self.tell())
        if size > MAX_DIRECTORY:
            raise Rejected("ZIP directory exceeds the supported limit.")
        return super().read(size)


def signature(info):
    return (info.st_dev, info.st_ino, info.st_uid, info.st_mode, info.st_size,
            info.st_mtime_ns, info.st_ctime_ns)


def entry_path(info):
    name = info.orig_filename
    parts = tuple(name.removesuffix("/").split("/"))
    kind = stat.S_IFMT(info.external_attr >> 16)
    if (
        len(name) > 4096 or len(parts) > 64
        or any(ord(c) < 32 or ord(c) == 127 for c in name)
        or "\\" in name or ":" in name
        or any(part in ("", ".", "..") for part in parts)
        or kind not in (0, stat.S_IFDIR if info.is_dir() else stat.S_IFREG)
        or info.flag_bits & 1
        or info.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED)
    ):
        raise Rejected("ZIP contains an unsupported entry.")
    return parts


def inspect_zip(source):
    with zipfile.ZipFile(source) as archive:
        members = archive.infolist()
        total = sum(entry.file_size for entry in members)
        if len(members) > MAX_MEMBERS or total > MAX_PAYLOAD:
            raise Rejected("ZIP payload exceeds the supported limit.")

        paths = {}
        for member in members:
            path = entry_path(member)
            if path in paths:
                raise Rejected("ZIP contains duplicate entry paths.")
            paths[path] = member

        files = {path: member for path, member in paths.items() if not member.is_dir()}
        if any(path[:n] in files for path in paths for n in range(1, len(path))):
            raise Rejected("ZIP contains conflicting file and directory paths.")

        roots = [path[:-2] for path, member in files.items()
                 if len(path) in (2, 3) and path[-2:] == ("public", "wp-load.php") and member.file_size]
        if len(roots) != 1:
            raise Rejected("ZIP must contain one recognizable WordPress public directory.")
        root = roots[0]
        dumps = [member for path, member in files.items()
                 if path[:-1] == root and path[-1].lower().endswith(".sql")]
        if len(dumps) != 1 or not dumps[0].file_size:
            raise Rejected("ZIP must contain one nonempty SQL file beside the public directory.")

        public = root + ("public",)
        uploads = public + ("wp-content", "uploads")
        # Reading to EOF checks the standard ZIP member CRC without writing or interpreting data.
        for member in members:
            expanded = 0
            with archive.open(member) as stream:
                while chunk := stream.read(CHUNK):
                    expanded += len(chunk)
            if expanded != member.file_size:
                raise Rejected("ZIP member size did not match its directory entry.")
        return {
            "zipEntries": len(members),
            "expandedBytes": total,
            "sqlBytes": dumps[0].file_size,
            "siteFiles": sum(path[:len(public)] == public for path in files),
            "uploadFiles": sum(path[:len(uploads)] == uploads and len(path) > len(uploads)
                               for path in files),
        }


def inspect(path):
    if not path.is_absolute():
        raise Rejected("Use an absolute ZIP path in a private directory outside Git.")
    parent = path.parent.resolve(strict=True)
    if any((p / ".git").exists() or ((p / "HEAD").is_file() and (p / "objects").is_dir())
           for p in (parent, *parent.parents)):
        raise Rejected("Use an absolute ZIP path in a private directory outside Git.")

    parent_fd = os.open(parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        directory = os.fstat(parent_fd)
        if directory.st_uid != os.geteuid() or directory.st_mode & 0o077:
            raise Rejected("The ZIP directory must be private and owned by the current user.")
        fd = os.open(path.name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent_fd)
        with BoundedReader(io.FileIO(fd, "rb")) as source:
            before = os.fstat(source.fileno())
            if not stat.S_ISREG(before.st_mode) or before.st_uid != os.geteuid() or before.st_mode & 0o077:
                raise Rejected("The ZIP must be a private regular file owned by the current user.")
            if not 0 < before.st_size <= MAX_ARCHIVE:
                raise Rejected("ZIP size is outside the supported limit.")

            result = inspect_zip(source)
            source.seek(0)
            digest = hashlib.sha256()
            while chunk := source.read(CHUNK):
                digest.update(chunk)
            current = os.stat(path.name, dir_fd=parent_fd, follow_symlinks=False)
            if signature(before) != signature(current) or signature(before) != signature(os.fstat(source.fileno())):
                raise Rejected("ZIP changed during inspection.")
            return {"archiveBytes": before.st_size, "sha256": digest.hexdigest(), **result}
    finally:
        os.close(parent_fd)


def expired(_signum, _frame):
    raise Rejected("ZIP inspection exceeded its time limit.")


def main(args):
    if len(args) != 1:
        print("Usage: kinsta-backup-preflight.py /absolute/private-backup.zip", file=sys.stderr)
        return 2
    signal.signal(signal.SIGALRM, expired)
    signal.alarm(DEADLINE)
    try:
        result = inspect(Path(args[0]))
    except Rejected as error:
        print(str(error), file=sys.stderr)
        return 1
    except (OSError, ValueError, EOFError, RuntimeError, OverflowError, struct.error, zipfile.BadZipFile, zlib.error):
        print("ZIP could not be read or failed its integrity check.", file=sys.stderr)
        return 1
    finally:
        signal.alarm(0)
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
