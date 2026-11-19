import { createHash, randomBytes } from 'node:crypto'
import { commitTransaction, createLocalReq, initTransaction, killTransaction, type Payload, type PayloadRequest } from 'payload'
import { withApplicationLock } from './application-lock'
import { issueInvitation } from './invitations'
import { MAX_PENDING, parseApplication, type ValidApplication } from './intake-validation'
import { deliveryConfig, enqueueMessage, markMirrored, redactMirrorFiles, writeMirror } from './outbox'
import { pool } from './visibility'

/**
 * Bulk roster onboarding (docs/member-lifecycle.md, "Bulk roster onboarding"). Opt-in: nothing here runs unless an operator
 * invokes tools/roster-invite.ts. It never sends anything; invitation links reach people only through the outbox mirror files.
 */
export const ROSTER_MAX_BYTES = 1024 * 1024
export const ROSTER_MAX_ROWS = 2000
/** A single apply run never creates more than this many applications, whatever --limit says. */
export const ROSTER_HARD_MAX = 200
export const ROSTER_DEFAULT_LIMIT = 50
/** A run whose last row finished longer ago than this is taken to have crashed (the importer's stale-run rule). */
export const ROSTER_STALE_MINUTES = 30
export const ERASED_NOTICE = 'This tool cannot recognise people who asked to be erased (no identifier is kept); remove them from the roster file before running.'

export class RosterError extends Error {
  constructor(readonly code: string) { super(code) }
}

export type ParsedRow = { row: number; application?: ValidApplication; reject?: string }
export type ParsedRoster = { fileSha256: string; rows: ParsedRow[] }
export type Outcome = { row: number; outcome: 'create' | 'reject' | 'skip' | 'deferred'; reason?: string }
export type Counts = { rows: number; create: number; reject: number; skip: number; deferred: number }
export type PlanOptions = { operatorId: number; limit?: number; reinviteLapsed?: boolean }
export type RosterPlan = { fileSha256: string; planSha256: string; databaseIdentity: string; limit: number; reinviteLapsed: boolean; outcomes: Outcome[]; counts: Counts; reasons: Record<string, number>; pendingApplications: number; liveInvitations: number; exceedsPendingCap: boolean }

/** RFC 4180 records: quoted fields may hold commas, quotes (doubled) and line breaks. Throws on an unterminated quote. */
export function csvRecords(source: string): string[][] {
  const records: string[][] = []
  let field = '', record: string[] = [], quoted = false, started = false
  const endField = () => { record.push(field); field = ''; started = true }
  const endRecord = () => { endField(); records.push(record); record = []; started = false }
  for (let i = 0; i < source.length; i++) {
    const c = source[i]
    if (quoted) {
      if (c === '"') { if (source[i + 1] === '"') { field += '"'; i++ } else quoted = false } else field += c
    } else if (c === '"' && field === '') quoted = true
    else if (c === ',') endField()
    else if (c === '\n' || c === '\r') { if (c === '\r' && source[i + 1] === '\n') i++; endRecord() }
    else field += c
  }
  if (quoted) throw new RosterError('csv-unterminated-quote')
  if (started || field !== '') endRecord()
  return records
}

const columns = { name: 'name', affiliation: 'affiliation', class_year: 'classYear', contact_email: 'contactEmail' } as const
const required = ['name', 'affiliation', 'contact_email']

/**
 * Parse and validate a roster. File-level problems (encoding, header, size) throw a RosterError with a fixed code. Row-level problems
 * are recorded per row. Row numbers are spreadsheet rows: the header is row 1, the first person is row 2. Every cell is trimmed.
 * An email that appears more than once in the file rejects every row that uses it.
 */
