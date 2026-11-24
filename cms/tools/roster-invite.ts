// Bulk roster onboarding: turn a CSV of members and alumni into approved applications and invitations. Operator-only and opt-in;
// nothing is sent anywhere (the operator delivers each link from the outbox mirror files). See docs/member-lifecycle.md, "Bulk roster onboarding".
//   bun tools/roster-invite.ts [dry-run] --file CSV --operator ID_OR_EMAIL --report OUT.json [--limit N] [--reinvite-lapsed]
//   bun tools/roster-invite.ts apply     --file CSV --operator ID_OR_EMAIL --plan-sha256 HASH [--limit N] [--reinvite-lapsed] [--report OUT.json] [--confirm-production]
//   bun tools/roster-invite.ts rollback  --run RUN_ID --operator ID_OR_EMAIL [--report OUT.json] [--confirm-production]
// CSV and reports live in an owner-only directory outside every Git checkout. Terminal output is aggregate counts and hashes only.
// The release bundle runs this same file, built for Node, as `bin/roster-invite` (tools/release/README.md, "Operator tools").
import { getPayload } from 'payload'
import { cmsRuntimeOrigin } from '../src/runtime-policy'
import { applyRoster, ERASED_NOTICE, parseRoster, planRoster, resolveOperator, rollbackRoster, RosterError, ROSTER_DEFAULT_LIMIT, ROSTER_HARD_MAX, ROSTER_MAX_BYTES } from '../src/lifecycle/roster'
import { checkPrivateOutput, OutputRefused, readPrivateInput, writePrivateJson } from '../../web/tools/private-output'
import { productionTarget } from './local-database'

export const usage = 'Usage: roster-invite.ts [dry-run] --file CSV --operator ID_OR_EMAIL --report OUT.json [--limit N] [--reinvite-lapsed] | apply --file CSV --operator ID_OR_EMAIL --plan-sha256 HASH [--limit N] [--reinvite-lapsed] [--report OUT.json] [--confirm-production] | rollback --run RUN_ID --operator ID_OR_EMAIL [--report OUT.json] [--confirm-production]'
const valueFlags = new Set(['--file', '--report', '--operator', '--plan-sha256', '--limit', '--run'])
const boolFlags = new Set(['--confirm-production', '--reinvite-lapsed'])
const commands = ['dry-run', 'apply', 'rollback']

export type Args = { command: 'dry-run' | 'apply' | 'rollback'; values: Record<string, string>; confirmProduction: boolean; reinviteLapsed: boolean }

export function parseArgs(argv: string[]): Args {
  const fail = (): never => { throw new RosterError('usage') }
  const command = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'dry-run'
  if (!commands.includes(command)) fail()
  const rest = argv[0] && !argv[0].startsWith('--') ? argv.slice(1) : argv
  const values: Record<string, string> = {}
  let confirmProduction = false, reinviteLapsed = false
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i]
    if (flag === '--confirm-production' && !confirmProduction) confirmProduction = true
    else if (flag === '--reinvite-lapsed' && !reinviteLapsed) reinviteLapsed = true
    else if (valueFlags.has(flag) && rest[i + 1] && !rest[i + 1].startsWith('--') && !(flag in values)) values[flag] = rest[++i]
    else fail()
  }
  const allowed: Record<string, string[]> = {
    'dry-run': ['--file', '--operator', '--report', '--limit', '--reinvite-lapsed'],
    apply: ['--file', '--operator', '--plan-sha256', '--limit', '--reinvite-lapsed', '--report', '--confirm-production'],
    rollback: ['--run', '--operator', '--report', '--confirm-production'],
  }
  const given = [...Object.keys(values), ...(confirmProduction ? ['--confirm-production'] : []), ...(reinviteLapsed ? ['--reinvite-lapsed'] : [])]
  if (given.some((flag) => !allowed[command].includes(flag))) fail()
  const need = command === 'dry-run' ? ['--file', '--operator', '--report'] : command === 'apply' ? ['--file', '--operator', '--plan-sha256'] : ['--run', '--operator']
  if (need.some((flag) => !values[flag])) fail()
  if (values['--limit'] !== undefined && !/^[1-9]\d{0,3}$/.test(values['--limit'])) fail()
  if (values['--plan-sha256'] !== undefined && !/^[0-9a-f]{64}$/.test(values['--plan-sha256'])) fail()
  if (values['--run'] !== undefined && !/^[A-Za-z0-9._-]{1,64}$/.test(values['--run'])) fail()
  return { command: command as Args['command'], values, confirmProduction, reinviteLapsed }
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
  const { production, publicDeployment } = productionTarget(env)
  if (!production) return { production }
  if (!publicDeployment) throw new RosterError('production-configuration-missing')
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
  'plan-mismatch': 'The plan hash does not match what a dry run of this file, limit, operator, database and set of rows to create would show now. Re-run the dry run and pass its planSha256.',
  'run-in-progress': 'A roster run is still marked running. Wait for it, or retry after it has gone stale.',
  'limit-invalid': 'The limit is not valid.',
  'secret-missing': 'PAYLOAD_SECRET is not set.',
  'operator-not-found': 'The operator is not an existing staff account.',
  'operator-not-administrator': 'The operator must be an administrator.',
  'run-not-found': 'No such roster run.',
  'production-configuration-missing': 'The database is not local but CMS_PUBLIC_DEPLOYMENT is not 1. Use the production configuration.',
  'production-configuration-invalid': 'The production configuration is invalid.',
  'confirm-production-required': 'This is a production target. Pass --confirm-production.',
}

