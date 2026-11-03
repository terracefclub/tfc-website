import { expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { copyTree, fileManifest, stageRelease, validateRuntime, type Runtime } from '../../tools/release/package'

const runtime: Runtime = { node: '24.21.0', bun: '1.4.4', platform: 'linux', arch: 'x64', libc: 'glibc', nodeAbi: '137' }
const revision = 'a'.repeat(40)
function tree() { return mkdtempSync(join(tmpdir(), 'terrace-release-test-')) }
function file(root: string, name: string, body = 'synthetic compiled code') {
  const parts = name.split('/'); parts.pop()
  mkdirSync(join(root, ...parts), { recursive: true })
  writeFileSync(join(root, name), body)
}

test('build rejects application dotenv files before creating a database or exposing their contents', () => {
  for (const component of ['web', 'cms']) {
    const root = tree()
    try {
      for (const name of ['build.ts', 'child.ts', 'runtime.json']) file(root, `tools/release/${name}`, readFileSync(new URL(`../../tools/release/${name}`, import.meta.url), 'utf8'))
      for (const name of ['web', 'cms']) mkdirSync(join(root, name))
      file(root, `${component}/.env.production.local`, 'PRIVATE_DOTENV_MARKER')
      const result = spawnSync(process.execPath, [join(root, 'tools/release/build.ts'), join(root, 'output')], {
        env: { PATH: process.env.PATH, TERRACE_RELEASE_REVISION: revision, SOURCE_DATE_EPOCH: '123' }, encoding: 'utf8', timeout: 2000,
      })
      expect(result.status).toBe(1)
      expect(result.signal).toBeNull()
      expect(result.stdout).toBe('')
      expect(result.stderr).toContain('Release build failed during arguments;')
      expect(result.stderr).not.toContain('PRIVATE_DOTENV_MARKER')
      expect(existsSync(join(root, '.state'))).toBe(false)
      expect(existsSync(join(root, 'output'))).toBe(false)
    } finally { rmSync(root, { recursive: true, force: true }) }
  }
})

test('web release has executable startup, adapter assets and isolated production dependencies with hashes', () => {
  const root = tree()
  try {
    const build = join(root, 'build'), deps = join(root, 'deps'), output = join(root, 'web')
    file(build, 'index.js'); file(build, 'client/app.css'); file(deps, 'jose/package.json', '{}')
    const manifest = stageRelease({ component: 'web', input: build, dependencies: deps, destination: output, revision, epoch: 123, runtime })
    expect(manifest.entrypoints).toEqual({ start: 'bin/start' })
    expect(existsSync(join(output, 'build/client/app.css'))).toBe(true)
    expect(existsSync(join(output, 'node_modules/jose/package.json'))).toBe(true)
    expect(JSON.parse(readFileSync(join(output, 'package.json'), 'utf8')).type).toBe('module')
    expect(readFileSync(join(output, 'bin/start'), 'utf8')).toContain('exec node "$release_root/build/index.js"')
    expect(manifest.files['build/index.js']).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.parse(readFileSync(join(output, 'release.json'), 'utf8'))).toEqual(manifest)
    expect(() => stageRelease({ component: 'web', input: build, dependencies: deps, destination: output, revision, epoch: 123, runtime })).toThrow()
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('CMS release includes static assets/migrator and only an empty runtime cache mount point', () => {
  const root = tree()
  try {
    const input = join(root, 'standalone'), assets = join(root, 'static'), publicAssets = join(root, 'public'), output = join(root, 'cms')
    file(input, 'server.js'); file(input, 'migrate.mjs'); file(input, '.next/cache/SECRET_CACHE', 'private cache data')
    file(assets, 'chunks/admin.js'); file(publicAssets, 'favicon.ico')
    const manifest = stageRelease({ component: 'cms', input, staticAssets: assets, publicAssets, destination: output, revision, epoch: 123, runtime })
    expect(manifest.entrypoints).toEqual({ start: 'bin/start', migrate: 'bin/migrate' })
    expect(manifest.writablePaths).toEqual({ cacheMount: '.next/cache', uploadsEnvironment: 'CMS_MEDIA_DIR' })
    expect(existsSync(join(output, '.next/static/chunks/admin.js'))).toBe(true)
    expect(existsSync(join(output, 'public/favicon.ico'))).toBe(true)
    expect(existsSync(join(output, '.next/cache'))).toBe(true)
    expect(existsSync(join(output, '.next/cache/SECRET_CACHE'))).toBe(false)
    expect(readFileSync(join(output, 'bin/start'), 'utf8')).toContain('HOSTNAME=127.0.0.1')
    expect(readFileSync(join(output, 'bin/migrate'), 'utf8')).toContain('exec node "$release_root/migrate.mjs"')
    expect(readFileSync(join(output, 'bin/migrate'), 'utf8')).not.toContain('PORT from')
    expect(Object.keys(fileManifest(output))).not.toContain('.next/cache/SECRET_CACHE')
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('private state, environment files, runtime input bytes and links outside the selected tree fail closed', () => {
  const root = tree()
  try {
    for (const name of ['.state/media/private.pdf', '.env', '.env.production', 'app.env', 'local.env', 'credentials.json', 'server.log', 'nested/.git/config']) {
      const input = join(root, name.replaceAll('/', '-'))
      file(input, name, 'PRIVATE_FIXTURE_MARKER')
      expect(() => copyTree(input, join(root, 'out-' + name.replaceAll('/', '-')))).toThrow()
    }
    const input = join(root, 'input')
    file(input, 'server.js', 'PRIVATE_FIXTURE_MARKER')
    expect(() => copyTree(input, join(root, 'secret-output'), ['PRIVATE_FIXTURE_MARKER'])).toThrow('Release input rejected.')
    file(root, 'outside.js')
    symlinkSync(join(root, 'outside.js'), join(input, 'outside-link.js'))
    expect(() => copyTree(input, join(root, 'link-output'))).toThrow('Release input rejected.')
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('internal links are materialized, cycles rejected, and cross-platform/runtime pins are strict', () => {
  const root = tree()
  try {
    const input = join(root, 'input')
    file(input, 'a.js'); symlinkSync('a.js', join(input, 'b.js'))
    copyTree(input, join(root, 'output'))
    expect(readFileSync(join(root, 'output/b.js'), 'utf8')).toBe('synthetic compiled code')
    symlinkSync('.', join(input, 'cycle'))
    expect(() => copyTree(input, join(root, 'cycle-output'))).toThrow('Release input rejected.')
    for (const patch of [{ node: '22.0.0' }, { bun: '1.0.0' }, { platform: 'darwin' }, { arch: 'arm64' }, { libc: 'musl' }, { nodeAbi: 'bad' }]) {
      expect(() => validateRuntime({ ...runtime, ...patch })).toThrow('Release input rejected.')
    }
  } finally { rmSync(root, { recursive: true, force: true }) }
})


test('web startup requires exact explicit origin and matching member callbacks without disclosing rejected input', () => {
  const root = tree()
  try {
    const input = join(root, 'build'), dependencies = join(root, 'dependencies'), output = join(root, 'web')
    file(input, 'index.js', 'console.log(JSON.stringify({origin:process.env.ORIGIN,host:process.env.HOST,mode:process.env.NODE_ENV}))')
    mkdirSync(dependencies)
    stageRelease({ component: 'web', input, dependencies, destination: output, revision, epoch: 123, runtime })
    const start = (env: Record<string, string>) => spawnSync('bash', [join(output, 'bin/start')], { env: { PATH: process.env.PATH, PORT: '14294', ...env }, encoding: 'utf8' })
    for (const ORIGIN of ['http://127.0.0.1:14294', 'https://web.terrace.invalid']) {
      const result = start({ ORIGIN, MEMBER_AUTH_ORIGIN: ORIGIN })
      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout)).toEqual({ origin: ORIGIN, host: '127.0.0.1', mode: 'production' })
    }
    const rejected: Record<string, string>[] = [{}, { ORIGIN: 'https://web.terrace.invalid/' }, { ORIGIN: 'http://outside.invalid' },
      { ORIGIN: 'https://user:PRIVATE_ORIGIN_MARKER@web.terrace.invalid' },
      { ORIGIN: 'https://web.terrace.invalid', MEMBER_AUTH_ORIGIN: 'https://other.terrace.invalid' }]
    for (const env of rejected) {
      const result = start(env)
      expect(result.status).toBe(1)
      expect(result.stdout).toBe('')
      expect(result.stderr).toContain('requires exact ORIGIN')
      expect(result.stderr).not.toContain('PRIVATE_ORIGIN_MARKER')
    }
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('CMS launchers enforce runtime-only uploads, production mode, explicit bounded ports and loopback binding', () => {
  const root = tree()
  try {
    const input = join(root, 'standalone'), assets = join(root, 'static'), output = join(root, 'cms'), uploads = join(root, 'uploads')
    file(input, 'server.js', `console.log(JSON.stringify({mode:process.env.NODE_ENV,host:process.env.HOSTNAME,port:process.env.PORT}))`)
    file(input, 'migrate.mjs', 'process.exit(0)'); file(assets, 'admin.js')
    mkdirSync(uploads)
    stageRelease({ component: 'cms', input, staticAssets: assets, destination: output, revision, epoch: 123, runtime })
    const start = (extra: Record<string, string> = {}) => spawnSync('bash', [join(output, 'bin/start')], {
      env: { PATH: process.env.PATH, CMS_MEDIA_DIR: uploads, PORT: '3040', NODE_ENV: 'development', HOSTNAME: '0.0.0.0', ...extra }, encoding: 'utf8',
    })
    const valid = start()
    expect(valid.status).toBe(0)
    expect(JSON.parse(valid.stdout)).toEqual({ mode: 'production', host: '127.0.0.1', port: '3040' })
    for (const PORT of ['', '1023', '65536', '99999999999999999999999', 'not-a-port']) {
      const run = start({ PORT })
      expect(run.status).toBe(1)
      expect(run.stdout).toBe('')
      expect(run.stderr).toContain('explicit PORT')
    }
    const link = join(root, 'alias')
    symlinkSync(output, link)
    const refused = start({ CMS_MEDIA_DIR: link })
    expect(refused.status).toBe(1)
    expect(refused.stdout).toBe('')
    expect(refused.stderr).toContain('uploads outside')
  } finally { rmSync(root, { recursive: true, force: true }) }
})


test('an existing checksum FIFO fails without blocking or publishing an artifact', () => {
  const root = tree()
  try {
    const fifo = join(root, 'SHA256SUMS')
    expect(spawnSync('mkfifo', [fifo], { stdio: 'ignore' }).status).toBe(0)
    const module = new URL('../../tools/release/package.ts', import.meta.url).pathname
    const run = spawnSync(process.execPath, ['-e', `import {openChecksumIndex} from ${JSON.stringify(module)};try{openChecksumIndex(process.argv.at(-1));process.exit(2)}catch{process.exit(1)}`, fifo], {
      stdio: 'ignore', timeout: 2000,
    })
    expect(run.status).toBe(1)
    expect(run.signal).toBeNull()
  } finally { rmSync(root, { recursive: true, force: true }) }
})