export function parseRoster(input: Buffer): ParsedRoster {
  if (input.length > ROSTER_MAX_BYTES) throw new RosterError('file-too-large')
  let source: string
  try { source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(input) } catch { throw new RosterError('not-utf8') }
  if (source.charCodeAt(0) === 0xfeff) source = source.slice(1)
  const records = csvRecords(source)
  const header = records.shift()?.map((cell) => cell.trim().toLowerCase())
  if (!header || !required.every((name) => header.includes(name))) throw new RosterError('header-required')
  if (header.some((name) => !(name in columns)) || new Set(header).size !== header.length) throw new RosterError('header-unknown-column')
  const rows: ParsedRow[] = []
  records.forEach((cells, index) => {
    const row = index + 2
    if (cells.length === 1 && cells[0].trim() === '') return // blank line
    if (cells.length !== header.length) { rows.push({ row, reject: 'wrong-column-count' }); return }
    const fields: Record<string, unknown> = {}
    header.forEach((name, position) => { fields[columns[name as keyof typeof columns]] = cells[position].trim() })
    if (cells.some((cell) => /[\u0000-\u001f\u007f]/.test(cell.trim()))) { rows.push({ row, reject: 'invalid-fields' }); return }
    if (fields.classYear !== undefined && fields.classYear !== '' && !/^\d{4}$/.test(String(fields.classYear))) { rows.push({ row, reject: 'invalid-fields' }); return }
    const application = parseApplication(fields)
    rows.push(application ? { row, application } : { row, reject: 'invalid-fields' })
  })
  if (rows.length > ROSTER_MAX_ROWS) throw new RosterError('too-many-rows')
  const seen = new Map<string, number>()
  for (const entry of rows) if (entry.application) seen.set(entry.application.contactEmail, (seen.get(entry.application.contactEmail) ?? 0) + 1)
  for (const entry of rows) if (entry.application && seen.get(entry.application.contactEmail)! > 1) { entry.reject = 'duplicate-email-in-file'; delete entry.application }
  const fileSha256 = createHash('sha256').update(input).digest('hex')
  return { fileSha256, rows }
}

type Existing = { status: string; live: boolean; redeemed: boolean; expired: boolean; revoked: boolean }
async function existingByEmail(payload: Payload, emails: string[], req?: PayloadRequest): Promise<Map<string, Existing[]>> {
  const found = new Map<string, Existing[]>()
  if (!emails.length) return found
  const result = await pool(payload, req).query(
    `SELECT lower(a.contact_email) AS email, a.status,
            EXISTS (SELECT 1 FROM member_invitations i WHERE i.application_id = a.id AND i.status = 'redeemed') AS redeemed,
            EXISTS (SELECT 1 FROM member_invitations i WHERE i.application_id = a.id AND i.status = 'pending' AND i.expires_at > now()) AS live,
            EXISTS (SELECT 1 FROM member_invitations i WHERE i.application_id = a.id AND (i.status = 'expired' OR (i.status = 'pending' AND i.expires_at <= now()))) AS expired,
            EXISTS (SELECT 1 FROM member_invitations i WHERE i.application_id = a.id AND i.status = 'revoked') AS revoked
       FROM member_applications a WHERE lower(a.contact_email) = ANY($1::text[])`, [emails])
  for (const row of result.rows) {
    const list = found.get(String(row.email)) ?? []
    list.push({ status: String(row.status), live: Boolean(row.live), redeemed: Boolean(row.redeemed), expired: Boolean(row.expired), revoked: Boolean(row.revoked) })
    found.set(String(row.email), list)
  }
  return found
}

/**
 * Why a row must be skipped given what the database already holds for its address, or null.
 * Always skipped: a redeemed or live invitation, an approved application, a pending application. "Lapsed" history (a denied or withdrawn application,
 * an expired or revoked invitation) is skipped too unless `reinviteLapsed` is set: an operator has to choose to contact those people again.
 */
export function skipReason(existing: Existing[] | undefined, reinviteLapsed = false): string | null {
  if (!existing?.length) return null
  if (existing.some((entry) => entry.redeemed)) return 'invitation-redeemed'
  if (existing.some((entry) => entry.live)) return 'invitation-live'
  const lapsedInvitation = (entry: Existing) => entry.expired || entry.revoked
  if (existing.some((entry) => entry.status === 'approved' && !lapsedInvitation(entry))) return 'application-approved'
  if (existing.some((entry) => entry.status === 'pending')) return 'application-pending'
  if (reinviteLapsed) return null
  if (existing.some((entry) => entry.status === 'denied')) return 'previously-denied'
  if (existing.some((entry) => entry.status === 'withdrawn')) return 'application-withdrawn'
  if (existing.some((entry) => entry.revoked)) return 'invitation-revoked'
  if (existing.some((entry) => entry.expired)) return 'invitation-expired'
  return null
}

