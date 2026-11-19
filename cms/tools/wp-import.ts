// WordPress import applier CLI. Run through the local profile so DATABASE_URI/PAYLOAD_SECRET
// are set:  direnv exec cms tools/with-local bun tools/wp-import.ts <command> ...
//   dry-run  --plan PLAN [--report OUT.json]                 read-only: what apply would create/update/skip
//   apply    --plan PLAN [--report OUT.json] [--publish] [--run-id ID] [--overwrite-edited]
//   rollback --run ID    [--report OUT.json] [--discard-edits]
// PLAN comes from `bun web/tools/wp-import/import.ts plan`. Reports are exclusive 0600 files outside Git.
import { closeSync, constants, fstatSync, openSync, readSync } from 'node:fs'
import { getPayload } from 'payload'
import { writePrivateJson } from '../../web/tools/private-output'
import { apply, dryRun, rollback } from './wp-import/apply'

const usage = 'Usage: wp-import.ts dry-run|apply --plan PLAN [--report OUT] [--publish] [--run-id ID] [--overwrite-edited] | rollback --run ID [--report OUT] [--discard-edits] [--take-over-stale [--stale-after-minutes N]] [--allow-nonlocal-database]'
const valueFlags = new Set(['--plan', '--report', '--run-id', '--run', '--stale-after-minutes'])
const boolFlags = new Set(['--publish', '--overwrite-edited', '--discard-edits', '--take-over-stale', '--allow-nonlocal-database'])

export function parseArgs(argv: string[]) {
  const [command, ...rest] = argv
  if (!['dry-run', 'apply', 'rollback'].includes(command)) throw new Error(usage)
  const values: Record<string, string> = {}, flags = new Set<string>()
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i]
    if (boolFlags.has(flag)) flags.add(flag)
    else if (valueFlags.has(flag) && rest[i + 1] && !rest[i + 1].startsWith('--') && !(flag in values)) values[flag] = rest[++i]
    else throw new Error(usage)
  }
  if (values['--stale-after-minutes'] !== undefined && (command !== 'rollback' || !flags.has('--take-over-stale') || !(Number(values['--stale-after-minutes']) >= 0))) throw new Error(usage)
  if (command === 'rollback' ? !values['--run'] || values['--plan'] : !values['--plan'] || values['--run']) throw new Error(usage)
  return { command, values, flags }
}

/**
 * The database must be local unless the operator explicitly allows otherwise: a Unix-socket `host=` path or a
 * loopback host. An empty host is NOT local (libpq would fall back to PGHOST), and PGHOST itself must be unset or
 * local. Loopback also admits an SSH tunnel to a remote database, so the flag guards intent, not network topology.
 */
export function isLocalDatabase(uri: string | undefined, env: Record<string, string | undefined> = process.env): boolean {
  if (!uri) return false
  const local = (host: string) => host.startsWith('/') || ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host)
  try {
    const url = new URL(uri)
    if (url.searchParams.getAll('host').length > 1) return false // libpq uses the last one; do not guess
    const socket = url.searchParams.get('host')
    if (env.PGHOST && !local(env.PGHOST)) return false
    if (socket !== null) return local(socket)
    return url.hostname !== '' && local(url.hostname)
  } catch { return false }
}

function readPlan(path: string): unknown {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const stat = fstatSync(fd)
    if (!stat.isFile() || stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0 || stat.size > 128 * 1024 * 1024) throw new Error('plan-file-unsafe')
    const buffer = Buffer.alloc(stat.size)
    let offset = 0
    while (offset < stat.size) { const n = readSync(fd, buffer, offset, stat.size - offset, offset); if (n === 0) break; offset += n }
    return JSON.parse(buffer.toString('utf8'))
  } finally { closeSync(fd) }
}

if (import.meta.main) {
  let exit = 0
  let payload: Awaited<ReturnType<typeof getPayload>> | undefined
  try {
    const { command, values, flags } = parseArgs(process.argv.slice(2))
    if (!isLocalDatabase(process.env.DATABASE_URI) && !flags.has('--allow-nonlocal-database')) throw new Error('The database is not local. Pass --allow-nonlocal-database only for an approved target.')
    const { default: config } = await import('../src/payload.config')
    payload = await getPayload({ config })
    let report: unknown, summary: Record<string, unknown>
    if (command === 'rollback') {
      const result = await rollback(payload, values['--run'], { discardEdits: flags.has('--discard-edits'), takeOverStale: flags.has('--take-over-stale'), ...(values['--stale-after-minutes'] ? { staleAfterMs: Number(values['--stale-after-minutes']) * 60_000 } : {}) })
      report = result; summary = { ...result }
      if (!result.ok) exit = 1
    } else {
      const plan = readPlan(values['--plan'])
      const run = command === 'apply'
        ? await apply(payload, plan, { publish: flags.has('--publish'), runId: values['--run-id'], overwriteEdited: flags.has('--overwrite-edited') })
        : await dryRun(payload, plan, { publish: flags.has('--publish'), overwriteEdited: flags.has('--overwrite-edited') })
      report = run
      summary = { mode: run.mode, runId: run.runId, counts: { created: run.counts.created, updated: run.counts.updated, skipped: run.counts.skipped, failed: run.counts.failed, redirects: run.counts.redirects, byCollection: run.counts.byCollection } }
      if (run.counts.failed || run.counts.redirects.failed) exit = 1
    }
    if (values['--report']) writePrivateJson(values['--report'], JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify({ ...summary, reportWritten: Boolean(values['--report']) }, null, 2))
  } catch (error) {
    // Fixed text only: errors can carry plan content or connection strings.
    console.error(error instanceof Error && (error.message.startsWith('Usage') || error.message.startsWith('The database') || error.message.startsWith('Run id') || error.message.startsWith('Invalid import plan')) ? error.message : 'WordPress import failed. Nothing further was attempted; inspect the run ledger before retrying.')
    exit = 1
  } finally { await payload?.db.destroy?.() }
  process.exit(exit)
}
