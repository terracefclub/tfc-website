// Bulk roster onboarding: turn a CSV of members and alumni into approved applications and invitations. Operator-only and opt-in;
// nothing is sent anywhere (the operator delivers each link from the outbox mirror files). See docs/member-lifecycle.md, "Bulk roster onboarding".
//   bun tools/roster-invite.ts [dry-run] --file CSV --report OUT.json [--limit N]
//   bun tools/roster-invite.ts apply     --file CSV --operator ID_OR_EMAIL --plan-sha256 HASH [--limit N] [--report OUT.json] [--confirm-production]
//   bun tools/roster-invite.ts rollback  --run RUN_ID --operator ID_OR_EMAIL [--report OUT.json] [--confirm-production]
// CSV and reports live in an owner-only directory outside every Git checkout. Terminal output is aggregate counts and hashes only.
import { getPayload } from 'payload'
import { cmsRuntimeOrigin } from '../src/runtime-policy'
import { applyRoster, parseRoster, planRoster, resolveOperator, rollbackRoster, RosterError, ROSTER_DEFAULT_LIMIT, ROSTER_HARD_MAX, ROSTER_MAX_BYTES } from '../src/lifecycle/roster'
import { OutputRefused, readPrivateInput, writePrivateJson } from '../../web/tools/private-output'
import { isLocalDatabase } from './local-database'

export const usage = 'Usage: roster-invite.ts [dry-run] --file CSV --report OUT.json [--limit N] | apply --file CSV --operator ID_OR_EMAIL --plan-sha256 HASH [--limit N] [--report OUT.json] [--confirm-production] | rollback --run RUN_ID --operator ID_OR_EMAIL [--report OUT.json] [--confirm-production]'
const valueFlags = new Set(['--file', '--report', '--operator', '--plan-sha256', '--limit', '--run'])
const boolFlags = new Set(['--confirm-production'])
const commands = ['dry-run', 'apply', 'rollback']

export type Args = { command: 'dry-run' | 'apply' | 'rollback'; values: Record<string, string>; confirmProduction: boolean }

export function parseArgs(argv: string[]): Args {
  const fail = (): never => { throw new RosterError('usage') }
  const command = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'dry-run'
  if (!commands.includes(command)) fail()
  const rest = argv[0] && !argv[0].startsWith('--') ? argv.slice(1) : argv
  const values: Record<string, string> = {}
  let confirmProduction = false
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i]
    if (boolFlags.has(flag) && !confirmProduction) confirmProduction = true
    else if (valueFlags.has(flag) && rest[i + 1] && !rest[i + 1].startsWith('--') && !(flag in values)) values[flag] = rest[++i]
    else fail()
  }
  const allowed: Record<string, string[]> = {
    'dry-run': ['--file', '--report', '--limit'],
    apply: ['--file', '--operator', '--plan-sha256', '--limit', '--report', '--confirm-production'],
    rollback: ['--run', '--operator', '--report', '--confirm-production'],
  }
  const given = [...Object.keys(values), ...(confirmProduction ? ['--confirm-production'] : [])]
  if (given.some((flag) => !allowed[command].includes(flag))) fail()
  const need = command === 'dry-run' ? ['--file', '--report'] : command === 'apply' ? ['--file', '--operator', '--plan-sha256'] : ['--run', '--operator']
  if (need.some((flag) => !values[flag])) fail()
  if (values['--limit'] !== undefined && !/^[1-9]\d{0,3}$/.test(values['--limit'])) fail()
  if (values['--plan-sha256'] !== undefined && !/^[0-9a-f]{64}$/.test(values['--plan-sha256'])) fail()
  if (values['--run'] !== undefined && !/^[A-Za-z0-9._-]{1,64}$/.test(values['--run'])) fail()
  return { command: command as Args['command'], values, confirmProduction }
}

/**
 * Safety model for writes. This tool is meant to run against production, so instead of refusing non-local databases it requires, for a
 * production target (CMS_PUBLIC_DEPLOYMENT=1 or a database that is not local):
 *  - the public-deployment configuration to be present and valid (the same validator the CMS runtime uses), so a remote database never
 *    gets the local-development profile;
 *  - the explicit --confirm-production flag.
 * Apply additionally requires --plan-sha256 from a prior dry run of the identical file, in every environment.
 */
