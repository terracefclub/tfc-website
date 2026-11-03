import { afterEach, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, truncateSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { mediaDirectory } from '../src/media-directory'
import { copyReferencedMedia } from '../tools/copy-media'

const fixtures: string[] = []
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'terrace-media-copy-'))
  fixtures.push(root)
  const source = join(root, 'legacy'), destination = join(root, 'private')
  mkdirSync(source, { mode: 0o700 })
  return { root, source, destination }
}
afterEach(() => { for (const dir of fixtures.splice(0)) rmSync(dir, { recursive: true, force: true }) })

test('uploads default to the component state directory and require absolute overrides', () => {
  expect(mediaDirectory({})).toBe(resolve('.state/media'))
  expect(mediaDirectory({ CMS_MEDIA_DIR: '/var/lib/terrace/media' })).toBe('/var/lib/terrace/media')
  for (const value of ['', '../shared', '/bad\0directory']) expect(() => mediaDirectory({ CMS_MEDIA_DIR: value })).toThrow()
})

test('copies only referenced bytes, retains originals, sets private permissions and safely repeats', () => {
  const f = fixture()
  writeFileSync(join(f.source, 'poster.png'), 'synthetic-media')
  writeFileSync(join(f.source, 'other-club.pdf'), 'outside-this-database')
  expect(copyReferencedMedia(f.source, f.destination, ['poster.png'])).toEqual({ referenced: 1, copied: 1, reused: 0 })
  expect(readFileSync(join(f.source, 'poster.png'), 'utf8')).toBe('synthetic-media')
  expect(readFileSync(join(f.destination, 'poster.png'), 'utf8')).toBe('synthetic-media')
  expect(existsSync(join(f.destination, 'other-club.pdf'))).toBe(false)
  expect(lstatSync(f.destination).mode & 0o777).toBe(0o700)
  expect(lstatSync(join(f.destination, 'poster.png')).mode & 0o777).toBe(0o600)
  expect(copyReferencedMedia(f.source, f.destination, ['poster.png'])).toEqual({ referenced: 1, copied: 0, reused: 1 })
  expect(readdirSync(f.destination)).toEqual(['poster.png'])
})

test('conflicting destination bytes and symlinks are never overwritten or followed', () => {
  const f = fixture()
  mkdirSync(f.destination, { mode: 0o700 })
  writeFileSync(join(f.source, 'poster.png'), 'source')
  writeFileSync(join(f.destination, 'poster.png'), 'keep-existing')
  expect(() => copyReferencedMedia(f.source, f.destination, ['poster.png'])).toThrow()
  expect(readFileSync(join(f.destination, 'poster.png'), 'utf8')).toBe('keep-existing')
  expect(readFileSync(join(f.source, 'poster.png'), 'utf8')).toBe('source')
  symlinkSync(join(f.source, 'poster.png'), join(f.source, 'linked.png'))
  expect(() => copyReferencedMedia(f.source, f.destination, ['linked.png'])).toThrow()
  symlinkSync(join(f.source, 'poster.png'), join(f.destination, 'linked.png'))
  writeFileSync(join(f.source, 'linked-target.png'), 'new')
  symlinkSync(join(f.source, 'poster.png'), join(f.destination, 'linked-target.png'))
  expect(() => copyReferencedMedia(f.source, f.destination, ['linked-target.png'])).toThrow()
  expect(readFileSync(join(f.source, 'poster.png'), 'utf8')).toBe('source')
  expect(readdirSync(f.destination).some(name => name.startsWith('.media-copy-'))).toBe(false)
})

test('invalid references and nonprivate destinations fail before copying', () => {
  const f = fixture()
  for (const names of [['../escape'], ['/absolute'], ['back\\slash'], ['.'], ['..'], ['same', 'same']]) {
    expect(() => copyReferencedMedia(f.source, f.destination, names)).toThrow()
  }
  expect(existsSync(f.destination)).toBe(false)
  mkdirSync(f.destination, { mode: 0o700 })
  chmodSync(f.destination, 0o755)
  expect(() => copyReferencedMedia(f.source, f.destination, [])).toThrow()
  expect(() => copyReferencedMedia(f.source, f.source, [])).toThrow()
})

test('partial migration keeps completed copies and can resume after a missing file is restored', () => {
  const f = fixture()
  writeFileSync(join(f.source, 'first.pdf'), 'one')
  expect(() => copyReferencedMedia(f.source, f.destination, ['first.pdf', 'missing.pdf'])).toThrow()
  expect(readFileSync(join(f.destination, 'first.pdf'), 'utf8')).toBe('one')
  writeFileSync(join(f.source, 'missing.pdf'), 'two')
  expect(copyReferencedMedia(f.source, f.destination, ['first.pdf', 'missing.pdf'])).toEqual({ referenced: 2, copied: 1, reused: 1 })
})

test('oversized sparse files are refused without copying or changing originals', () => {
  const f = fixture()
  const path = join(f.source, 'large.pdf')
  writeFileSync(path, '')
  truncateSync(path, 128 * 1024 * 1024 + 1)
  expect(() => copyReferencedMedia(f.source, f.destination, ['large.pdf'])).toThrow()
  expect(lstatSync(path).size).toBe(128 * 1024 * 1024 + 1)
  expect(existsSync(join(f.destination, 'large.pdf'))).toBe(false)
})

test('source and destination FIFOs are rejected without waiting for a writer', () => {
  const f = fixture()
  const name = 'synthetic.png'
  const run = () => spawnSync(process.execPath, ['-e', `import { copyReferencedMedia } from ${JSON.stringify(resolve('tools/copy-media.ts'))}; try { copyReferencedMedia(${JSON.stringify(f.source)}, ${JSON.stringify(f.destination)}, [${JSON.stringify(name)}]); process.exit(2) } catch { process.exit(0) }`], { timeout: 2000 })
  expect(spawnSync('mkfifo', [join(f.source, name)]).status).toBe(0)
  expect(run().status).toBe(0)
  expect(existsSync(join(f.destination, name))).toBe(false)
  rmSync(join(f.source, name))
  writeFileSync(join(f.source, name), 'synthetic-bytes')
  expect(spawnSync('mkfifo', [join(f.destination, name)]).status).toBe(0)
  expect(run().status).toBe(0)
  expect(lstatSync(join(f.destination, name)).isFIFO()).toBe(true)
  expect(readFileSync(join(f.source, name), 'utf8')).toBe('synthetic-bytes')
})
