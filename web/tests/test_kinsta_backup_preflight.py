import hashlib
import json
from pathlib import Path
import stat
import struct
import subprocess
import sys
import tempfile
import unittest
import zipfile


TOOL = Path(__file__).resolve().parents[1] / "tools" / "kinsta-backup-preflight.py"
SQL = b"synthetic-private-sql"


class KinstaBackupPreflightTest(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.path = self.root / "private-backup.zip"

    def archive(self, *, prefix="", upload=True, sql=SQL, extras=(), compression=zipfile.ZIP_STORED):
        with zipfile.ZipFile(self.path, "w", compression=compression) as archive:
            if sql is not None:
                archive.writestr(prefix + "private-site.sql", sql)
            archive.writestr(prefix + "public/wp-load.php", b"<?php /* never executed */")
            if upload:
                archive.writestr(prefix + "public/wp-content/uploads/private-member.jpg", b"synthetic")
            for entry, content in extras:
                archive.writestr(entry, content)
        self.path.chmod(0o600)

    def run_tool(self, path=None):
        return subprocess.run([sys.executable, "-B", TOOL, path or self.path],
                              capture_output=True, text=True, timeout=10)

    def assert_rejected(self, error, path=None):
        result = self.run_tool(path)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, "")
        self.assertEqual(result.stderr, error + "\n")

    def test_inventory_has_only_counts_and_exact_archive_hash(self):
        self.archive()
        before = self.path.read_bytes()
        result = self.run_tool()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stderr, "")
        self.assertEqual(json.loads(result.stdout), {
            "archiveBytes": len(before),
            "expandedBytes": len(SQL) + len(b"<?php /* never executed */synthetic"),
            "sha256": hashlib.sha256(before).hexdigest(),
            "siteFiles": 2,
            "sqlBytes": len(SQL),
            "uploadFiles": 1,
            "zipEntries": 3,
        })
        self.assertEqual(self.path.read_bytes(), before)
        self.assertEqual(list(self.root.iterdir()), [self.path])

    def test_wrapper_layout_and_zero_uploads(self):
        self.archive(prefix="private-wrapper/", upload=False, compression=zipfile.ZIP_DEFLATED)
        result = self.run_tool()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["uploadFiles"], 0)

    def test_missing_empty_and_ambiguous_sql(self):
        expected = "ZIP must contain one nonempty SQL file beside the public directory."
        for sql, extras in [(None, ()), (b"", ()), (SQL, (("other.sql", b"second"),))]:
            with self.subTest(sql_present=bool(sql), extra=bool(extras)):
                self.archive(sql=sql, extras=extras)
                self.assert_rejected(expected)

    def test_rejects_path_escape_and_symlink_member(self):
        link = zipfile.ZipInfo("public/private-link")
        link.create_system = 3
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        for entry in ("public/../private-path", "/private-path", "public\\private-path", link):
            with self.subTest(entry_type=type(entry)):
                self.archive(extras=((entry, b"private-target"),))
                self.assert_rejected("ZIP contains an unsupported entry.")

    def test_rejects_file_used_as_directory(self):
        self.archive(extras=(("public/private", b"file"), ("public/private/nested", b"nested")))
        self.assert_rejected("ZIP contains conflicting file and directory paths.")

    def test_member_crc_failure_is_private(self):
        self.archive()
        self.path.write_bytes(self.path.read_bytes().replace(SQL, b"x" * len(SQL), 1))
        self.assert_rejected("ZIP could not be read or failed its integrity check.")

    def test_member_size_mismatch_rejected_even_if_crc_matches(self):
        self.archive()
        data = bytearray(self.path.read_bytes())
        central_header = data.index(b"PK\x01\x02")
        struct.pack_into("<I", data, central_header + 24, len(SQL) + 1)
        self.path.write_bytes(data)
        self.assert_rejected("ZIP member size did not match its directory entry.")

    def test_requires_protected_file_and_rejects_final_symlink(self):
        self.archive()
        self.path.chmod(0o644)
        self.assert_rejected("The ZIP must be a private regular file owned by the current user.")
        self.path.chmod(0o600)
        alias = self.root / "alias.zip"
        alias.symlink_to(self.path)
        self.assert_rejected("ZIP could not be read or failed its integrity check.", alias)

    def test_rejects_checkout_and_public_directory(self):
        self.archive()
        marker = self.root / ".git"
        marker.touch()
        self.assert_rejected("Use an absolute ZIP path in a private directory outside Git.")
        marker.unlink()
        self.root.chmod(0o755)
        self.assert_rejected("The ZIP directory must be private and owned by the current user.")


if __name__ == "__main__":
    unittest.main()
