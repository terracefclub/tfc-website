import { createHash, randomUUID } from 'node:crypto'
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { createServer } from 'node:net'

type Kind = 'identity' | 'cms' | 'web' | 'db'
type Ports = { identity: number; cms: number; web: number }
type Record = { pid: number; fingerprint: string; root: string; kind: Kind; port: number }
const root = realpathSync(fileURLToPath(new URL('../', import.meta.url)))
const component = (kind: Kind) => resolve(root, kind === 'db' ? 'cms' : kind)
const state = (kind: Kind) => resolve(component(kind), '.state')
const recordPath = (kind: Kind) => resolve(state(kind), kind === 'db' ? 'local-stack-db.json' : 'local-stack.json')
const markerPath = (kind: Kind) => resolve(state(kind), kind === 'db' ? 'local-stack-db-start.json' : 'local-stack-start.json')
const configPath = resolve(state('identity'), 'local-stack-config.json')
class StackError extends Error {}
let interrupted = false
let foreground: ChildProcess | undefined

export function stackPorts(args: string[], saved?: Ports): { mode: 'start' | 'status'; ports: Ports } {
  const mode = args[0] === undefined || args[0].startsWith('--') ? 'start' : args.shift()
  if (mode !== 'start' && mode !== 'status') throw new StackError('Use tools/local-stack start or status, with optional --identity-port, --cms-port and --web-port.')
  const ports = { ...(saved || { identity: 8186, cms: 3040, web: 4194 }) }
  for (let i = 0; i < args.length; i += 2) {
    const name = ({ '--identity-port': 'identity', '--cms-port': 'cms', '--web-port': 'web' } as const)[args[i] as '--identity-port']
    if (!name || !/^\d+$/.test(args[i + 1] || '')) throw new StackError('Local ports must be explicit integers.')
    ports[name] = Number(args[i + 1])
  }
  if (Object.values(ports).some(port => !Number.isInteger(port) || port < 1024 || port > 64535) || new Set([...Object.values(ports), ports.identity + 1000]).size !== 4) throw new StackError('Choose distinct local ports from 1024 to 64535, including the identity management port 1000 higher.')
  return { mode, ports }
}