/** Identity of the database being planned against: its name and, where the server lets us read it, the cluster's system identifier. */
export async function databaseIdentity(payload: Payload, req?: PayloadRequest): Promise<string> {
  const q = pool(payload, req)
  const name = String((await q.query(`SELECT current_database() AS name`)).rows[0].name)
  let cluster = 'unavailable'
  try { cluster = String((await q.query(`SELECT system_identifier::text AS id FROM pg_control_system()`)).rows[0].id) } catch { /* not permitted or unsupported: the name alone is used */ }
  return `${name}:${cluster}`
}

/** Bound plan hash: the file, the limit, the operator, the database and exactly which rows would be created now. */
export function boundPlanHash(parts: { fileSha256: string; limit: number; operatorId: number; reinviteLapsed: boolean; databaseIdentity: string; create: number[] }): string {
  return createHash('sha256').update(`terrace-roster-plan-v2\0${JSON.stringify({ ...parts, create: [...parts.create].sort((a, b) => a - b) })}`).digest('hex')
}

/** Read-only: what an apply of this file would do right now, and the hash an apply must present. */
export async function planRoster(payload: Payload, parsed: ParsedRoster, options: PlanOptions): Promise<RosterPlan> {
  const limit = Math.min(options.limit ?? ROSTER_DEFAULT_LIMIT, ROSTER_HARD_MAX)
  const reinviteLapsed = Boolean(options.reinviteLapsed)
  const existing = await existingByEmail(payload, parsed.rows.flatMap((row) => row.application ? [row.application.contactEmail] : []))
  const outcomes: Outcome[] = []
  let creatable = 0
  for (const entry of parsed.rows) {
    if (!entry.application) { outcomes.push({ row: entry.row, outcome: 'reject', reason: entry.reject }); continue }
    const skip = skipReason(existing.get(entry.application.contactEmail), reinviteLapsed)
    if (skip) outcomes.push({ row: entry.row, outcome: 'skip', reason: skip })
    else if (creatable >= limit) outcomes.push({ row: entry.row, outcome: 'deferred', reason: 'over-limit' })
    else { creatable++; outcomes.push({ row: entry.row, outcome: 'create' }) }
  }
  const counts: Counts = { rows: outcomes.length, create: 0, reject: 0, skip: 0, deferred: 0 }
  const reasons: Record<string, number> = {}
  for (const outcome of outcomes) { counts[outcome.outcome]++; if (outcome.reason) reasons[outcome.reason] = (reasons[outcome.reason] ?? 0) + 1 }
  const q = pool(payload)
  const pendingApplications = Number((await q.query(`SELECT count(*)::int AS n FROM member_applications WHERE status = 'pending'`)).rows[0].n)
  const liveInvitations = Number((await q.query(`SELECT count(*)::int AS n FROM member_invitations WHERE status = 'pending' AND expires_at > now()`)).rows[0].n)
  const identity = await databaseIdentity(payload)
  const planSha256 = boundPlanHash({ fileSha256: parsed.fileSha256, limit, operatorId: options.operatorId, reinviteLapsed, databaseIdentity: identity, create: outcomes.filter((outcome) => outcome.outcome === 'create').map((outcome) => outcome.row) })
  return { fileSha256: parsed.fileSha256, planSha256, databaseIdentity: identity, limit, reinviteLapsed, outcomes, counts, reasons, pendingApplications, liveInvitations, exceedsPendingCap: pendingApplications + liveInvitations + counts.create > MAX_PENDING }
}

export type Operator = { id: number; label: string; sso: boolean }

/**
 * The operator must be an existing administrator. This is attribution, not authentication: nothing proves the person at the keyboard is that
 * account (the real control is who can reach the database and the production environment). Editors cannot be named: the tool issues many links
 * at once and the outbox is administrator-only. Under editorial SSO the role is read from the database row, which the SSO sign-in does not
 * refresh and which keeps no last-seen time, so a demotion in the identity provider is not seen here; `sso` says the row is SSO-managed.
 */
