import { createHash, randomUUID } from 'node:crypto'
import { closeSync, constants, fstatSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

function digest(bytes: Buffer) { return createHash('sha256').update(bytes).digest('hex') }
function readFile(path: string) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  try {
    const stat = fstatSync(fd)
    if (!stat.isFile() || stat.size > 128 * 1024 * 1024) throw new Error('Unsupported media file.')
    return readFileSync(fd)
  } finally { closeSync(fd) }
}

export function copyReferencedMedia(source: string, destination: string, filenames: string[]) {
  source = resolve(source)
  destination = resolve(destination)
  if (source === destination) throw new Error('Choose a separate media destination.')
  if (filenames.some(name => !name || basename(name) !== name || name === '.' || name === '..' || /[\\\x00-\x1f]/.test(name)) || new Set(filenames).size !== filenames.length) {
    throw new Error('Invalid media references.')
  }
  mkdirSync(destination, { recursive: true, mode: 0o700 })
  const directory = lstatSync(destination)
  if (!directory.isDirectory() || directory.uid !== process.getuid?.() || (directory.mode & 0o077) !== 0) throw new Error('The destination must be a private, owned directory.')
  let copied = 0, reused = 0
  for (const name of filenames) {
    const original = join(source, name), target = join(destination, name)
    const bytes = readFile(original)
    const hash = digest(bytes)
    const temporary = join(destination, '.media-copy-' + randomUUID())
    let fd: number | undefined
    let created = false
    try {
      fd = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
      created = true
      writeFileSync(fd, bytes)
      closeSync(fd)
      fd = undefined
      if (digest(readFile(original)) !== hash || digest(readFile(temporary)) !== hash) throw new Error('Media changed during copying.')
      try { linkSync(temporary, target); copied++ }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || digest(readFile(target)) !== hash) throw new Error('Destination media conflicts with the original.')
        reused++
      }
    } finally {
      if (fd !== undefined) closeSync(fd)
      if (created) unlinkSync(temporary)
    }
  }
  return { referenced: filenames.length, copied, reused }
}