/** Print the run's summary first, then write the private report: a report that cannot be written never hides what was done. Returns the exit code. */
export function emitResult(summary: Record<string, unknown>, report: unknown, reportPath: string | undefined): number {
  console.log(JSON.stringify(summary, null, 2))
  if (!reportPath) return 0
  try { writePrivateJson(reportPath, JSON.stringify(report, null, 2) + '\n'); return 0 } catch (error) {
    console.error(error instanceof OutputRefused ? error.message : 'The report could not be written.')
    console.error('The work was already done; the run id and counts are in the summary printed above.')
    return 1
  }
}

/** The command line. The release bundle's `bin/roster-invite` runs this same function (`tools/release-roster-invite.ts`). */
export async function main(argv: string[] = process.argv.slice(2)): Promise<never> {
  let exit = 0
  let payload: Awaited<ReturnType<typeof getPayload>> | undefined
  try {
    const { command, values, confirmProduction, reinviteLapsed } = parseArgs(argv)
    const limit = values['--limit'] === undefined ? ROSTER_DEFAULT_LIMIT : Math.min(Number(values['--limit']), ROSTER_HARD_MAX)
    const parsed = command === 'rollback' ? undefined : parseRoster(readPrivateInput(values['--file'], '.csv', ROSTER_MAX_BYTES))
    if (command !== 'dry-run') productionGuard(process.env, confirmProduction)
    if (values['--report']) checkPrivateOutput(values['--report']) // before any write, so a bad report path cannot leave work done and unreported
    const { default: config } = await import('../src/payload.config')
    payload = await getPayload({ config })
    const operator = await resolveOperator(payload, values['--operator'])
    let report: unknown, summary: Record<string, unknown>
    if (command === 'dry-run') {
      const plan = await planRoster(payload, parsed!, { operatorId: operator.id, limit, reinviteLapsed })
      report = { mode: 'dry-run', notice: ERASED_NOTICE, ...plan }
      summary = { mode: 'dry-run', notice: ERASED_NOTICE, fileSha256: plan.fileSha256, planSha256: plan.planSha256, databaseIdentity: plan.databaseIdentity, clusterBound: plan.clusterBound, limit, reinviteLapsed, counts: plan.counts, reasons: plan.reasons, pendingApplications: plan.pendingApplications, liveInvitations: plan.liveInvitations, exceedsPendingCap: plan.exceedsPendingCap, operatorSsoManaged: operator.sso }
    } else if (command === 'apply') {
      const result = await applyRoster(payload, parsed!, { operator, operatorId: operator.id, planSha256: values['--plan-sha256'], limit, reinviteLapsed })
      report = { mode: 'apply', ...result }
      summary = { mode: 'apply', ...result, operatorSsoManaged: operator.sso }
      if (result.counts.failed) exit = 1
    } else {
      const result = await rollbackRoster(payload, values['--run'], operator)
      report = { mode: 'rollback', ...result }
      summary = { mode: 'rollback', ...result, operatorSsoManaged: operator.sso }
      if (!result.ok || result.filesPending) exit = 1
    }
    exit = emitResult(summary, report, values['--report']) || exit
  } catch (error) {
    // Fixed text only: errors can carry CSV content or connection strings.
    const known = error instanceof RosterError ? messages[error.code] : error instanceof OutputRefused ? error.message
      : (error as { status?: number; message?: string })?.status === 503 && /^Invitation delivery is not configured/.test((error as Error).message) ? (error as Error).message : undefined
    console.error(known ?? 'Roster tool failed. Nothing further was attempted; check the roster run journal before retrying.')
    exit = 1
  } finally { await payload?.db.destroy?.() }
  process.exit(exit)
}

if (import.meta.main) await main()