export async function resolveOperator(payload: Payload, reference: string): Promise<Operator> {
  const numeric = /^[1-9]\d{0,9}$/.test(reference)
  const found = await payload.find({ collection: 'users', where: numeric ? { id: { equals: Number(reference) } } : { email: { equals: reference.toLowerCase() } }, limit: 1, depth: 0, overrideAccess: true })
  const user = found.docs[0] as { id: number; role?: string; displayName?: string; identityKey?: string | null } | undefined
  if (!user) throw new RosterError('operator-not-found')
  if (user.role !== 'admin') throw new RosterError('operator-not-administrator')
  return { id: user.id, label: String(user.displayName ?? `user ${user.id}`).slice(0, 120), sso: Boolean(user.identityKey) }
}

export type ApplyResult = { runId: string | null; planSha256: string; fileSha256: string; counts: Counts & { created: number; failed: number; mirrorFailed: number }; exceedsPendingCap: boolean; reasons: Record<string, number>; notice: string }
type Seams = { beforeCommit?: (row: number) => void | Promise<void>; beforeMirror?: (row: number) => void | Promise<void> }

/** Mark runs that stopped heartbeating as failed, so a crash never blocks the next run or its own rollback. */
export async function failStaleRuns(payload: Payload): Promise<number> {
  return (await pool(payload).query(`UPDATE roster_runs SET status = 'failed', finished_at = now() WHERE status = 'running' AND updated_at < now() - ($1 || ' minutes')::interval`, [String(ROSTER_STALE_MINUTES)])).rowCount ?? 0
}

/**
 * Create approved applications and their invitations for the creatable rows of a roster, at most `limit` (and never more than ROSTER_HARD_MAX).
 * The plan hash must be the one a dry run of the same file, limit, operator, database and create set produced: it is recomputed here against the
 * live database, so a database that changed since (a row now a duplicate, another run) refuses with `plan-mismatch` and the operator re-runs the dry run.
 * Each row is one transaction under the per-address lock (shared with the apply form): the application (reviewer: the operator, decided now), then
 * `issueInvitation` (invitation and outbox row), then the journal item. The mirror file, which holds the link, is written only after the commit. Because these
 * applications are inserted already approved, the update hooks of a UI approval do not run; `issueInvitation` is what stands in for the one that matters.
 * The first failing row stops the run; rows already committed stay and are journaled.
 */
