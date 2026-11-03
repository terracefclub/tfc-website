import { createHash } from 'node:crypto'
import { constants, closeSync, chmodSync, copyFileSync, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import pins from './runtime.json'

export type Component = 'web' | 'cms'
export type Runtime = { node: string; bun: string; platform: string; arch: string; libc: string; nodeAbi: string }
export class ReleaseRejected extends Error {
  constructor(readonly reason: 'input' | 'private path' | 'external link' | 'link cycle' | 'runtime input bytes' | 'special file' = 'input') { super('Release input rejected.') }
}
export function fail(reason?: ConstructorParameters<typeof ReleaseRejected>[0]): never { throw new ReleaseRejected(reason) }
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

function forbidden(name: string) {
  return name.split('/').some(part => ['.git', '.state', '.direnv', '.devenv', '.svelte-kit'].includes(part) ||
    part.startsWith('.env') || ['credentials.json', 'app.env', 'local.env'].includes(part) || part.endsWith('.log'))
}

export function validateRuntime(runtime: Runtime) {
  for (const key of ['node', 'bun', 'platform', 'arch', 'libc'] as const) if (runtime[key] !== pins[key]) fail()
  if (!/^\d+$/.test(runtime.nodeAbi)) fail()
}

// Copy only an explicit build output or production-dependency tree. Never walk a checkout root.
export function copyTree(source: string, destination: string, forbiddenValues: readonly string[] = []) {
  const root = realpathSync(source)
  const ancestors = new Set<string>()
  function copy(from: string, to: string) {
    const name = relative(root, from).split(sep).join('/')
    if (forbidden(name)) fail('private path')
    const entry = lstatSync(from)
    if (entry.isSymbolicLink()) {
      const target = realpathSync(from)
      if (target !== root && !target.startsWith(root + sep)) fail('external link')
      // Materialize internal links so moving the release cannot reach the source checkout.
      if (ancestors.has(target)) fail('link cycle')
      copy(target, to)
    } else if (entry.isDirectory()) {
      if (ancestors.has(from)) fail('link cycle')
      ancestors.add(from)
      mkdirSync(to, { recursive: true, mode: 0o755 })
      for (const child of readdirSync(from).sort()) {
        if (child === '.bin' && (!name || name.endsWith('node_modules'))) continue
        if (name === '.next' && child === 'cache') continue
        copy(join(from, child), join(to, child))
      }
      ancestors.delete(from)
    } else if (entry.isFile()) {
      const bytes = readFileSync(from)
      if (forbiddenValues.some(value => value.length >= 8 && bytes.includes(Buffer.from(value)))) fail('runtime input bytes')
      mkdirSync(dirname(to), { recursive: true, mode: 0o755 })
      copyFileSync(from, to)
      chmodSync(to, entry.mode & 0o111 ? 0o755 : 0o644)
    } else fail('special file')
  }
  copy(root, destination)
}

export function fileManifest(root: string): Record<string, string> {
  const files: Record<string, string> = {}
  function visit(path: string) {
    for (const name of readdirSync(path).sort()) {
      const full = join(path, name)
      const entry = lstatSync(full)
      if (entry.isDirectory()) visit(full)
      else if (entry.isFile()) files[relative(root, full).split(sep).join('/')] = digest(readFileSync(full))
      else fail()
    }
  }
  visit(root)
  return files
}

function launcher(component: Component, migration = false) {
  const entry = component === 'web' ? 'build/index.js' : migration ? 'migrate.mjs' : 'server.js'
  return `#!/usr/bin/env bash
set -euo pipefail
release_root="$(cd -- "\${BASH_SOURCE[0]%/*}/.." && pwd -P)"
if [[ "$(node --version)" != "v${pins.node}" ]]; then echo 'Release requires Node ${pins.node}.' >&2; exit 1; fi
export NODE_ENV=production
export NEXT_TELEMETRY_DISABLED=1
${component === 'cms' ? `if [[ -z "\${CMS_MEDIA_DIR:-}" || "\${CMS_MEDIA_DIR:0:1}" != / || "$CMS_MEDIA_DIR" == "$release_root" || "$CMS_MEDIA_DIR" == "$release_root/"* ]]; then echo 'Release requires external absolute CMS_MEDIA_DIR.' >&2; exit 1; fi
if ! node -e 'try { const f=require("node:fs"),p=require("node:path"),r=f.realpathSync(process.argv[1]),d=f.realpathSync(process.env.CMS_MEDIA_DIR); if(!f.statSync(d).isDirectory()||d===r||d.startsWith(r+p.sep))process.exit(1); f.accessSync(d,f.constants.W_OK); } catch { process.exit(1); }' "$release_root" 2>/dev/null; then echo 'Release requires writable uploads outside its code directory.' >&2; exit 1; fi` : ''}
${migration ? '' : `if [[ ! "\${PORT:-}" =~ ^[0-9]{1,5}$ ]] || (( 10#$PORT < 1024 || 10#$PORT > 65535 )); then echo 'Release requires an explicit PORT from 1024 to 65535.' >&2; exit 1; fi
export ${component === 'web' ? 'HOST' : 'HOSTNAME'}=127.0.0.1`}
${component === 'web' ? `if ! node -e 'try { const v=process.env.ORIGIN,u=new URL(v); if(u.origin!==v||u.username||u.password||(u.protocol!=="https:"&&!(u.protocol==="http:"&&u.hostname==="127.0.0.1"))||(process.env.MEMBER_AUTH_ORIGIN&&process.env.MEMBER_AUTH_ORIGIN!==v))process.exit(1); } catch { process.exit(1); }' 2>/dev/null; then echo 'Release requires exact ORIGIN matching MEMBER_AUTH_ORIGIN when configured.' >&2; exit 1; fi` : ''}
cd -- "$release_root"
exec node "$release_root/${entry}"
`
}

export function stageRelease(options: {
  component: Component; input: string; destination: string; revision: string; epoch: number;
  runtime: Runtime; dependencies?: string; staticAssets?: string; publicAssets?: string; forbiddenValues?: readonly string[];
}) {
  const { component, input, destination, revision, epoch, runtime } = options
  if (!['web', 'cms'].includes(component)) fail()
  validateRuntime(runtime)
  if (!/^[a-f0-9]{40}$/.test(revision) || !Number.isSafeInteger(epoch) || epoch < 0 || existsSync(destination)) fail()
  if (isAbsolute(relative(resolve(input), resolve(destination))) || resolve(destination).startsWith(resolve(input) + sep)) fail()
  if (component === 'web') {
    if (!options.dependencies || !existsSync(join(input, 'index.js'))) fail()
    mkdirSync(destination, { recursive: true, mode: 0o755 })
    copyTree(input, join(destination, 'build'), options.forbiddenValues)
    copyTree(options.dependencies, join(destination, 'node_modules'), options.forbiddenValues)
    writeFileSync(join(destination, 'package.json'), '{"type":"module"}\n')
  } else {
    if (!existsSync(join(input, 'server.js')) || !existsSync(join(input, 'migrate.mjs')) || !options.staticAssets) fail()
    copyTree(input, destination, options.forbiddenValues)
    copyTree(options.staticAssets, join(destination, '.next/static'), options.forbiddenValues)
    if (options.publicAssets && existsSync(options.publicAssets)) copyTree(options.publicAssets, join(destination, 'public'), options.forbiddenValues)
    mkdirSync(join(destination, '.next/cache'), { recursive: true, mode: 0o755 })
  }
  mkdirSync(join(destination, 'bin'), { recursive: true })
  writeFileSync(join(destination, 'bin/start'), launcher(component), { mode: 0o755 })
  if (component === 'cms') writeFileSync(join(destination, 'bin/migrate'), launcher(component, true), { mode: 0o755 })
  const manifest = {
    schemaVersion: 1, component, revision, sourceEpoch: epoch, runtime,
    entrypoints: component === 'cms' ? { start: 'bin/start', migrate: 'bin/migrate' } : { start: 'bin/start' },
    writablePaths: component === 'cms' ? { cacheMount: '.next/cache', uploadsEnvironment: 'CMS_MEDIA_DIR' } : {},
    files: fileManifest(destination),
  }
  writeFileSync(join(destination, 'release.json'), JSON.stringify(manifest, null, 2) + '\n')
  return manifest
}

export function openChecksumIndex(path: string): number {
  let fd: number | undefined
  try {
    fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_APPEND | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600)
    const file = fstatSync(fd)
    if (!file.isFile() || file.uid !== process.getuid?.() || (file.mode & 0o077) !== 0) fail()
    return fd
  } catch { if (fd !== undefined) closeSync(fd); return fail() }
}
