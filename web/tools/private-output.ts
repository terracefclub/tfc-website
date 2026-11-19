import { constants, closeSync, existsSync, fstatSync, lstatSync, openSync, readSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join } from 'node:path';

// Require an existing owner-only directory outside every Git checkout. Exclusive
// creation refuses old files and final symlinks; diagnostics never quote paths.
// Shared by the WXR preflight plan and the WordPress import reports/plans.
//
// A directory inside a Git checkout is refused even when Git ignores it (for example `.state/`): ignored files are one
// `git add -f`, backup or sync away from leaving the machine. Use a private directory outside every checkout, for
// example `mkdir -m 700 ~/.terrace-private`. Refusals say why in fixed text and never quote a path.
export class OutputRefused extends Error {}
export const outputAdvice = 'Create an owner-only directory outside every Git checkout (for example: mkdir -m 700 ~/.terrace-private) and give an absolute new .json path inside it.';
/** Shared by output and input: an absolute path whose directory is yours, owner-only and outside every Git checkout. Returns the resolved directory. */
function privateDirectory(path: string, suffix: string, fail: (reason?: string) => never): string {
  if (!isAbsolute(path) || !path.endsWith(suffix)) fail(`it must be an absolute path ending in ${suffix}`);
  let parent: string;
  try { parent = realpathSync(dirname(path)); } catch { return fail('its directory does not exist'); }
  const directory = lstatSync(parent), uid = process.getuid?.();
  if (uid === undefined || !directory.isDirectory() || directory.uid !== uid) fail('its directory is not yours');
  if ((directory.mode & 0o077) !== 0) fail('its directory is not owner-only (mode 0700)');
  for (let ancestor = parent; ; ancestor = dirname(ancestor)) {
    if (existsSync(join(ancestor, '.git'))) fail('its directory is inside a Git checkout, including a git-ignored one');
    if (dirname(ancestor) === ancestor) break;
  }
  return parent;
}

export function writePrivateJson(output: string, contents: string) {
  const fail = (reason = 'the output path is not usable'): never => { throw new OutputRefused(`Unsupported output: ${reason}. ${outputAdvice}`); };
  const parent = privateDirectory(output, '.json', fail), uid = process.getuid?.();
  let fd: number;
  try { fd = openSync(join(parent, basename(output)), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); } catch { return fail('the file already exists or cannot be created'); }
  try {
    const file = fstatSync(fd);
    if (!file.isFile() || file.uid !== uid || (file.mode & 0o777) !== 0o600) fail();
    writeFileSync(fd, contents);
  } finally { closeSync(fd); }
}

export const inputAdvice = 'Keep the file in an owner-only directory outside every Git checkout (for example: mkdir -m 700 ~/.terrace-private), owned by you with mode 0600, and give its absolute path.';
/**
 * Read a personal-data input file under the same rules as the private outputs: an absolute path in an owner-only directory outside every
 * Git checkout, a regular file (never a symlink) that you own with no group or other access, of bounded size. Fixed refusals; paths are never quoted.
 */
export function readPrivateInput(input: string, suffix: string, maxBytes: number): Buffer {
  const fail = (reason = 'the input path is not usable'): never => { throw new OutputRefused(`Unsupported input: ${reason}. ${inputAdvice}`); };
  const parent = privateDirectory(input, suffix, fail), uid = process.getuid?.();
  let fd: number;
  try { fd = openSync(join(parent, basename(input)), constants.O_RDONLY | constants.O_NOFOLLOW); } catch { return fail('the file does not exist or cannot be opened'); }
  try {
    const file = fstatSync(fd);
    if (!file.isFile() || file.uid !== uid) fail('it is not a regular file that you own');
    if ((file.mode & 0o077) !== 0) fail('the file is not owner-only (mode 0600)');
    if (file.size > maxBytes) fail('the file is too large');
    const buffer = Buffer.alloc(file.size);
    let offset = 0;
    while (offset < file.size) { const n = readSync(fd, buffer, offset, file.size - offset, offset); if (n === 0) break; offset += n; }
    return buffer.subarray(0, offset);
  } finally { closeSync(fd); }
}
