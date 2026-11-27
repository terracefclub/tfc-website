// The failure line of tools/release-migrate.ts. Payload's PostgreSQL adapter logs a failing migration and calls process.exit(1) itself,
// so the entrypoint's catch never runs; the logger it is given must therefore write one redacted line, synchronously, before that exit.
// Pure tests need nothing; the child-process tests run against real PostgreSQL (`tools/with-local bun test`, DATABASE_URI) and need Bun.
import { describe, expect, test } from 'bun:test'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import pg from 'pg'
import { pino } from 'pino'
import { failureLine, failureOf, redactError, releaseLoggerOptions } from '../tools/release-migrate-failure'

const cms = join(import.meta.dir, '..')
const PASSWORD = 'PlantedPassw0rd-9f3a', ROW = 'planted.member@terrace.invalid', SQL = 'SELECT secret_column_planted'
const known = ['20261028_080047', 'harness_one']

/** Drive the real pino logger as the entrypoint builds it, writing into a captured file descriptor stand-in. */
function logThrough(record: Record<string, unknown>): string {
  const lines: string[] = []
  const [options] = releaseLoggerOptions(known)
  const logger = pino(options, { write: (line: string) => { lines.push(line) } })
  logger.error(record)
  return lines.join('')
}
const pgError = (code: string, message: string, detail: string) => Object.assign(new (class DatabaseError extends Error {})(message), { code, detail, where: 'WHERE planted', query: SQL, parameters: [ROW] })
// Drizzle's wrapper: its own message holds the SQL and the parameter values; the driver error is the cause.
const drizzle = (cause: Error) => Object.assign(new (class DrizzleQueryError extends Error {})(`Failed query: ${SQL} params: ${ROW},${PASSWORD}`), { cause, query: SQL, params: [ROW] })

describe('redaction', () => {
  test('a schema-level code reports class, code and message, and nothing else of the error', () => {
    const err = drizzle(pgError('42P07', 'relation "users" already exists', `Key (email)=(${ROW})`))
    const record = JSON.parse(`${logThrough({ err, msg: `Error running migration 20261028_080047 ${err.message}.` })}`)
    expect(record.err).toEqual({ type: 'DatabaseError', code: '42P07', message: 'relation "users" already exists' })
    expect(failureLine(failureOf(record, known)!)).toBe('CMS release migration 20261028_080047 failed (DatabaseError 42P07): relation "users" already exists.\n')
  })
  test('a data-bearing code gets a fixed sentence, not the message', () => {
    const err = drizzle(pgError('22P02', `invalid input syntax for type integer: "${ROW}"`, ''))
    const line = failureLine(failureOf(JSON.parse(logThrough({ err, msg: `Error running migration harness_one ${err.message}.` })), known)!)
    expect(line).toBe('CMS release migration harness_one failed (DatabaseError 22P02): details suppressed; inspect the protected runtime configuration and database state.\n')
  })
  test('an error without any code reports only its class', () => {
    const line = failureLine(failureOf(JSON.parse(logThrough({ err: new TypeError(`${PASSWORD}`), msg: 'Error running migration harness_one whatever.' })), known)!)
    expect(line).toContain('harness_one failed (TypeError): details suppressed')
    expect(line).not.toContain(PASSWORD)
  })
  test('an unknown migration name is not echoed; a message with a URL and control characters is cleaned', () => {
    expect(failureOf({ msg: 'Error running migration postgres://u:p@h/db x', err: { type: 'Error' } }, known)!.migration).toBe('unknown')
    const out = redactError(pgError('42704', 'type\n"x" at postgres://u:pw@host/db\u001b[31m does not exist', ''))
    expect(out.message).toBe('type "x" at [url] [31m does not exist')
    expect(redactError(pgError('42704', 'x'.repeat(500), '')).message).toHaveLength(200)
  })
  test('records below error level and other error records stay silent', () => {
    const [options] = releaseLoggerOptions(known), lines: string[] = []
    const logger = pino(options, { write: (line: string) => { lines.push(line) } })
    logger.info({ msg: 'Migrating: harness_one' }); logger.warn({ msg: `warn ${PASSWORD}` })
    expect(lines).toEqual([]) // pino drops them before the destination
    const sink = failureOf(JSON.parse(logThrough({ msg: `some other error ${PASSWORD}` })), known)
    expect(sink).toBeNull()
  })
})

