import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync, writeSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { userInfo } from 'node:os'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { portAvailable, processIdentity } from '../local-stack.ts'
import { stopOwnedGroup } from './child'
import { fileManifest, validateRuntime } from './package'
import pins from './runtime.json'

const root = realpathSync(fileURLToPath(new URL('../..', import.meta.url)))
let stage = 'arguments', log: number | undefined, state = '', databaseOwned = false, interrupted = false
let foreground: ChildProcess | undefined
const servers: { pid: number; fingerprint: string }[] = []
let identityRecord: { pid: number; fingerprint: string } | undefined
// Namespace processes can have a cwd absent from the host. Track our exact child
// using kernel start time, UID and group, which survives its exec into Node.
function ownedFingerprint(pid: number): string | null {
  try {
    const path = `/proc/${pid}`
    if (statSync(path).uid !== process.getuid?.()) return null
    const stat = readFileSync(path + '/stat', 'utf8')
    const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
    if (Number(fields[2]) !== pid) return null
    return fields[19]
  } catch { return null }
}
let verifiedRevision = ''
const ports = { identity: 18386, cms: 13048, web: 14294 }
const stop = async (pid: number) => { try { await stopOwnedGroup(pid) } catch { process.exitCode = 1 } }
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => { interrupted = true; if (foreground?.pid) void stop(foreground.pid) })
try {
  if (process.platform !== 'linux' || process.arch !== 'x64' || Bun.version !== pins.bun || process.argv.length !== 3 || existsSync(join(root, 'identity/.state'))) throw new Error()
  const output = realpathSync(process.argv[2])
  const archives = readdirSync(output).filter(name => /^terrace-(web|cms)-[a-f0-9]{40}-linux-x64-gnu\.tar\.gz$/.test(name))
  if (archives.length !== 2) throw new Error()
  state = mkdtempSync(join(dirname(root), 'release-proof-'))
  log = openSync(join(state, 'proof.log'), 'w', 0o600)
  const base: NodeJS.ProcessEnv = { PATH: process.env.PATH, HOME: process.env.HOME, CI: 'true', NEXT_TELEMETRY_DISABLED: '1' }
  const run = async (label: string, program: string, args: string[], env = base, cwd = root, capture = false, timeout = 240000) => {
    stage = label
    if (interrupted) throw new Error()
    console.log(`Release proof: ${label}.`)
    foreground = spawn(program, args, { cwd, env, detached: true, stdio: ['ignore', capture ? 'pipe' : log!, log!] })
    let result = ''
    foreground.stdout?.on('data', data => { if (result.length < 65536) result += data.toString() })
    let timedOut = false
    const timer = setTimeout(() => { timedOut = true; if (foreground?.pid) void stop(foreground.pid) }, timeout)
    try {
      const code = await new Promise((done, fail) => { foreground!.once('exit', done); foreground!.once('error', () => {
        writeSync(log!, 'Release command could not start; raw launch diagnostics suppressed.\n'); fail(new Error())
      }) })
      if (code !== 0 || interrupted || timedOut) throw new Error()
      return result.trim()
    } finally { clearTimeout(timer); if (foreground?.pid) await stop(foreground.pid); foreground = undefined }
  }
  const componentRoots: Record<string, string> = {}
  let revision = ''
  for (const name of archives) {
    stage = 'archive verification'
    const actual = createHash('sha256').update(readFileSync(join(output, name))).digest('hex')
    if (readFileSync(join(output, name + '.sha256'), 'utf8') !== `${actual}  ${name}\n`) throw new Error()
    const component = name.split('-')[1]
    const destination = join(state, component)
    mkdirSync(destination)
    await run(`${component} extraction`, 'tar', ['-xzf', join(output, name), '-C', destination])
    const manifest = JSON.parse(readFileSync(join(destination, 'release.json'), 'utf8'))
    validateRuntime(manifest.runtime)
    if (manifest.component !== component || !/^[a-f0-9]{40}$/.test(manifest.revision) || (revision && revision !== manifest.revision)) throw new Error()
    revision = manifest.revision
    const files = fileManifest(destination); delete files['release.json']
    if (JSON.stringify(files) !== JSON.stringify(manifest.files)) throw new Error()
    componentRoots[component] = destination
  }
  if (!componentRoots.cms || !componentRoots.web) throw new Error()
  const node = realpathSync(Bun.which('node')!), bash = realpathSync(Bun.which('bash')!), browser = realpathSync(Bun.which('chromium')!), bwrap = realpathSync(Bun.which('bwrap')!)
  const media = join(state, 'media'), cache = join(state, 'cache'), socket = join(state, 'postgres-socket'), data = join(state, 'postgres')
  for (const path of [media, cache, socket]) mkdirSync(path, { mode: 0o700 })
  const runtimeBase = { PATH: `${dirname(node)}:${dirname(bash)}`, HOME: '/tmp', NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' }
  const sandbox = (component: 'web' | 'cms', entry: string, extra: string[] = []) => [
    '--die-with-parent', '--unshare-user', '--unshare-pid', '--ro-bind', '/nix/store', '/nix/store',
    '--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp', '--ro-bind', componentRoots[component], '/app',
    '--dir', '/runtime', '--bind', media, '/runtime/media', '--bind', socket, '/runtime/postgres',
    ...(component === 'cms' ? ['--bind', cache, '/app/.next/cache'] : []), '--chdir', '/app', bash, entry, ...extra,
  ]
  // The namespace starts empty: no checkout, dependency tree, home credentials or build state.
  await run('read-only sandbox boundary', bwrap, sandbox('cms', '-c', ['exec "$@"', 'release-boundary', node, '-e', `
    const f=require('node:fs');
    let denied=false;
    try { const fd=f.openSync('/app/server.js','a'); f.closeSync(fd); }
    catch(e) { if(!['EROFS','EACCES'].includes(e.code))throw e; denied=true; }
    if(!denied)throw new Error('Release code is writable.');
    for(const dir of ['/app/.next/cache','/runtime/media']) {
      const file=dir+'/.release-write-probe'; f.writeFileSync(file,'synthetic'); f.unlinkSync(file);
    }
    if(f.existsSync(process.argv[1]))throw new Error('Source checkout remains visible.');
    console.log('Immutable code, writable runtime mounts and absent source verified.');
  `, root]), runtimeBase)
  for (const port of [...Object.values(ports), ports.identity + 1000]) if (!await portAvailable(port)) throw new Error()
  const cmsOrigin = `http://127.0.0.1:${ports.cms}`, webOrigin = `http://127.0.0.1:${ports.web}`
  const nonce = randomUUID()
  const identityEnv = { ...base, KEYCLOAK_HTTP_PORT: String(ports.identity), TERRACE_LOCAL_WEB_ORIGIN: webOrigin, TERRACE_LOCAL_CMS_ORIGIN: cmsOrigin, TERRACE_LOCAL_STACK_RUN: nonce }
  try { await run('fresh synthetic Keycloak', 'direnv', ['exec', join(root, 'identity'), 'bun', 'identity/tools/local-up.ts'], identityEnv, root, false, 900000) }
  finally {
    try {
      const marker = JSON.parse(readFileSync(join(root, 'identity/.state/local-stack-start.json'), 'utf8'))
      const info = processIdentity(marker.pid)
      const fingerprint = ownedFingerprint(marker.pid)
      if (info && fingerprint && marker.run === nonce && info.group === marker.pid && info.cwd.startsWith(join(root, 'identity/.state/keycloak-'))) identityRecord = { pid: marker.pid, fingerprint }
    } catch { /* no newly started fixture */ }
  }
  if (!identityRecord) throw new Error()
  // Consume only the dedicated producer's settings internally; never print them.
  const auth = Object.fromEntries(readFileSync(join(root, 'identity/.state/app.env'), 'utf8').trim().split('\n').map(line => {
    const split = line.indexOf('='); const key = line.slice(0, split)
    if (!/^(MEMBER_AUTH|CMS_AUTH)_[A-Z_]+$/.test(key) || split < 1) throw new Error()
    return [key, line.slice(split + 1)]
  }))
  databaseOwned = true
  await run('fresh runtime database initialization', 'initdb', ['-D', data, '--auth-local=trust', '--auth-host=reject'])
  writeFileSync(join(data, 'postgresql.auto.conf'), `listen_addresses = ''\nport = 55433\nunix_socket_directories = '${socket}'\n`, { mode: 0o600 })
  await run('fresh runtime database start', 'pg_ctl', ['-D', data, '-l', join(state, 'postgres.log'), '-w', 'start'])
  await run('fresh runtime database creation', 'createdb', ['-h', socket, '-p', '55433', 'terrace_release'])
  const cmsAuth = Object.fromEntries(Object.entries(auth).filter(([key]) => key !== 'MEMBER_AUTH_CLIENT_SECRET' && key !== 'MEMBER_AUTH_ORIGIN'))
  const cmsEnv = { ...runtimeBase, ...cmsAuth, CMS_ORIGIN: cmsOrigin, CMS_MEDIA_DIR: '/runtime/media',
    DATABASE_URI: `postgresql://${encodeURIComponent(userInfo().username)}@/terrace_release?host=%2Fruntime%2Fpostgres&port=55433`, PAYLOAD_SECRET: randomBytes(48).toString('hex'), PORT: String(ports.cms) }
  await run('relocated explicit migrations', bwrap, sandbox('cms', '/app/bin/migrate'), cmsEnv)
  const pgEnv = { ...base, PGHOST: socket, PGPORT: '55433', PGDATABASE: 'terrace_release' }
  const before = await run('migration ledger', 'psql', ['-Atqc', 'select name,batch from payload_migrations order by id'], pgEnv, root, true)
  if (!before || before.split('\n').length !== 6) throw new Error()
  await run('relocated no-op migration repeat', bwrap, sandbox('cms', '/app/bin/migrate'), cmsEnv)
  const after = await run('unchanged migration ledger', 'psql', ['-Atqc', 'select name,batch from payload_migrations order by id'], pgEnv, root, true)
  if (before !== after) throw new Error()
  const webEnv = { ...runtimeBase, CMS_ORIGIN: cmsOrigin, CONTENT_SOURCE: 'cms', ORIGIN: webOrigin, PORT: String(ports.web),
    ...Object.fromEntries(['MEMBER_AUTH_ISSUER', 'MEMBER_AUTH_CLIENT_ID', 'MEMBER_AUTH_CLIENT_SECRET', 'MEMBER_AUTH_ORIGIN'].map(key => [key, auth[key]])) }
  for (const [component, env] of [['cms', cmsEnv], ['web', webEnv]] as const) {
    stage = `${component} production startup`
    const server = spawn(bwrap, sandbox(component, '/app/bin/start'), { cwd: '/', env, detached: true, stdio: ['ignore', log, log] })
    let spawnFailed = false
    server.on('error', () => { spawnFailed = true })
    if (!server.pid) throw new Error()
    const fingerprint = ownedFingerprint(server.pid)
    if (!fingerprint) { await stop(server.pid); throw new Error() }
    servers.push({ pid: server.pid, fingerprint })
    let ready = false
    for (let attempt = 0; attempt < 90 && !interrupted && !spawnFailed; attempt++) {
      try { if ((await fetch(`${component === 'cms' ? cmsOrigin : webOrigin}${component === 'cms' ? '/api/events?limit=1' : '/events/'}`, { signal: AbortSignal.timeout(1500) })).ok) { ready = true; break } } catch { /* starting */ }
      await delay(1000)
    }
    if (!ready || spawnFailed) throw new Error()
  }
  const testEnv = { ...base, ...auth, CMS_ORIGIN: cmsOrigin, TERRACE_TEST_IDENTITY_STATE: join(root, 'identity/.state'),
    TERRACE_TEST_BROWSER_BINARY: browser, TERRACE_TEST_WEB_ORIGIN: webOrigin, TERRACE_TEST_PRODUCTION: '1', CMS_LOCAL_BOOTSTRAP: '1' }
  mkdirSync(join(state, '.state'), { mode: 0o700 })
  for (const [label, script] of [['private-media cache isolation', 'test-release-media.ts'], ['normal editorial SSO and publication', 'test-editorial-browser.ts'], ['normal member SSO and moderation', 'test-reports-browser.ts']]) {
    await run(label, 'bun', [join(root, 'cms/tools', script)], testEnv, state)
  }
  if (!Object.keys(fileManifest(cache)).some(name => name.startsWith('images/'))) throw new Error()
  verifiedRevision = revision
} catch {
  console.error(`Relocated release proof failed during ${stage}; inspect its protected proof.log. Raw runtime/authentication diagnostics suppressed.`)
  process.exitCode = 1
} finally {
  for (const record of [...servers.reverse(), ...(identityRecord ? [identityRecord] : [])]) {
    const fingerprint = ownedFingerprint(record.pid)
    if (fingerprint === record.fingerprint) await stop(record.pid)
    else if (existsSync(`/proc/${record.pid}`)) { console.error('Owned runtime identity changed; cleanup needs inspection.'); process.exitCode = 1 }
  }
  if (databaseOwned && log !== undefined) {
    const status = () => spawnSync('pg_ctl', ['-D', join(state, 'postgres'), 'status'], { stdio: ['ignore', log!, log!], timeout: 10000 }).status
    const before = status()
    if (before === 0) spawnSync('pg_ctl', ['-D', join(state, 'postgres'), '-m', 'fast', '-w', 'stop'], { stdio: ['ignore', log, log], timeout: 15000 })
    if ((before !== 0 && before !== 3) || status() !== 3 || existsSync(join(state, 'postgres-socket/.s.PGSQL.55433'))) {
      console.error('Owned runtime database cleanup needs inspection.'); process.exitCode = 1
    }
  }
  if (log !== undefined) closeSync(log)
}
if (verifiedRevision && !process.exitCode) {
  for (const port of [...Object.values(ports), ports.identity + 1000]) {
    if (!await portAvailable(port)) { console.error('Release proof cleanup left a fixture port occupied.'); process.exitCode = 1 }
  }
  if (!process.exitCode) {
    writeFileSync(join(state, 'proof.json'), JSON.stringify({ revision: verifiedRevision, checks: ['archive/file hashes', 'empty filesystem/immutable code', 'six explicit migrations', 'repeat no-op migration ledger', 'editorial SSO/publication/withdrawal', 'member SSO/moderation', 'native image optimization/cache', 'authenticated-then-anonymous private-image denial', 'owned runtime cleanup/closed ports'] }, null, 2) + '\n', { mode: 0o600 })
    console.log(`Relocated release proof passed for ${verifiedRevision}, including owned runtime cleanup. Private evidence retained in ${state}.`)
  }
}