function json(path: string): any {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}
function save(path: string, data: unknown) {
  mkdirSync(resolve(path, '..'), { recursive: true, mode: 0o700 })
  writeFileSync(path, JSON.stringify(data), { mode: 0o600 })
  chmodSync(path, 0o600)
}
function command(program: string, args: string[]): string {
  return execFileSync(program, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}
export function processIdentity(pid: number): { cwd: string; argv: string; fingerprint: string; group: number } | null {
  if (!Number.isSafeInteger(pid) || pid < 2) return null
  try {
    const argv = command('ps', ['-p', String(pid), '-o', 'lstart=', '-o', 'args='])
    const cwd = command('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn']).split('\n').find(line => line.startsWith('n'))?.slice(1)
    if (!cwd || !argv) return null
    const realCwd = realpathSync(cwd)
    return { cwd: realCwd, argv, group: Number(command('ps', ['-p', String(pid), '-o', 'pgid='])), fingerprint: createHash('sha256').update(`${realCwd}\0${argv}`).digest('hex') }
  } catch { return null }
}
function matches(kind: Kind, info: NonNullable<ReturnType<typeof processIdentity>>) {
  const base = component(kind)
  const cwd = kind === 'identity' ? info.cwd.startsWith(`${state(kind)}/keycloak-`) : info.cwd === base || kind === 'db' && info.cwd === resolve(state(kind), 'postgres')
  const argv = kind === 'identity' ? info.argv.includes(`${state(kind)}/keycloak-`) : kind === 'web' ? info.argv.includes(`${base}/tools/run-sveltekit.mjs`) : kind === 'cms' ? info.argv.includes(`${base}/node_modules/.bin/next`) : info.argv.includes(resolve(state(kind), 'postgres'))
  return cwd && argv
}
export function sameProcess(record: Pick<Record, 'pid' | 'fingerprint'>) {
  const info = processIdentity(record.pid)
  return Boolean(info && typeof record.fingerprint === 'string' && info.fingerprint === record.fingerprint)
}
function owned(kind: Kind, port: number): Record | null {
  const record = json(recordPath(kind)) as Record | null
  if (!record || record.root !== root || record.kind !== kind || record.port !== port) return null
  const info = processIdentity(record.pid)
  return info && matches(kind, info) && info.fingerprint === record.fingerprint ? record : null
}
function listeners(port: number): number[] {
  try { return command('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fp']).split('\n').filter(line => /^p\d+$/.test(line)).map(line => Number(line.slice(1))) }
  catch (error) {
    if ((error as { status?: number }).status === 1) return []
    throw new StackError('Cannot verify local port ownership; existing processes were left running.')
  }
}
function ownsListeners(record: Record, pids: number[]) {
  return pids.length > 0 && pids.every(pid => processIdentity(pid)?.group === record.pid)
}
export async function portAvailable(port: number): Promise<boolean> {
  return new Promise(done => {
    const probe = createServer()
    probe.once('error', () => done(false))
    probe.listen(port, '127.0.0.1', () => probe.close(() => done(true)))
  })
}
async function healthy(kind: Exclude<Kind, 'db'>, ports: Ports) {
  const origin = `http://127.0.0.1:${ports[kind]}`
  try {
    const response = await fetch(`${origin}${kind === 'identity' ? '/realms/terrace/.well-known/openid-configuration' : kind === 'cms' ? '/api/events?limit=1&depth=0' : '/'}`, { redirect: 'manual', signal: AbortSignal.timeout(5000) })
    if (!response.ok) return false
    if (kind === 'identity') return (await response.json()).issuer === `${origin}/realms/terrace`
    await response.body?.cancel()
    return true
  } catch { return false }
}
async function waitHealthy(kind: Exclude<Kind, 'db'>, ports: Ports) {
  for (let i = 0; i < 90; i++) {
    if (interrupted) throw new StackError('Local startup was interrupted; newly started services were cleaned up where ownership was verified.')
    if (await healthy(kind, ports)) return
    await delay(1000)
  }
  throw new StackError(`Local ${kind} did not become ready; inspect its private .state/local-stack.log.`)
}
async function run(kind: Exclude<Kind, 'db'>, args: string[], extra: NodeJS.ProcessEnv) {
  if (interrupted) throw new StackError('Local startup was interrupted.')
  const log = openSync(resolve(state(kind), 'local-stack.log'), 'a', 0o600)
  try {
    chmodSync(resolve(state(kind), 'local-stack.log'), 0o600)
    const child = spawn('direnv', ['exec', component(kind), ...args], { cwd: component(kind), env: { ...process.env, ...extra }, detached: true, stdio: ['ignore', log, log] })
    foreground = child
    const code = await new Promise<number | null>((done, fail) => { child.once('exit', done); child.once('error', fail) })
    if (code !== 0) throw new StackError(`Local ${kind} setup failed; inspect its private .state/local-stack.log.`)
  } finally { foreground = undefined; closeSync(log) }
}
async function printStatus(ports: Ports) {
  let ready = true
  for (const [kind, path, label] of [['web', '/', 'Website'], ['cms', '/admin/login', 'CMS'], ['identity', '/admin/', 'Identity']] as const) {
    const record = owned(kind, ports[kind])
    const ok = record && ownsListeners(record, listeners(ports[kind])) && await healthy(kind, ports)
    ready &&= Boolean(ok)
    console.log(`${label} ${ok ? 'ready' : 'not ready'}: http://127.0.0.1:${ports[kind]}${path}`)
  }
  console.log(`Synthetic member accounts: local-member (memberPassword), local-alumni (alumniPassword).`)
  console.log(`Synthetic CMS accounts: local-editorial-editor (editorialEditorPassword), local-editorial-admin (editorialAdminPassword).`)
  console.log(`Identity administrator: terrace-local-admin (adminPassword). Credentials: ${resolve(state('identity'), 'credentials.json')}`)
  return ready
}