type Result = { code: number | null; out: string; err: string }
function run(command: string[], env: Record<string, string>): Promise<Result> {
  const child = spawn(command[0], command.slice(1), { cwd: cms, env: { ...process.env, PAYLOAD_SECRET: 'synthetic-payload-'.repeat(4), CMS_ORIGIN: 'http://127.0.0.1:3010', ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
  let out = '', err = ''
  child.stdout.on('data', (data) => { out += data }); child.stderr.on('data', (data) => { err += data })
  return new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', (code) => resolve({ code, out, err })) })
}

const admin = process.env.DATABASE_URI
describe.skipIf(!admin)('release-migrate against PostgreSQL', () => {
  const databases: string[] = []
  /** A fresh empty database, and a URI for it that carries a password: the planted one where the server ignores passwords (local trust authentication), the real one where it does not (CI). */
  async function fresh(prepare?: (pool: pg.Pool) => Promise<void>) {
    const pool = new pg.Pool({ connectionString: admin })
    const name = `terrace_migfail_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`
    const role = (await pool.query('SELECT current_user AS name')).rows[0].name
    await pool.query(`CREATE DATABASE ${name}`); databases.push(name)
    // The socket URI has an empty host, which cannot carry credentials: name localhost and let the `host` parameter still select the socket.
    const url = new URL(admin!.replace(/^(postgres(?:ql)?:\/\/)\//, '$1localhost/')); url.pathname = '/' + name; url.username = url.username || role; url.password = url.password || PASSWORD // a CI database already has a real password: keep it, and forbid it
    if (prepare) { const target = new pg.Pool({ connectionString: url.href }); try { await prepare(target) } finally { await target.end() } }
    await pool.end()
    return url.href
  }
  const everything = (r: Result) => r.out + r.err
  const forbid = (r: Result, uri: string) => {
    const url = new URL(uri)
    for (const secret of [PASSWORD, decodeURIComponent(url.password), ROW, SQL, uri, url.hostname, url.searchParams.get('host'), 'Failed query']) if (secret) expect(everything(r)).not.toContain(secret)
  }
  const { afterAll } = require('bun:test') as typeof import('bun:test')
  afterAll(async () => { const pool = new pg.Pool({ connectionString: admin }); for (const name of databases) await pool.query(`DROP DATABASE IF EXISTS ${name}`); await pool.end() })

  test('the real entrypoint against a conflicting object: exit 1, one redacted line, no secret anywhere', async () => {
    const uri = await fresh(pool => pool.query('CREATE TABLE users (id integer)').then(() => undefined))
    const result = await run(['bun', 'tools/release-migrate.ts'], { DATABASE_URI: uri })
    expect(result.code).toBe(1)
    expect(result.out).toBe('')
    expect(result.err).toBe('CMS release migration 20261028_080047 failed (DatabaseError 42P07): relation "users" already exists.\n')
    forbid(result, uri)
  }, 120000)

  test('a failure outside any migration keeps the existing final line', async () => {
    const uri = await fresh()
    const url = new URL(uri); url.searchParams.set('port', '1') // nothing listens: Payload's own connect error, thrown to the catch
    const result = await run(['bun', 'tools/release-migrate.ts'], { DATABASE_URI: url.href })
    expect(result.code).toBe(1)
    expect(result.err).toBe('CMS release migration failed; inspect the protected runtime configuration and database state.\n')
    forbid(result, url.href)
  }, 120000)

  test('a successful run prints exactly what it printed before and nothing on stderr', async () => {
    const uri = await fresh()
    const result = await run(['bun', 'tools/release-migrate.ts'], { DATABASE_URI: uri })
    expect({ code: result.code, out: result.out, err: result.err }).toEqual({ code: 0, out: 'CMS release migrations complete.\n', err: '' })
  }, 180000)

  // Same logger and adapter, synthetic migrations that make the PostgreSQL error carry row data.
  for (const [scenario, expected] of [
    ['unique', 'CMS release migration harness_two failed (DatabaseError 23505): duplicate key value violates unique constraint "harness_rows_email_key".\n'],
    ['type', 'CMS release migration harness_two failed (DatabaseError 22P02): details suppressed; inspect the protected runtime configuration and database state.\n'],
    ['plain', 'CMS release migration harness_two failed (Error): details suppressed; inspect the protected runtime configuration and database state.\n'],
  ] as const) test(`adapter failure ${scenario}: row value in the error never reaches the output`, async () => {
    const uri = await fresh()
    const result = await run(['bun', 'test/fixtures/release-migrate-failure-harness.ts'], { DATABASE_URI: uri, HARNESS_SCENARIO: scenario, HARNESS_PLANTED: ROW })
    expect(result.code).toBe(1)
    expect(result.out).toBe('')
    expect(result.err).toBe(expected)
    forbid(result, uri)
  }, 180000)
})