export async function applyRoster(payload: Payload, parsed: ParsedRoster, options: PlanOptions & { operator: Operator; planSha256: string; runId?: string; seams?: Seams }): Promise<ApplyResult> {
  const limit = Math.min(options.limit ?? ROSTER_DEFAULT_LIMIT, ROSTER_HARD_MAX)
  if (!Number.isInteger(limit) || limit < 1) throw new RosterError('limit-invalid')
  deliveryConfig() // fails closed: no outbox directory or no valid public origin, no invitations
  await failStaleRuns(payload)
  if (Number((await pool(payload).query(`SELECT count(*)::int AS n FROM roster_runs WHERE status = 'running'`)).rows[0].n)) throw new RosterError('run-in-progress')
  const plan = await planRoster(payload, parsed, { operatorId: options.operator.id, limit, reinviteLapsed: options.reinviteLapsed })
  if (options.planSha256 !== plan.planSha256) throw new RosterError('plan-mismatch')
  const result = (counts: ApplyResult['counts'], runId: string | null, exceeds: boolean, reasons: Record<string, number>): ApplyResult => ({ runId, planSha256: plan.planSha256, fileSha256: parsed.fileSha256, counts, exceedsPendingCap: exceeds, reasons, notice: ERASED_NOTICE })
  // Nothing to create: a no-op leaves no journal entry, so re-running a finished file changes nothing at all.
  if (!plan.counts.create) return result({ ...plan.counts, created: 0, failed: 0, mirrorFailed: 0 }, null, plan.exceedsPendingCap, plan.reasons)
  const runId = options.runId ?? `roster-${randomBytes(6).toString('hex')}`
  const run = await payload.create({ collection: 'roster-runs', overrideAccess: true, data: { runId, operator: options.operator.id, operatorLabel: options.operator.label, status: 'running', fileSha256: parsed.fileSha256, planSha256: plan.planSha256, runLimit: limit, reinviteLapsed: plan.reinviteLapsed, databaseIdentity: plan.databaseIdentity, startedAt: new Date().toISOString() } })
  const byRow = new Map(parsed.rows.map((entry) => [entry.row, entry]))
  let created = 0, failed = 0, mirrorFailed = 0
  const reasons = { ...plan.reasons }
  for (const outcome of plan.outcomes) {
    if (outcome.outcome !== 'create') continue
    const application = byRow.get(outcome.row)!.application!
    let recorded: Awaited<ReturnType<typeof issueInvitation>>['recorded']
    try {
      const skipped = await withApplicationLock(payload, application.contactEmail, async (req) => {
        const again = skipReason((await existingByEmail(payload, [application.contactEmail], req)).get(application.contactEmail), plan.reinviteLapsed)
        if (again) return again
        const doc = await payload.create({
          collection: 'member-applications', overrideAccess: true, req,
          data: { name: application.name, affiliation: application.affiliation, classYear: application.classYear, contactEmail: application.contactEmail, status: 'approved', grantRole: application.affiliation, reviewer: options.operator.id, decidedAt: new Date().toISOString(), decisionNote: `Bulk roster invitation (run ${runId}).` },
        })
        const issued = await issueInvitation(payload, { id: doc.id, name: doc.name, contactEmail: doc.contactEmail, grantRole: doc.grantRole }, req, { deferMirror: true })
        recorded = issued.recorded
        await payload.create({ collection: 'roster-run-items', overrideAccess: true, req, data: { run: run.id, rowNumber: outcome.row, application: doc.id, invitation: issued.invitationId, state: 'applied' } })
        await options.seams?.beforeCommit?.(outcome.row)
        return null
      })
      if (skipped) { plan.counts.skip++; plan.counts.create--; reasons[skipped] = (reasons[skipped] ?? 0) + 1; continue }
    } catch { failed++; break } // nothing was committed for this row and no file was written
    created++
    try {
      await options.seams?.beforeMirror?.(outcome.row)
      if (!writeMirror(recorded!)) throw new Error('no outbox directory')
      await markMirrored(payload, recorded!.id)
    } catch {
      // Committed but the link file is not in place: the invitation exists and is undeliverable (the sweep reports it). Stop; rollback revokes it.
      mirrorFailed++; failed++
      break
    }
    await pool(payload).query(`UPDATE roster_runs SET updated_at = now() WHERE id = $1`, [run.id]) // heartbeat
  }
  const counts = { ...plan.counts, create: created, created, failed, mirrorFailed }
  let exceeds = plan.exceedsPendingCap
  if (created) {
    exceeds = plan.pendingApplications + plan.liveInvitations + created > MAX_PENDING
    if (exceeds) {
      // The same once-a-day staff notice the application form uses; a failure here never undoes the run.
      try {
        await enqueueMessage(payload, { kind: 'staff-notice', recipientLabel: 'Terrace reviewers', subject: 'Roster invitations exceed the queue size', dedupeKey: `staff-notice:roster:${new Date().toISOString().slice(0, 10)}`, body: `Run ${runId} left about ${plan.pendingApplications + plan.liveInvitations + created} pending applications and live invitations, above the ${MAX_PENDING} the application queue holds. Deliver or revoke invitations.` }, undefined, { bestEffortMirror: true })
      } catch { /* already sent today, or the outbox is unavailable */ }
    }
  }
  await payload.update({ collection: 'roster-runs', id: run.id, overrideAccess: true, data: { status: failed ? 'failed' : 'completed', counts, finishedAt: new Date().toISOString() } })
  return result(counts, runId, exceeds, reasons)
}

export type RollbackResult = { ok: boolean; runId: string; status: string; items: number; revoked: number; withdrawn: number; filesRedacted: number; filesPending: boolean; refused?: { redeemed: number; linked: number } }

