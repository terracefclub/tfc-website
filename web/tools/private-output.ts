import { constants, closeSync, existsSync, fstatSync, lstatSync, openSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join } from 'node:path';

// Require an existing owner-only directory outside every Git checkout. Exclusive
// creation refuses old files and final symlinks; diagnostics never quote paths.
// Shared by the WXR preflight plan and the WordPress import reports/plans.
export function writePrivateJson(output: string, contents: string) {
  const fail = (): never => { throw new Error('Unsupported output.'); };
  if (!isAbsolute(output) || !output.endsWith('.json')) fail();
  const parent = realpathSync(dirname(output)), directory = lstatSync(parent), uid = process.getuid?.();
  if (uid === undefined || !directory.isDirectory() || directory.uid !== uid || (directory.mode & 0o077) !== 0) fail();
  for (let ancestor = parent; ; ancestor = dirname(ancestor)) {
    if (existsSync(join(ancestor, '.git'))) fail();
    if (dirname(ancestor) === ancestor) break;
  }
  const fd = openSync(join(parent, basename(output)), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try {
    const file = fstatSync(fd);
    if (!file.isFile() || file.uid !== uid || (file.mode & 0o777) !== 0o600) fail();
    writeFileSync(fd, contents);
  } finally { closeSync(fd); }
}
