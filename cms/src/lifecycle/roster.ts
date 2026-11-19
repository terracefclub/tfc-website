import { createHash, createHmac, randomBytes } from 'node:crypto'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { commitTransaction, createLocalReq, initTransaction, killTransaction, type Payload, type PayloadRequest } from 'payload'
import { issueInvitation } from './invitations'
import { MAX_PENDING, parseApplication, type ValidApplication } from './intake-validation'
import { deliveryConfig, enqueueMessage } from './outbox'
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

export class RosterError extends Error {
  constructor(readonly code: string) { super(code) }
}

export type ParsedRow = { row: number; application?: ValidApplication; reject?: string }
export type ParsedRoster = { fileSha256: string; rows: ParsedRow[]; planSha256: string }
export type Outcome = { row: number; outcome: 'create' | 'reject' | 'skip' | 'deferred'; reason?: string }
export type Counts = { rows: number; create: number; reject: number; skip: number; deferred: number }
export type RosterPlan = { fileSha256: string; planSha256: string; outcomes: Outcome[]; counts: Counts; reasons: Record<string, number>; pendingApplications: number; liveInvitations: number; exceedsPendingCap: boolean }

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

/** Plan hash: pins the exact file and what the validation decided for each row, and nothing that depends on the database. */
export function planHash(fileSha256: string, rows: ParsedRow[]): string {
  return createHash('sha256').update(`terrace-roster-plan-v1\0${fileSha256}\0${JSON.stringify(rows.map((row) => [row.row, row.reject ?? 'ok']))}`).digest('hex')
}

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
  return { fileSha256, rows, planSha256: planHash(fileSha256, rows) }
}

/** HMAC of a row under the CMS secret. Stored in the journal instead of any content; useless to anyone without the secret. */
export function rowHash(application: ValidApplication, secret = process.env.PAYLOAD_SECRET): string {
  if (!secret) throw new RosterError('secret-missing')
  return createHmac('sha256', secret).update(JSON.stringify([application.name, application.affiliation, application.classYear ?? null, application.contactEmail])).digest('hex')
}

type Existing = { status: string; live: boolean; redeemed: boolean }
async function existingByEmail(payload: Payload, emails: string[], req?: PayloadRequest): Promise<Map<string, Existing[]>> {
  const found = new Map<string, Existing[]>()
  if (!emails.length) return found
  const result = await pool(payload, req).query(
    `SELECT lower(a.contact_email) AS email, a.status,
            EXISTS (SELECT 1 FROM member_invitations i WHERE i.application_id = a.id AND i.status = 'redeemed') AS redeemed,
            EXISTS (SELECT 1 FROM member_invitations i WHERE i.application_id = a.id AND i.status = 'pending' AND i.expires_at > now()) AS live
       FROM member_applications a WHERE lower(a.contact_email) = ANY($1::text[])`, [emails])
  for (const row of result.rows) {
    const list = found.get(String(row.email)) ?? []
    list.push({ status: String(row.status), live: Boolean(row.live), redeemed: Boolean(row.redeemed) })
    found.set(String(row.email), list)
  }
  return found
}

/** Why a row must be skipped given what the database already holds for its address, or null. */
export function skipReason(existing: Existing[] | undefined): string | null {
  if (!existing?.length) return null
  if (existing.some((entry) => entry.redeemed)) return 'invitation-redeemed'
  if (existing.some((entry) => entry.live)) return 'invitation-live'
  if (existing.some((entry) => entry.status === 'approved')) return 'application-approved'
  if (existing.some((entry) => entry.status === 'pending')) return 'application-pending'
  if (existing.some((entry) => entry.status === 'denied')) return 'previously-denied'
  return null
}