async function main() {
  const saved = existsSync(configPath) ? json(configPath) : undefined
  if (saved === null) throw new StackError('Local stack settings are invalid; existing processes were left running.')
  const { mode, ports } = stackPorts(process.argv.slice(2), saved)
  if (mode === 'status') { process.exitCode = await printStatus(ports) ? 0 : 1; return }
  let complete = true
  for (const kind of ['identity', 'cms', 'web'] as const) {
    const record = json(recordPath(kind)) as Record | null
    if (record && sameProcess(record) && record.port !== ports[kind]) throw new StackError('A managed local service is already running on different ports; it was left running.')
    const claimed = owned(kind, ports[kind])
    complete &&= Boolean(claimed)
    for (const port of kind === 'identity' ? [ports.identity, ports.identity + 1000] : [ports[kind]]) {
      const pids = listeners(port)
      const available = await portAvailable(port)
      if ((!available || pids.length > 0) && (!claimed || !ownsListeners(claimed, pids))) throw new StackError(`Local port ${port} is occupied by an unrelated process; it was left running.`)
    }
    if (claimed && !await healthy(kind, ports)) throw new StackError(`An existing managed ${kind} is unhealthy; it was left running for inspection.`)
  }
  if (complete) { if (!await printStatus(ports)) process.exitCode = 1; return }
  for (const kind of ['identity', 'cms', 'web'] as const) { mkdirSync(state(kind), { recursive: true, mode: 0o700 }); chmodSync(state(kind), 0o700) }
  const lock = resolve(state('identity'), 'local-stack.lock')
  try { mkdirSync(lock, { mode: 0o700 }) } catch { throw new StackError('Another startup may be running; inspect identity/.state/local-stack.lock before retrying.') }
  save(resolve(lock, 'owner.json'), { pid: process.pid, fingerprint: processIdentity(process.pid)?.fingerprint })
  const runId = randomUUID()
  const started: Record[] = []
  const extra = { KEYCLOAK_HTTP_PORT: String(ports.identity), TERRACE_LOCAL_WEB_ORIGIN: `http://127.0.0.1:${ports.web}`, TERRACE_LOCAL_CMS_ORIGIN: `http://127.0.0.1:${ports.cms}`, TERRACE_LOCAL_STACK_RUN: runId }
  const collect = () => {
    for (const kind of ['identity', 'db', 'cms', 'web'] as const) {
      const marker = json(markerPath(kind))
      if (marker?.run !== runId || started.some(record => record.kind === kind)) continue
      const info = processIdentity(marker.pid)
      if (!info || !matches(kind, info)) continue
      const record: Record = { pid: marker.pid, fingerprint: info.fingerprint, root, kind, port: kind === 'db' ? 55432 : ports[kind] }
      started.push(record)
      save(recordPath(kind), record)
    }
  }
  try {
    save(configPath, ports)
    if (!owned('identity', ports.identity)) {
      try { await run('identity', ['bun', 'tools/local-up.ts'], extra) } finally { collect() }
    }
    await waitHealthy('identity', ports)
    const wrappers = ['tools/with-local', '../identity/tools/with-local', 'env', `CMS_ORIGIN=${extra.TERRACE_LOCAL_CMS_ORIGIN}`]
    if (!owned('cms', ports.cms)) {
      await run('cms', ['bun', 'install', '--frozen-lockfile'], extra)
      try { await run('cms', ['tools/local-up'], extra) } finally { collect() }
      await run('cms', [...wrappers, 'bun', 'run', 'migrate'], extra)
      try { await run('cms', [...wrappers, 'bun', 'tools/local-preview.ts'], extra) } finally { collect() }
    }
    await waitHealthy('cms', ports)
    if (!owned('web', ports.web)) {
      await run('web', ['bun', 'install', '--frozen-lockfile'], extra)
      try { await run('web', ['../identity/tools/with-local', 'env', `CMS_ORIGIN=${extra.TERRACE_LOCAL_CMS_ORIGIN}`, `TERRACE_LOCAL_PREVIEW_ORIGIN=${extra.TERRACE_LOCAL_WEB_ORIGIN}`, 'bun', 'tools/local-preview.ts'], extra) } finally { collect() }
    }
    await waitHealthy('web', ports)
    if (!await printStatus(ports)) throw new StackError('Local services did not pass their ownership and health checks.')
  } catch (error) {
    interrupted = false // Cleanup must still be able to invoke pg_ctl after an interrupt.
    collect()
    for (const record of started.reverse()) {
      if (!sameProcess(record)) continue
      if (record.kind === 'db') {
        await run('cms', ['pg_ctl', '-D', resolve(state('db'), 'postgres'), 'stop'], extra).catch(() => undefined)
      } else {
        try { process.kill(-record.pid, 'SIGTERM') } catch { /* no longer running */ }
        // Detached servers may need a moment to close listeners and flush local data.
        for (let i = 0; i < 100; i++) {
          const ports = record.kind === 'identity' ? [record.port, record.port + 1000] : [record.port]
          if (!processIdentity(record.pid) && ports.every(port => listeners(port).every(pid => processIdentity(pid)?.group !== record.pid))) break
          await delay(100)
        }
      }
    }
    throw error
  } finally { rmSync(lock, { recursive: true, force: true }) }
}

if (import.meta.main) {
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => {
    interrupted = true
    if (foreground?.pid) { try { process.kill(-foreground.pid, 'SIGTERM') } catch { /* already exited */ } }
  })
  main().catch(error => {
    console.log(error instanceof StackError ? error.message : 'Local stack command failed. Inspect the private component logs; no data was removed.')
    process.exitCode = 1
  })
}
