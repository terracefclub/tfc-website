import { constants, closeSync, existsSync, fstatSync, lstatSync, openSync, realpathSync, writeFileSync } from 'node:fs';
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
export function writePrivateJson(output: string, contents: string) {
  const fail = (reason = 'the output path is not usable'): never => { throw new OutputRefused(`Unsupported output: ${reason}. ${outputAdvice}`); };
  if (!isAbsolute(output) || !output.endsWith('.json')) fail('it must be an absolute path ending in .json');
  let parent: string;
  try { parent = realpathSync(dirname(output)); } catch { return fail('its directory does not exist'); }
  const directory = lstatSync(parent), uid = process.getuid?.();
  if (uid === undefined || !directory.isDirectory() || directory.uid !== uid) fail('its directory is not yours');
  if ((directory.mode & 0o077) !== 0) fail('its directory is not owner-only (mode 0700)');
  for (let ancestor = parent; ; ancestor = dirname(ancestor)) {
    if (existsSync(join(ancestor, '.git'))) fail('its directory is inside a Git checkout, including a git-ignored one');
    if (dirname(ancestor) === ancestor) break;
  }
  let fd: number;
  try { fd = openSync(join(parent, basename(output)), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); } catch { return fail('the file already exists or cannot be created'); }
  try {
    const file = fstatSync(fd);
    if (!file.isFile() || file.uid !== uid || (file.mode & 0o777) !== 0o600) fail();
    writeFileSync(fd, contents);
  } finally { closeSync(fd); }
}
