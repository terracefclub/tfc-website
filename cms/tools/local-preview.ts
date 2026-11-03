import { spawn } from 'node:child_process'
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const origin = new URL(process.env.CMS_ORIGIN || 'http://127.0.0.1:3010')
if (origin.hostname !== '127.0.0.1' || origin.protocol !== 'http:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Local preview requires a plain loopback origin.')
if (!process.env.CMS_AUTH_ISSUER) throw new Error('Load the dedicated local identity environment first.')
const state = resolve(root, '.state')
mkdirSync(state, { recursive: true, mode: 0o700 })
const pidFile = resolve(state, `preview-${origin.port}.pid`)
if (existsSync(pidFile)) {
  const pid = Number(readFileSync(pidFile, 'utf8'))
  if (Number.isSafeInteger(pid) && pid > 1) {
    let running = false
    try { process.kill(pid, 0); running = true } catch { /* previous process finished */ }
    if (running) throw new Error('Recorded preview process is still running. Verify its command before stopping it.')
  }
}
const probe = createServer()
await new Promise<void>((done, fail) => { probe.once('error', fail); probe.listen(Number(origin.port), origin.hostname, () => probe.close(() => done())) })
const logPath = resolve(state, `preview-${origin.port}.log`)
const log = openSync(logPath, 'a', 0o600)
chmodSync(logPath, 0o600)
const child = spawn('node', [resolve(root, 'node_modules/.bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', origin.port], {
  cwd: root, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, detached: true, stdio: ['ignore', log, log],
})
if (!child.pid) throw new Error('Preview did not start.')
writeFileSync(pidFile, `${child.pid}\n`, { mode: 0o600 })
if (process.env.TERRACE_LOCAL_STACK_RUN) writeFileSync(resolve(state, 'local-stack-start.json'), JSON.stringify({ run: process.env.TERRACE_LOCAL_STACK_RUN, pid: child.pid }), { mode: 0o600 })
child.unref()
closeSync(log)
console.log(`CMS preview started at ${origin.origin}/admin (PID ${child.pid}); private log in .state/.`)
