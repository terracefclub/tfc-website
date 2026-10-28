import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import pg from 'pg'

const env: NodeJS.ProcessEnv = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  TMPDIR: process.env.TMPDIR,
  CI: 'true',
  DATABASE_URI: 'postgresql://postgres@postgres:5432/terrace_cms',
  PAYLOAD_SECRET: randomBytes(48).toString('hex'),
  CMS_BOOTSTRAP_EMAIL: 'ci-admin@terrace.invalid',
  CMS_BOOTSTRAP_PASSWORD: randomBytes(24).toString('hex'),
  CMS_LOCAL_BOOTSTRAP: '1',
  CMS_ORIGIN: 'http://127.0.0.1:3010',
  NEXT_TELEMETRY_DISABLED: '1',
}
mkdirSync('.state/media', { recursive: true })

async function run(command: string, args: string[], extraEnv: Record<string, string> = {}) {
  const child = spawn(command, args, { stdio: 'inherit', env: { ...env, ...extraEnv } })
  const code = await new Promise<number | null>((resolve) => child.on('exit', resolve))
  if (code !== 0) throw new Error(`${command} ${args.join(' ')} failed with exit ${code}`)
}

const pool = new pg.Pool({ connectionString: env.DATABASE_URI })
let ready = false
for (let attempt = 0; attempt < 40; attempt++) {
  try { await pool.query('select 1'); ready = true; break } catch { await delay(1000) }
}
await pool.end()
if (!ready) throw new Error('CI PostgreSQL service did not become ready.')

await run('bun', ['run', 'check'])
await run('bun', ['run', 'migrate'])
await run('bun', ['run', 'bootstrap:local'])
await run('bun', ['run', 'build'])
const server = spawn('./node_modules/.bin/next', ['start', '--hostname', '127.0.0.1', '--port', '3010'], { stdio: 'inherit', env, detached: true })
try {
  let response: Response | undefined
  for (let attempt = 0; attempt < 60; attempt++) {
    try { response = await fetch('http://127.0.0.1:3010/api/events?limit=1'); if (response.ok) break } catch { /* still starting */ }
    await delay(1000)
  }
  if (!response?.ok) throw new Error('Production CMS did not become ready.')
  await run('bun', ['test'], { CMS_HTTP_URL: 'http://127.0.0.1:3010' })
} finally {
  if (server.pid) {
    try { process.kill(-server.pid, 'SIGTERM') } catch { /* already stopped */ }
  }
}
