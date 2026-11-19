// Built to a Node ESM entrypoint for the release bundle (`bin/sweep`); never run by server startup.
// Same housekeeping and exit contract as `bun run lifecycle:sweep` (cms/src/scripts/lifecycle-sweep.ts), with the
// CMS runtime configuration of `bin/start`. Meant for a systemd timer, so it always ends on its own.
import type { Config } from 'payload'
Object.assign(process.env, { NODE_ENV: 'production' })
const args = process.argv.slice(2)
if (args.some(argument => argument !== '--purge-moderated')) { console.error('Usage: bin/sweep [--purge-moderated]'); process.exit(64) }
setTimeout(() => { console.error('lifecycle sweep timed out'); process.exit(2) }, 120_000).unref()
try {
  const [{ default: payload }, { default: config }, { sweep, sweepExit }, { pino }] = await Promise.all([
    import('payload'), import('../src/payload.config'), import('../src/lifecycle/sweep'), import('pino'),
  ])
  const runtimeConfig = await config
  const logger: NonNullable<Config['logger']> = pino({ level: 'silent' })
  // SanitizedConfig's deep-required logger type overconstrains optional Pino methods.
  Object.assign(runtimeConfig, { logger })
  await payload.init({ config: runtimeConfig, disableOnInit: true })
  let code = 1
  try {
    const summary = await sweep(payload, { purgeModerated: args.includes('--purge-moderated') })
    // Counts and outbox row ids only: never addresses, names or message text.
    console.log(JSON.stringify(summary))
    const exit = sweepExit(summary as Parameters<typeof sweepExit>[0])
    for (const line of exit.lines) console.error(line)
    code = exit.code
  } finally { await payload.destroy() }
  // Match Payload's own CLI: the adapter keeps its initialisation client after destroy().
  process.exit(code)
} catch {
  console.error('CMS lifecycle sweep failed; inspect the protected runtime configuration, outbox directory and database state.')
  process.exit(1)
}
