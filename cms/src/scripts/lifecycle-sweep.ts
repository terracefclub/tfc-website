import { getPayload } from 'payload'
import config from '../payload.config'
import { sweep, sweepExit } from '../lifecycle/sweep'

// bun src/scripts/lifecycle-sweep.ts [--purge-moderated]
// Meant for a systemd timer, so it always ends: an exit code (non-zero when something was skipped or failed), the adapter closed and an
// explicit process.exit (the Payload adapter keeps its initialisation client after destroy(), as tools/release-migrate.ts notes).
// An unref'd timer bounds a stuck run.
setTimeout(() => { console.error('lifecycle sweep timed out'); process.exit(2) }, 120_000).unref()
let code = 0
const payload = await getPayload({ config })
try {
  const summary = await sweep(payload, { purgeModerated: process.argv.includes('--purge-moderated') })
  console.log(JSON.stringify(summary, null, 2))
  const exit = sweepExit(summary as Parameters<typeof sweepExit>[0])
  for (const line of exit.lines) console.error(line)
  code = exit.code
} catch (error) {
  console.error(error instanceof Error ? error.message : 'lifecycle sweep failed')
  code = 1
} finally { await payload.destroy() }
process.exit(code)
