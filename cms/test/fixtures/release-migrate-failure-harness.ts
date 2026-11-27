// Test-only child process for test/release-migrate-failure.test.ts. It is release-migrate.ts with two synthetic migrations appended to the list, after the real ones (the adapter needs their ledger table), so a failure can be made to carry row data in the PostgreSQL error (`detail`, or the message itself), which the
// real migrations cannot be made to do. Same logger, same payload.init, same payload.db.migrate, hence the same adapter process.exit(1).
import { sql } from '@payloadcms/db-postgres'
import payload from 'payload'
import { pino } from 'pino'
import { migrations as real } from '../../migrations'
import config from '../../src/payload.config'
import { releaseLoggerOptions } from '../../tools/release-migrate-failure'

process.env.PAYLOAD_MIGRATING = 'true'
const scenario = process.env.HARNESS_SCENARIO
const planted = process.env.HARNESS_PLANTED ?? ''
const migrations = [
  ...real.map(({ name, up, down }) => ({ name, up: (args: unknown) => up(args as any), down: (args: unknown) => down(args as any) })),
  { name: 'harness_one', up: async ({ db }: any) => { await db.execute(sql.raw(`CREATE TABLE harness_rows (email text UNIQUE); INSERT INTO harness_rows VALUES ('${planted}')`)) }, down: async () => {} },
  { name: 'harness_two', down: async () => {}, up: async ({ db }: any) => {
    if (scenario === 'unique') await db.execute(sql.raw(`INSERT INTO harness_rows VALUES ('${planted}')`)) // 23505, detail: Key (email)=(<planted>) already exists.
    else if (scenario === 'type') await db.execute(sql.raw(`SELECT '${planted}'::integer`)) // 22P02, message echoes the value
    else if (scenario === 'plain') throw new Error(`planted ${planted}`) // no SQLSTATE at all
  } },
]
const runtimeConfig = await config
Object.assign(runtimeConfig, { logger: pino(...releaseLoggerOptions(migrations.map(({ name }) => name))) })
await payload.init({ config: runtimeConfig, disableOnInit: true })
try { await payload.db.migrate({ migrations }) } finally { await payload.destroy() }
console.log('harness complete')
process.exit(0)