/** Redact the mirror files of a run's invitation messages (the existing erasure redaction), by the outbox ids recorded for the run. */
async function redactRunFiles(payload: Payload, runDatabaseId: number | string): Promise<{ filesRedacted: number; filesPending: boolean }> {
  try {
    const ids = (await pool(payload).query(`SELECT o.id FROM message_outbox o JOIN roster_run_items i ON i.invitation_id = o.invitation_id WHERE i.run_id = $1`, [runDatabaseId])).rows.map((row) => String(row.id))
    return { filesRedacted: redactMirrorFiles(ids), filesPending: false }
  } catch { return { filesRedacted: 0, filesPending: true } }
}

/**
 * Undo a run: revoke its invitations and withdraw its applications, but only when none of them was redeemed or linked to a member. If any was,
 * nothing changes and the counts say why. A `failed` run can be rolled back (a stale `running` one is first marked failed); a fresh `running` one cannot.
 * After the commit the run's link files are redacted (names and addresses removed); repeating a rollback repeats that redaction and nothing else.
 */
export async function rollbackRoster(payload: Payload, runId: string, operator: Operator): Promise<RollbackResult> {
  await failStaleRuns(payload)
  const found = await payload.find({ collection: 'roster-runs', where: { runId: { equals: runId } }, limit: 1, depth: 0, overrideAccess: true })
  const run = found.docs[0]
  if (!run) throw new RosterError('run-not-found')
  if (run.status === 'rolled-back') return { ok: true, runId, status: 'rolled-back', items: 0, revoked: 0, withdrawn: 0, ...await redactRunFiles(payload, run.id) }
  if (run.status === 'running') throw new RosterError('run-in-progress')
  const req = await createLocalReq({}, payload)
  await initTransaction(req)
  let outcome: RollbackResult
  try {
    const q = pool(payload, req)
    // Lock in the order linking uses: applications by id, then invitations by id.
    const items = (await q.query(`SELECT i.id, i.application_id, i.invitation_id FROM roster_run_items i WHERE i.run_id = $1 AND i.state = 'applied' ORDER BY i.application_id`, [run.id])).rows
    const applicationIds = items.map((row) => Number(row.application_id)).filter(Number.isFinite)
    const invitationIds = items.map((row) => Number(row.invitation_id)).filter(Number.isFinite)
    const applications = (await q.query(`SELECT id, status, member_id FROM member_applications WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE`, [applicationIds])).rows
    const invitations = (await q.query(`SELECT id, status, member_id FROM member_invitations WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE`, [invitationIds])).rows
    const redeemed = invitations.filter((row) => row.status === 'redeemed').length
    const linked = new Set([...applications.filter((row) => row.member_id != null).map((row) => `a${row.id}`), ...invitations.filter((row) => row.member_id != null).map((row) => `i${row.id}`)]).size
    if (redeemed || linked) {
      await killTransaction(req)
      return { ok: false, runId, status: String(run.status), items: items.length, revoked: 0, withdrawn: 0, filesRedacted: 0, filesPending: false, refused: { redeemed, linked } }
    }
    const revoked = (await q.query(`UPDATE member_invitations SET status = 'revoked' WHERE id = ANY($1::int[]) AND status IN ('pending', 'expired')`, [invitationIds])).rowCount ?? 0
    const withdrawn = (await q.query(`UPDATE member_applications SET status = 'withdrawn', decision_note = $2 WHERE id = ANY($1::int[]) AND status = 'approved'`, [applicationIds, `Withdrawn: bulk roster run ${runId} was rolled back.`])).rowCount ?? 0
    await q.query(`UPDATE roster_run_items SET state = 'rolled-back' WHERE run_id = $1`, [run.id])
    await q.query(`UPDATE roster_runs SET status = 'rolled-back', rolled_back_at = now(), rolled_back_by_id = $2, rolled_back_by_label = $3 WHERE id = $1`, [run.id, operator.id, operator.label])
    await commitTransaction(req)
    outcome = { ok: true, runId, status: 'rolled-back', items: items.length, revoked, withdrawn, filesRedacted: 0, filesPending: false }
  } catch (error) {
    await killTransaction(req).catch(() => undefined)
    throw error
  }
  return { ...outcome, ...await redactRunFiles(payload, run.id) }
}
