import { createHash } from 'node:crypto'
import { constants, closeSync, copyFileSync, existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { openChecksumIndex, ReleaseRejected, stageRelease, validateRuntime, type Component, type Runtime } from './package'
import pins from './runtime.json'

const root = fileURLToPath(new URL('../..', import.meta.url))
const secretNames = ['PAYLOAD_SECRET', 'DATABASE_URI', 'CMS_BOOTSTRAP_PASSWORD', 'CMS_AUTH_CLIENT_SECRET',
  'CMS_AUTH_INTROSPECTION_SECRET', 'MEMBER_AUTH_CLIENT_SECRET', 'MEMBER_AUTH_INTROSPECTION_SECRET']
let phase = 'arguments'
try {
  const [component, outputArg] = process.argv.slice(2)
  if (!['web', 'cms'].includes(component) || !outputArg || process.argv.length !== 4 || Bun.version !== pins.bun) throw new Error()
  const revision = process.env.CI_COMMIT_SHA || process.env.TERRACE_RELEASE_REVISION
  const epoch = Number(process.env.SOURCE_DATE_EPOCH ?? Date.parse(process.env.CI_COMMIT_TIMESTAMP || '') / 1000)
  if (!revision || !/^[a-f0-9]{40}$/.test(revision) || !Number.isSafeInteger(epoch) || epoch < 0) throw new Error()
  const output = resolve(outputArg)
  mkdirSync(output, { recursive: true, mode: 0o700 })
  const directory = lstatSync(output)
  if (!directory.isDirectory() || directory.uid !== process.getuid?.() || (directory.mode & 0o077) !== 0) throw new Error()
  const work = mkdtempSync(join(output, '.pack-'))
  const log = openSync(join(work, 'pack.log'), 'w', 0o600)
  let complete = false
  try {
    const command = (executable: string, args: string[], cwd = root, env: NodeJS.ProcessEnv = process.env) => {
      const run = spawnSync(executable, args, { cwd, env, stdio: ['ignore', log, log], timeout: 180000 })
      if (run.status !== 0) throw new Error()
    }
    phase = 'runtime pins'
    const inspected = spawnSync('node', ['-e', `console.log(JSON.stringify({node:process.versions.node,nodeAbi:process.versions.modules,platform:process.platform,arch:process.arch,libc:process.report.getReport().header.glibcVersionRuntime?'glibc':'unknown'}))`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    if (inspected.status !== 0) throw new Error()
    const runtime: Runtime = { ...JSON.parse(inspected.stdout), bun: Bun.version }
    validateRuntime(runtime)
    const destination = join(work, component)
    const forbiddenValues = secretNames.map(name => process.env[name]).filter((value): value is string => Boolean(value))
    if (component === 'web') {
      phase = 'web production dependencies'
      const dependencies = join(work, 'dependencies')
      mkdirSync(dependencies)
      for (const name of ['package.json', 'bun.lock']) copyFileSync(join(root, 'web', name), join(dependencies, name))
      command('bun', ['install', '--production', '--frozen-lockfile', '--ignore-scripts'], dependencies, {
        PATH: process.env.PATH, BUN_INSTALL_CACHE_DIR: join(work, 'bun-cache'), NPM_CONFIG_USERCONFIG: '/dev/null', CI: 'true',
      })
      phase = 'web staging'
      stageRelease({ component, input: join(root, 'web/build'), dependencies: join(dependencies, 'node_modules'),
        destination, revision, epoch, runtime, forbiddenValues })
    } else {
      phase = 'CMS migration entrypoint'
      command('bun', ['build', 'tools/release-migrate.ts', '--target=node', '--packages=external', '--format=esm', '--outfile=.next/release-migrate.mjs'], join(root, 'cms'))
      command('node', ['tools/trace-release-migrate.mjs'], join(root, 'cms'))
      copyFileSync(join(root, 'cms/.next/release-migrate.mjs'), join(root, 'cms/.next/standalone/migrate.mjs'))
      phase = 'CMS staging'
      stageRelease({ component: component as Component, input: join(root, 'cms/.next/standalone'),
        staticAssets: join(root, 'cms/.next/static'), publicAssets: join(root, 'cms/public'),
        destination, revision, epoch, runtime, forbiddenValues })
    }
    phase = 'archive'
    const name = `terrace-${component}-${revision}-linux-x64-gnu.tar.gz`
    const archive = join(work, name)
    command('tar', ['--sort=name', `--mtime=@${epoch}`, '--owner=0', '--group=0', '--numeric-owner', '-czf', archive, '-C', destination, '.'])
    const hash = createHash('sha256').update(readFileSync(archive)).digest('hex')
    const target = join(output, name)
    const metadata = join(output, `terrace-${component}-${revision}.release.json`)
    if ([target, target + '.sha256', metadata].some(existsSync)) throw new Error()
    phase = 'publish'
    const created: string[] = []
    try {
      linkSync(archive, target); created.push(target)
      writeFileSync(target + '.sha256', `${hash}  ${name}\n`, { flag: 'wx', mode: 0o600 }); created.push(target + '.sha256')
      copyFileSync(join(destination, 'release.json'), metadata, constants.COPYFILE_EXCL); created.push(metadata)
      const index = openChecksumIndex(join(output, 'SHA256SUMS'))
      try {
        writeFileSync(index, `${hash}  ${name}\n`)
      } finally { closeSync(index) }
    } catch {
      for (const path of created) unlinkSync(path)
      throw new Error()
    }
    // These values describe only the secret-free artifact; never emit build/runtime inputs.
    console.log(JSON.stringify({ component, artifact: target, sha256: hash, revision, runtime }))
    complete = true
  } finally {
    closeSync(log)
    if (complete) rmSync(work, { recursive: true, force: true })
  }
} catch (error) {
  const reason = error instanceof ReleaseRejected ? ` (${error.reason})` : ''
  console.error(`Release packaging failed during ${phase}${reason}. Use a clean Linux build and inspect the protected OUTPUT/.pack-* log and documented inputs; no runtime data was published.`)
  process.exitCode = 1
}
