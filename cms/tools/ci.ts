import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { setTimeout as delay } from 'node:timers/promises'
import pg from 'pg'
import { stopOwnedGroup } from '../../tools/release/child'

const env: NodeJS.ProcessEnv = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  TMPDIR: process.env.TMPDIR,
  CI: 'true',
  CI_COMMIT_SHA: process.env.CI_COMMIT_SHA,
  CI_COMMIT_TIMESTAMP: process.env.CI_COMMIT_TIMESTAMP,
  CMS_MEDIA_DIR: resolve('.state/media'),
  DATABASE_URI: 'postgresql://postgres@postgres:5432/terrace_cms',
  PAYLOAD_SECRET: randomBytes(48).toString('hex'),
  CMS_BOOTSTRAP_EMAIL: 'ci-admin@terrace.invalid',
  CMS_BOOTSTRAP_PASSWORD: randomBytes(24).toString('hex'),
  CMS_LOCAL_BOOTSTRAP: '1',
  CMS_ORIGIN: 'http://127.0.0.1:3010',
  NEXT_TELEMETRY_DISABLED: '1',
}
mkdirSync('.state/media', { recursive: true })

async function run(command: string, args: string[], extraEnv: Record<string, string> = {}, timeout = 900000) {
  const child = spawn(command, args, { stdio: 'inherit', env: { ...env, ...extraEnv }, detached: true })
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; if (child.pid) void stopOwnedGroup(child.pid) }, timeout)
  try {
    const code = await new Promise<number | null>((resolve, reject) => { child.once('exit', resolve); child.once('error', reject) })
    if (code !== 0 || timedOut) throw new Error('CI release command failed or timed out.')
  } finally { clearTimeout(timer); if (child.pid) await stopOwnedGroup(child.pid) }
}

const pool = new pg.Pool({ connectionString: env.DATABASE_URI })
let ready = false
for (let attempt = 0; attempt < 40; attempt++) {
  try { await pool.query('select 1'); ready = true; break } catch { await delay(1000) }
}
await pool.end()
if (!ready) throw new Error('CI PostgreSQL service did not become ready.')

await run('bun', ['run', 'check'])
await run('bun', ['run', 'check:release'])
await run('bun', ['run', 'migrate'])
await run('bun', ['run', 'bootstrap:local'])
await run('bun', ['run', 'build'])
await run('bun', ['../tools/release/pack.ts', 'cms', '../.state/releases/cms'])
// Keep Node's ancestor-module lookup away from the source dependency tree.
const unpacked = mkdtempSync(resolve(tmpdir(), 'terrace-ci-release-'))
await run('tar', ['-xzf', resolve(`../.state/releases/cms/terrace-cms-${env.CI_COMMIT_SHA}-linux-x64-gnu.tar.gz`), '-C', unpacked])
// A request-server trace alone does not establish migration dependency completeness.
const migrationDatabase = 'terrace_release_ci_' + randomBytes(8).toString('hex')
const adminPool = new pg.Pool({ connectionString: env.DATABASE_URI })
try {
  await adminPool.query(`CREATE DATABASE ${migrationDatabase}`)
  const migrationURI = new URL(env.DATABASE_URI!); migrationURI.pathname = '/' + migrationDatabase
  const migrationEnv = { DATABASE_URI: migrationURI.href }
  await run(resolve(unpacked, 'bin/migrate'), [], migrationEnv, 90000)
  const migrated = new pg.Pool({ connectionString: migrationURI.href })
  try {
    const first = await migrated.query('SELECT name,batch FROM payload_migrations ORDER BY id')
    if (first.rows.length !== 6) throw new Error('Extracted release migration ledger is incomplete.')
    await run(resolve(unpacked, 'bin/migrate'), [], migrationEnv, 90000)
    const second = await migrated.query('SELECT name,batch FROM payload_migrations ORDER BY id')
    if (JSON.stringify(first.rows) !== JSON.stringify(second.rows)) throw new Error('Repeated release migration was not a no-op.')
  } finally { await migrated.end() }
} finally {
  await adminPool.query(`DROP DATABASE IF EXISTS ${migrationDatabase}`)
  await adminPool.end()
}
const server = spawn(resolve(unpacked, 'bin/start'), [], { stdio: 'inherit', env: { ...env, PORT: '3010' }, detached: true })
let serverFailed = false
server.on('error', () => { serverFailed = true })
try {
  let response: Response | undefined
  for (let attempt = 0; attempt < 60; attempt++) {
    if (serverFailed) break
    try { response = await fetch('http://127.0.0.1:3010/api/events?limit=1'); if (response.ok) break } catch { /* still starting */ }
    await delay(1000)
  }
  if (!response?.ok) throw new Error('Production CMS did not become ready.')
  await run('bun', ['test'], { CMS_HTTP_URL: 'http://127.0.0.1:3010' })
} finally {
  if (server.pid) {
    await stopOwnedGroup(server.pid)
  }
}
