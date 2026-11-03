// Built to a Node ESM entrypoint; never run automatically from server startup.
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import type { Config } from 'payload'
process.env.PAYLOAD_MIGRATING = 'true'
Object.assign(process.env, { NODE_ENV: 'production' })
try {
  const [{ default: payload }, { default: config }, { migrations }, { pino }] = await Promise.all([
    import('payload'), import('../src/payload.config'), import('../migrations'), import('pino'),
  ])
  const runtimeConfig = await config
  const logger: NonNullable<Config['logger']> = pino({ level: 'silent' })
  // SanitizedConfig's deep-required logger type overconstrains optional Pino methods.
  Object.assign(runtimeConfig, { logger })
  await payload.init({ config: runtimeConfig, disableOnInit: true })
  // Payload's generic adapter uses unknown; this config always supplies PostgreSQL.
  const runnable = migrations.map(({ name, up, down }) => ({ name,
    up: (args: unknown) => up(args as MigrateUpArgs), down: (args: unknown) => down(args as MigrateDownArgs),
  }))
  try { await payload.db.migrate({ migrations: runnable }) }
  finally { await payload.destroy() }
  // Match Payload's own CLI: this adapter retains its initialization PG client
  // after destroy(). All migration transactions above have completed before exit.
  console.log('CMS release migrations complete.')
  process.exit(0)
} catch {
  console.error('CMS release migration failed; inspect the protected runtime configuration and database state.')
  process.exit(1)
}
