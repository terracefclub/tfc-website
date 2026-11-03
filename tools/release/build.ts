import { randomBytes } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readdirSync, realpathSync, writeFileSync } from 'node:fs'
import { userInfo } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pins from './runtime.json'
import { stopOwnedGroup } from './child'

const root = realpathSync(fileURLToPath(new URL('../..', import.meta.url)))
let phase = 'arguments', interrupted = false, stopFailed = false
let child: ReturnType<typeof spawn> | undefined
let stopping: Promise<void> | undefined
let log: number | undefined
let databaseOwned = false
let databasePath = '', socketPath = ''
let completedOutput = ''
const stop = () => {
  if (child?.pid && !stopping) stopping = stopOwnedGroup(child.pid).catch(() => { stopFailed = true })
}
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => { interrupted = true; stop(); process.exitCode = 1 })
try {
  if (process.platform !== 'linux' || process.arch !== 'x64' || Bun.version !== pins.bun || process.argv.length !== 3) throw new Error()
  const output = resolve(process.argv[2])
  const revision = process.env.TERRACE_RELEASE_REVISION || process.env.CI_COMMIT_SHA || spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).stdout.trim()
  const epoch = process.env.SOURCE_DATE_EPOCH || spawnSync('git', ['show', '-s', '--format=%ct', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).stdout.trim()
  if (!/^[a-f0-9]{40}$/.test(revision) || !/^\d+$/.test(epoch) || ['web', 'cms'].some(component => readdirSync(join(root, component)).some(name => name.startsWith('.env') && name !== '.envrc'))) throw new Error()
  const state = join(root, '.state')
  mkdirSync(state, { recursive: true, mode: 0o700 })
  const privateDir = mkdtempSync(join(state, 'release-build-'))
  log = openSync(join(privateDir, 'build.log'), 'w', 0o600)
  // A fresh fixture database and readable dummy secret are the only CMS build inputs.
  // No application/identity/provider secret from the invoking environment is inherited.
  const databaseName = 'terrace_release_build_' + randomBytes(8).toString('hex')
  const socket = socketPath = join(privateDir, 'socket')
  databasePath = join(privateDir, 'postgres')
  const media = join(privateDir, 'media')
  mkdirSync(media, { mode: 0o700 })
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, HOME: process.env.HOME, CI: 'true',
    DATABASE_URI: `postgresql://${encodeURIComponent(userInfo().username)}@/${databaseName}?host=${encodeURIComponent(socket)}&port=55432`,
    PAYLOAD_SECRET: 'SYNTHETIC_RELEASE_BUILD_ONLY_PAYLOAD_SECRET_DO_NOT_USE', CMS_ORIGIN: 'http://127.0.0.1:3048',
    CMS_MEDIA_DIR: media,
    TERRACE_RELEASE_REVISION: revision, SOURCE_DATE_EPOCH: epoch,
    NEXT_TELEMETRY_DISABLED: '1', NODE_OPTIONS: '--max-old-space-size=4096' }
  const run = async (label: string, component: 'web' | 'cms', cwd: string, args: string[]) => {
    phase = label
    if (interrupted) throw new Error()
    console.log(`Release build: ${label}.`)
    child = spawn('direnv', ['exec', join(root, component), ...args], { cwd, env, detached: true, stdio: ['ignore', log!, log!] })
    let timedOut = false
    const timer = setTimeout(() => { timedOut = true; stop() }, 900000)
    try {
      const code = await new Promise((done, fail) => { child!.once('exit', done); child!.once('error', fail) })
      if (code !== 0 || timedOut || interrupted) throw new Error()
    } finally { clearTimeout(timer); stop(); await stopping; stopping = undefined; child = undefined }
    if (stopFailed) throw new Error()
  }
  // A new private directory on every run; no fixture bootstrap or existing DB.
  mkdirSync(socket, { recursive: true, mode: 0o700 })
  databaseOwned = true
  const data = databasePath
  await run('isolated PostgreSQL initialization', 'cms', root, ['initdb', '-D', data, '--auth-local=trust', '--auth-host=reject'])
  writeFileSync(join(data, 'postgresql.auto.conf'), `listen_addresses = ''\nport = 55432\nunix_socket_directories = '${socket.replaceAll("'", "''")}'\n`, { mode: 0o600 })
  await run('isolated PostgreSQL start', 'cms', root, ['pg_ctl', '-D', data, '-l', join(privateDir, 'postgres.log'), '-w', 'start'])
  await run('fresh build database', 'cms', join(root, 'cms'), ['createdb', '-h', socket, '-p', '55432', databaseName])
  await run('explicit build database migrations', 'cms', join(root, 'cms'), ['bun', 'run', 'migrate'])
  await run('website production build', 'web', join(root, 'web'), ['bun', 'run', 'build'])
  await run('website packaging', 'cms', root, ['bun', 'tools/release/pack.ts', 'web', output])
  await run('CMS production build', 'cms', join(root, 'cms'), ['bun', 'run', 'build'])
  await run('CMS packaging', 'cms', root, ['bun', 'tools/release/pack.ts', 'cms', output])
  if (interrupted) throw new Error()
  completedOutput = output
} catch {
  stop(); await stopping
  console.error(`Release build failed during ${phase}; inspect the protected .state/release-build-* log. Use a fresh checkout on Linux under the shared heavy lock.`)
  process.exitCode = 1
} finally {
  // Only this runner could have created the previously absent private data directory.
  // Check even after interrupted startup, before pg_ctl could have returned successfully.
  if (databaseOwned && log !== undefined) {
      const dbEnv = { PATH: process.env.PATH, HOME: process.env.HOME }
      const running = spawnSync('direnv', ['exec', join(root, 'cms'), 'pg_ctl', '-D', databasePath, 'status'], { cwd: root, env: dbEnv, stdio: ['ignore', log, log], timeout: 15000 })
      if (running.status === 0) {
        const stopped = spawnSync('direnv', ['exec', join(root, 'cms'), 'pg_ctl', '-D', databasePath, '-m', 'fast', '-w', 'stop'], {
          cwd: root, env: dbEnv, stdio: ['ignore', log, log], timeout: 15000,
        })
        if (stopped.status !== 0) { console.error('Owned build database cleanup needs attention; inspect its protected build log.'); process.exitCode = 1 }
      }
      const after = spawnSync('direnv', ['exec', join(root, 'cms'), 'pg_ctl', '-D', databasePath, 'status'], { cwd: root, env: dbEnv, stdio: ['ignore', log, log], timeout: 15000 })
      if ((running.status !== 0 && running.status !== 3) || after.status !== 3 || existsSync(join(socketPath, '.s.PGSQL.55432'))) {
        console.error('Owned build database cleanup could not be verified.'); process.exitCode = 1
      }
  }
  if (log !== undefined) closeSync(log)
}
if (completedOutput && !process.exitCode) console.log(`Release build passed, including owned database cleanup. Secret-free archives and SHA256SUMS are in ${completedOutput}.`)