/** Read-only: what an apply of this file would do right now. */
export async function planRoster(payload: Payload, parsed: ParsedRoster, limit = ROSTER_DEFAULT_LIMIT): Promise<RosterPlan> {
  const existing = await existingByEmail(payload, parsed.rows.flatMap((row) => row.application ? [row.application.contactEmail] : []))
  const outcomes: Outcome[] = []
  let creatable = 0
  for (const entry of parsed.rows) {
    if (!entry.application) { outcomes.push({ row: entry.row, outcome: 'reject', reason: entry.reject }); continue }
    const skip = skipReason(existing.get(entry.application.contactEmail))
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
  return { fileSha256: parsed.fileSha256, planSha256: parsed.planSha256, outcomes, counts, reasons, pendingApplications, liveInvitations, exceedsPendingCap: pendingApplications + liveInvitations + counts.create > MAX_PENDING }
}

/** The operator must be an existing administrator. Editors cannot run a bulk onboarding: it issues many links and the outbox is administrator-only. */
export async function resolveOperator(payload: Payload, reference: string): Promise<number> {
  const numeric = /^[1-9]\d{0,9}$/.test(reference)
  const found = await payload.find({ collection: 'users', where: numeric ? { id: { equals: Number(reference) } } : { email: { equals: reference.toLowerCase() } }, limit: 1, depth: 0, overrideAccess: true })
  const user = found.docs[0] as { id: number; role?: string } | undefined
  if (!user) throw new RosterError('operator-not-found')
  if (user.role !== 'admin') throw new RosterError('operator-not-administrator')
  return user.id
}

export type ApplyResult = { runId: string | null; planSha256: string; fileSha256: string; counts: Counts & { created: number; failed: number }; exceedsPendingCap: boolean; reasons: Record<string, number> }

function outboxFiles(directory: string): Set<string> { return new Set(existsSync(directory) ? readdirSync(directory) : []) }

/**
 * Create approved applications and their invitations for the creatable rows of a roster, at most `limit` (and never more than ROSTER_HARD_MAX).
 * Each row is one transaction that does exactly what a UI approval does: the application (reviewer: the operator, decided now), then
 * `issueInvitation` (invitation, outbox message, mirror file). An advisory lock serialises roster runs and the duplicate check is repeated
 * under it, so a row is never created twice. The first failure stops the run; rows already committed stay and are journaled.
 */
export async function applyRoster(payload: Payload, parsed: ParsedRoster, options: { operatorId: number; planSha256: string; limit?: number; runId?: string }): Promise<ApplyResult> {
  if (options.planSha256 !== parsed.planSha256) throw new RosterError('plan-mismatch')
  const limit = Math.min(options.limit ?? ROSTER_DEFAULT_LIMIT, ROSTER_HARD_MAX)
  if (!Number.isInteger(limit) || limit < 1) throw new RosterError('limit-invalid')
  const { directory } = deliveryConfig() // fails closed: no outbox directory or no valid public origin, no invitations
  rowHash({ name: 'x', affiliation: 'alumni', contactEmail: 'x@example.invalid' }) // fails before any write when the secret is missing
  const plan = await planRoster(payload, parsed, limit)
  // Nothing to create: a no-op leaves no journal entry, so re-running a finished file changes nothing at all.
  if (!plan.counts.create) return { runId: null, planSha256: parsed.planSha256, fileSha256: parsed.fileSha256, counts: { ...plan.counts, created: 0, failed: 0 }, exceedsPendingCap: plan.exceedsPendingCap, reasons: plan.reasons }
  const runId = options.runId ?? `roster-${randomBytes(6).toString('hex')}`
  const run = await payload.create({ collection: 'roster-runs', overrideAccess: true, data: { runId, operator: options.operatorId, status: 'running', fileSha256: parsed.fileSha256, planSha256: parsed.planSha256, startedAt: new Date().toISOString() } })
  const byRow = new Map(parsed.rows.map((entry) => [entry.row, entry]))
  let created = 0, failed = 0
  const reasons = { ...plan.reasons }
  for (const outcome of plan.outcomes) {
    if (outcome.outcome !== 'create') continue
    const application = byRow.get(outcome.row)!.application!
    const before = outboxFiles(directory)
    const req = await createLocalReq({}, payload)
    await initTransaction(req)
    try {
      const q = pool(payload, req)
      await q.query(`SELECT pg_advisory_xact_lock(hashtext('terrace-roster-invite'))`)
      const again = skipReason((await existingByEmail(payload, [application.contactEmail], req)).get(application.contactEmail))
      if (again) { await killTransaction(req); plan.counts.skip++; plan.counts.create--; reasons[again] = (reasons[again] ?? 0) + 1; continue }
      const doc = await payload.create({
        collection: 'member-applications', overrideAccess: true, req,
        data: { name: application.name, affiliation: application.affiliation, classYear: application.classYear, contactEmail: application.contactEmail, status: 'approved', grantRole: application.affiliation, reviewer: options.operatorId, decidedAt: new Date().toISOString(), decisionNote: `Bulk roster invitation (run ${runId}).` },
      })
      const { invitationId } = await issueInvitation(payload, { id: doc.id, name: doc.name, contactEmail: doc.contactEmail, grantRole: doc.grantRole }, req)
      await payload.create({ collection: 'roster-run-items', overrideAccess: true, req, data: { run: run.id, rowNumber: outcome.row, rowHash: rowHash(application), application: doc.id, invitation: invitationId, state: 'applied' } })
      await commitTransaction(req)
      created++
    } catch {
      await killTransaction(req).catch(() => undefined)
      // A link file written for a row whose transaction did not commit points at a token that was never stored; remove it anyway.
      for (const name of outboxFiles(directory)) if (!before.has(name)) rmSync(resolve(directory, name), { force: true })
      failed++
      break
    }
  }
  plan.counts.create = created
  const counts = { ...plan.counts, created, failed }
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
  return { runId, planSha256: parsed.planSha256, fileSha256: parsed.fileSha256, counts, exceedsPendingCap: exceeds, reasons }
}

export type RollbackResult = { ok: boolean; runId: string; status: string; items: number; revoked: number; withdrawn: number; refused?: { redeemed: number; linked: number } }

/**
 * Undo a run: revoke its invitations and withdraw its applications, but only when none of them was redeemed or linked to a member. If any was,
 * nothing changes and the counts say why. Repeating a rollback is a no-op. The undelivered link files stay in the outbox directory; their tokens are dead.
 */
export async function rollbackRoster(payload: Payload, runId: string): Promise<RollbackResult> {
  const found = await payload.find({ collection: 'roster-runs', where: { runId: { equals: runId } }, limit: 1, depth: 0, overrideAccess: true })
  const run = found.docs[0]
  if (!run) throw new RosterError('run-not-found')
  if (run.status === 'rolled-back') return { ok: true, runId, status: 'rolled-back', items: 0, revoked: 0, withdrawn: 0 }
  if (run.status === 'running') throw new RosterError('run-in-progress')
  const req = await createLocalReq({}, payload)
  await initTransaction(req)
  try {
    const q = pool(payload, req)
    await q.query(`SELECT pg_advisory_xact_lock(hashtext('terrace-roster-invite'))`)
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
      return { ok: false, runId, status: String(run.status), items: items.length, revoked: 0, withdrawn: 0, refused: { redeemed, linked } }
    }
    const revoked = (await q.query(`UPDATE member_invitations SET status = 'revoked' WHERE id = ANY($1::int[]) AND status IN ('pending', 'expired')`, [invitationIds])).rowCount ?? 0
    const withdrawn = (await q.query(`UPDATE member_applications SET status = 'withdrawn', decision_note = $2 WHERE id = ANY($1::int[]) AND status = 'approved'`, [applicationIds, `Withdrawn: bulk roster run ${runId} was rolled back.`])).rowCount ?? 0
    await q.query(`UPDATE roster_run_items SET state = 'rolled-back' WHERE run_id = $1`, [run.id])
    await q.query(`UPDATE roster_runs SET status = 'rolled-back', rolled_back_at = now() WHERE id = $1`, [run.id])
    await commitTransaction(req)
    return { ok: true, runId, status: 'rolled-back', items: items.length, revoked, withdrawn }
  } catch (error) {
    await killTransaction(req).catch(() => undefined)
    throw error
  }
}
