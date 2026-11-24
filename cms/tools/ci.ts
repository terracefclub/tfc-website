import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { setTimeout as delay } from 'node:timers/promises'
import pg from 'pg'
import { stopOwnedGroup } from '../../tools/release/child'
import { expectedMigrationNames, ledgerMatches } from '../../tools/release/migrations'
import { assertSweepSummary } from '../../tools/release/sweep-summary'

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

async function run(command: string, args: string[], extraEnv: Record<string, string> = {}, timeout = 900000, capture = false): Promise<string> {
  const child = spawn(command, args, { stdio: ['inherit', capture ? 'pipe' : 'inherit', 'inherit'], env: { ...env, ...extraEnv }, detached: true })
  let output = ''
  child.stdout?.on('data', data => { if (output.length < 65536) output += data })
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; if (child.pid) void stopOwnedGroup(child.pid) }, timeout)
  try {
    const code = await new Promise<number | null>((resolve, reject) => { child.once('exit', resolve); child.once('error', reject) })
    if (code !== 0 || timedOut) throw new Error('CI release command failed or timed out.')
    return output.trim()
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
// The Linux-only release proof (tools/release/smoke.ts, tools/test-*.ts) cannot run here, so fail early when it goes stale against the code it exercises.
await run('bun', ['test', 'test/release-proof.test.ts'])
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
    if (!ledgerMatches(first.rows.map(row => `${row.name}|${row.batch}`).join('\n'), expectedMigrationNames(resolve('migrations/index.ts')))) throw new Error('Extracted release migration ledger is incomplete.')
    await run(resolve(unpacked, 'bin/migrate'), [], migrationEnv, 90000)
    const second = await migrated.query('SELECT name,batch FROM payload_migrations ORDER BY id')
    if (JSON.stringify(first.rows) !== JSON.stringify(second.rows)) throw new Error('Repeated release migration was not a no-op.')
    // The sweep entry, first in source form and then as the packaged bin/sweep (no source checkout), writes a pending outbox copy and
    // prints a counts-only summary; the same check the release smoke applies must accept both.
    const synthetic = async (label: string) => (await migrated.query(`INSERT INTO message_outbox (kind, recipient_label, recipient_email, subject, body) VALUES ('denial', 'Synthetic Applicant', $1, 'Synthetic subject', 'Synthetic body') RETURNING id`, [`ci-${label}@terrace.invalid`])).rows[0].id
    const sourceOutbox = mkdtempSync(resolve(tmpdir(), 'terrace-ci-source-outbox-'))
    const sourceRow = await synthetic('source')
    const sourceSummary = JSON.parse(await run('bun', ['tools/release-sweep.ts'], { ...migrationEnv, LIFECYCLE_OUTBOX_DIR: resolve(sourceOutbox, 'mirror') }, 120000, true))
    assertSweepSummary(sourceSummary, { written: 1, forbidden: ['ci-source@terrace.invalid'] })
    if (JSON.parse(readFileSync(resolve(sourceOutbox, 'mirror', `${String(sourceRow).padStart(6, '0')}-denial.json`), 'utf8')).to !== 'ci-source@terrace.invalid') throw new Error('Source sweep did not write the private outbox copy.')
    const outbox = mkdtempSync(resolve(tmpdir(), 'terrace-ci-outbox-'))
    const sweepEnv = { ...migrationEnv, LIFECYCLE_OUTBOX_DIR: resolve(outbox, 'mirror') }
    const row = { rows: [{ id: await synthetic('applicant') }] }
    assertSweepSummary(JSON.parse(await run(resolve(unpacked, 'bin/sweep'), [], sweepEnv, 90000, true)), { written: 1, forbidden: ['ci-applicant@terrace.invalid'] })
    const file = resolve(outbox, 'mirror', `${String(row.rows[0].id).padStart(6, '0')}-denial.json`)
    if ((statSync(file).mode & 0o777) !== 0o600 || JSON.parse(readFileSync(file, 'utf8')).to !== 'ci-applicant@terrace.invalid') throw new Error('Packaged sweep did not write the private outbox copy.')
    if ((await migrated.query('SELECT count(*)::int AS n FROM message_outbox WHERE mirrored_at IS NULL')).rows[0].n !== 0) throw new Error('Packaged sweep did not mark the copy written.')
    await migrated.query(`UPDATE message_outbox SET recipient_label = 'Former member', recipient_email = NULL WHERE id = $1`, [row.rows[0].id])
    await run(resolve(unpacked, 'bin/sweep'), [], sweepEnv, 90000)
    if (JSON.parse(readFileSync(file, 'utf8')).to !== 'Former member') throw new Error('Packaged sweep did not redact the erased outbox copy.')
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
  // TERRACE_RELEASE_CMS: test/release-tools.test.ts runs the packaged bin/roster-invite and bin/wp-import from this extracted release.
  await run('bun', ['test'], { CMS_HTTP_URL: 'http://127.0.0.1:3010', TERRACE_RELEASE_CMS: unpacked })
} finally {
  if (server.pid) {
    await stopOwnedGroup(server.pid)
  }
}