export function productionGuard(env: Record<string, string | undefined>, confirmProduction: boolean): { production: boolean } {
  const production = env.CMS_PUBLIC_DEPLOYMENT === '1' || !isLocalDatabase(env.DATABASE_URI, env)
  if (!production) return { production }
  if (env.CMS_PUBLIC_DEPLOYMENT !== '1') throw new RosterError('production-configuration-missing')
  try { cmsRuntimeOrigin(env as NodeJS.ProcessEnv) } catch { throw new RosterError('production-configuration-invalid') }
  if (!confirmProduction) throw new RosterError('confirm-production-required')
  return { production }
}

const messages: Record<string, string> = {
  usage,
  'csv-unterminated-quote': 'The CSV has an unterminated quoted field.',
  'file-too-large': 'The CSV is too large.',
  'not-utf8': 'The CSV is not valid UTF-8.',
  'header-required': 'The CSV needs a header row with name, affiliation and contact_email (class_year is optional).',
  'header-unknown-column': 'The CSV header has an unknown or repeated column. Allowed: name, affiliation, class_year, contact_email.',
  'too-many-rows': 'The CSV has too many rows.',
  'plan-mismatch': 'The plan hash does not match this file. Run a dry run on this exact file and pass its planSha256.',
  'limit-invalid': 'The limit is not valid.',
  'secret-missing': 'PAYLOAD_SECRET is not set.',
  'operator-not-found': 'The operator is not an existing staff account.',
  'operator-not-administrator': 'The operator must be an administrator.',
  'run-not-found': 'No such roster run.',
  'run-in-progress': 'That roster run is still marked running.',
  'production-configuration-missing': 'The database is not local but CMS_PUBLIC_DEPLOYMENT is not 1. Use the production configuration.',
  'production-configuration-invalid': 'The production configuration is invalid.',
  'confirm-production-required': 'This is a production target. Pass --confirm-production.',
}

if (import.meta.main) {
  let exit = 0
  let payload: Awaited<ReturnType<typeof getPayload>> | undefined
  try {
    const { command, values, confirmProduction } = parseArgs(process.argv.slice(2))
    const limit = values['--limit'] === undefined ? ROSTER_DEFAULT_LIMIT : Math.min(Number(values['--limit']), ROSTER_HARD_MAX)
    const parsed = command === 'rollback' ? undefined : parseRoster(readPrivateInput(values['--file'], '.csv', ROSTER_MAX_BYTES))
    if (command !== 'dry-run') productionGuard(process.env, confirmProduction)
    if (command === 'apply' && values['--plan-sha256'] !== parsed!.planSha256) throw new RosterError('plan-mismatch')
    const { default: config } = await import('../src/payload.config')
    payload = await getPayload({ config })
    let report: unknown, summary: Record<string, unknown>
    if (command === 'dry-run') {
      const plan = await planRoster(payload, parsed!, limit)
      report = { mode: 'dry-run', limit, ...plan }
      summary = { mode: 'dry-run', fileSha256: plan.fileSha256, planSha256: plan.planSha256, limit, counts: plan.counts, reasons: plan.reasons, pendingApplications: plan.pendingApplications, liveInvitations: plan.liveInvitations, exceedsPendingCap: plan.exceedsPendingCap }
    } else if (command === 'apply') {
      const operatorId = await resolveOperator(payload, values['--operator'])
      const result = await applyRoster(payload, parsed!, { operatorId, planSha256: values['--plan-sha256'], limit })
      report = { mode: 'apply', ...result }
      summary = { mode: 'apply', ...result }
      if (result.counts.failed) exit = 1
    } else {
      await resolveOperator(payload, values['--operator'])
      const result = await rollbackRoster(payload, values['--run'])
      report = { mode: 'rollback', ...result }
      summary = { mode: 'rollback', ...result }
      if (!result.ok) exit = 1
    }
    if (values['--report']) writePrivateJson(values['--report'], JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify({ ...summary, reportWritten: Boolean(values['--report']) }, null, 2))
  } catch (error) {
    // Fixed text only: errors can carry CSV content or connection strings.
    const known = error instanceof RosterError ? messages[error.code] : error instanceof OutputRefused ? error.message
      : (error as { status?: number; message?: string })?.status === 503 && /^Invitation delivery is not configured/.test((error as Error).message) ? (error as Error).message : undefined
    console.error(known ?? 'Roster tool failed. Nothing further was attempted; check the roster run journal before retrying.')
    exit = 1
  } finally { await payload?.db.destroy?.() }
  process.exit(exit)
}
