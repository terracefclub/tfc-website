import { commitTransaction, initTransaction, killTransaction, type Endpoint, type PayloadRequest } from 'payload'
import { isMember, memberId } from '../access/members'
import { eraseMember, finishErasure } from './erasure'
import { buildExport } from './export'
import { inspectInvitation, redeemInvitation } from './invitations'
import { erasureConfirmMs } from './policy'
import { enqueueMessage } from './outbox'
import { expireStaleApplications } from './sweep'
import { constantTimeEqual, hashToken, newToken, tokenShape } from './tokens'
import { pool } from './visibility'

const privateHeaders = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive', 'X-Content-Type-Options': 'nosniff' }
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) => Response.json(body, { status, headers: { ...privateHeaders, ...extra } })

/** Server-to-server calls from the website: a shared secret, compared in constant time, fails closed when unset. */
function intakeAuthorized(req: PayloadRequest): Response | null {
  const secret = process.env.LIFECYCLE_INTAKE_SECRET
  if (!secret || secret.length < 32) return json({ error: 'Unavailable.' }, 503)
  const given = req.headers.get('x-terrace-intake') ?? ''
  return constantTimeEqual(given, secret) ? null : json({ error: 'Forbidden.' }, 403)
}

async function body(req: PayloadRequest): Promise<Record<string, unknown> | null> {
  try {
    const value = await req.json?.()
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
  } catch { return null }
}

const emailShape = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/
const text = (value: unknown, max: number, required = false): string | null | undefined => {
  if (value == null || value === '') return required ? null : undefined
  return typeof value === 'string' && value.trim().length <= max && value.trim().length > 0 ? value.trim() : null
}
const MAX_PENDING = 500
const WARN_PENDING = Math.floor(MAX_PENDING * 0.8)
const EXPORTS_PER_HOUR = 5

export const intake = {
  async apply(req: PayloadRequest): Promise<Response> {
    const denied = intakeAuthorized(req)
    if (denied) return denied
    const data = await body(req)
    if (!data) return json({ error: 'Invalid request.' }, 400)
    const name = text(data.name, 120, true)
    const email = text(data.contactEmail, 254, true)?.toLowerCase()
    const affiliation = data.affiliation
    const note = text(data.note, 1000)
    const classYearValue = data.classYear == null || data.classYear === '' ? undefined : Number(data.classYear)
    if (!name || !email || !emailShape.test(email) || (affiliation !== 'current-member' && affiliation !== 'alumni') || note === null ||
        (classYearValue !== undefined && (!Number.isInteger(classYearValue) || classYearValue < 1904 || classYearValue > 2200))) return json({ error: 'Check the application fields.' }, 400)
    await expireStaleApplications(req.payload)
    const pending = await req.payload.count({ collection: 'member-applications', where: { status: { equals: 'pending' } }, overrideAccess: true })
    if (pending.totalDocs >= WARN_PENDING) {
      // One notice a day: the unique key makes a race harmless, and a failure here never refuses an application.
      try {
        await enqueueMessage(req.payload, { kind: 'staff-notice', recipientLabel: 'Terrace reviewers', subject: 'The application queue is nearly full', dedupeKey: `staff-notice:${new Date().toISOString().slice(0, 10)}`, body: `${pending.totalDocs} of ${MAX_PENDING} pending applications. New applications are refused at ${MAX_PENDING}. Review or deny the queue.` }, undefined, { bestEffortMirror: true })
      } catch { /* already sent today, or the outbox is unavailable */ }
    }
    if (pending.totalDocs >= MAX_PENDING) return json({ error: 'Unavailable.' }, 503)
    const duplicate = await req.payload.find({ collection: 'member-applications', where: { and: [{ status: { equals: 'pending' } }, { contactEmail: { equals: email } }] }, limit: 1, depth: 0, overrideAccess: true })
    // A repeat submission looks identical to a first one, so the form cannot be used to probe who has applied.
    if (!duplicate.totalDocs) await req.payload.create({ collection: 'member-applications', overrideAccess: true, data: { name, affiliation, classYear: classYearValue, contactEmail: email, note: note ?? undefined, status: 'pending' } })
    return json({ received: true }, 202)
  },

  async redeem(req: PayloadRequest): Promise<Response> {
    const denied = intakeAuthorized(req)
    if (denied) return denied
    const data = await body(req)
    if (!data) return json({ error: 'Invalid request.' }, 400)
    const result = data.consume === true ? await redeemInvitation(req.payload, data.token) : await inspectInvitation(req.payload, data.token)
    return result ? json({ valid: true, role: result.role, name: result.name }) : json({ valid: false }, 404)
  },
}

function requireMember(req: PayloadRequest): { id: number } | Response {
  if (!req.user) return json({ error: 'Sign in required.' }, 401)
  const id = memberId(req)
  return isMember(req) && id ? { id } : json({ error: 'Approval required.' }, 403)
}

export const own = {
  async export(req: PayloadRequest): Promise<Response> {
    const member = requireMember(req)
    if (member instanceof Response) return member
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString()
    const recent = await req.payload.count({ collection: 'data-requests', where: { and: [{ member: { equals: member.id } }, { kind: { equals: 'export' } }, { createdAt: { greater_than: hourAgo } }] }, overrideAccess: true })
    if (recent.totalDocs >= EXPORTS_PER_HOUR) return json({ error: 'Too many exports. Try again later.' }, 429, { 'Retry-After': '3600' })
    const result = await buildExport(req.payload, member.id)
    await req.payload.create({ collection: 'data-requests', overrideAccess: true, context: { memberFlow: true }, data: { member: member.id, kind: 'export', status: 'completed', requestedBy: 'member', completedAt: new Date().toISOString() } })
    return json(result, 200, { 'Content-Disposition': 'attachment; filename="terrace-member-export.json"' })
  },

  async erasure(req: PayloadRequest): Promise<Response> {
    const member = requireMember(req)
    if (member instanceof Response) return member
    const data = await body(req)
    if (!data) return json({ error: 'Invalid request.' }, 400)
    const q = pool(req.payload)
    if (data.step === 'request') {
      await q.query(`UPDATE data_requests SET status = 'expired' WHERE member_id = $1 AND kind = 'erasure' AND status = 'awaiting-confirmation'`, [member.id])
      const token = newToken()
      const expires = new Date(Date.now() + erasureConfirmMs)
      await req.payload.create({ collection: 'data-requests', overrideAccess: true, context: { memberFlow: true }, data: { member: member.id, kind: 'erasure', status: 'awaiting-confirmation', requestedBy: 'member', confirmHash: hashToken(token), confirmExpiresAt: expires.toISOString() } })
      return json({ confirmationCode: token, expiresAt: expires.toISOString() }, 201)
    }
    if (data.step === 'confirm') {
      if (typeof data.token !== 'string' || !tokenShape.test(data.token)) return json({ error: 'That confirmation is not valid.' }, 400)
      // One transaction: claiming the code, erasing and completing commit together. If anything fails
      // the claim rolls back too, so the code still works and nothing was changed.
      await initTransaction(req)
      let erasure: Awaited<ReturnType<typeof eraseMember>>
      try {
        const claimed = await pool(req.payload, req).query(
          `UPDATE data_requests SET status = 'confirmed' WHERE member_id = $1 AND kind = 'erasure' AND status = 'awaiting-confirmation' AND confirm_hash = $2 AND confirm_expires_at > now() RETURNING id`,
          [member.id, hashToken(data.token)])
        const request = claimed.rows[0]
        if (!request) { await killTransaction(req); return json({ error: 'That confirmation is not valid or has expired. Start again.' }, 400) }
        erasure = await eraseMember(req.payload, member.id, req)
        await pool(req.payload, req).query(`UPDATE data_requests SET status = 'completed', completed_at = now(), confirm_hash = NULL WHERE id = $1`, [request.id])
        await commitTransaction(req)
      } catch {
        await killTransaction(req)
        return json({ error: 'Erasure could not be completed. Nothing was erased; your code still works.' }, 503)
      }
      // Committed: the erasure stands. Files are a separate, retryable step, reported as it is.
      const { mirror } = await finishErasure(req.payload, erasure)
      return json({ erased: true, counts: erasure.counts, mirror, ...(mirror === 'pending' ? { warning: 'Your data was erased. Redacting the local message copies did not finish; an operator will complete it.' } : {}) })
    }
    return json({ error: 'Invalid request.' }, 400)
  },
}

export const lifecycleEndpoints: Endpoint[] = [
  { path: '/lifecycle/apply', method: 'post', handler: intake.apply },
  { path: '/lifecycle/redeem', method: 'post', handler: intake.redeem },
  { path: '/lifecycle/export', method: 'get', handler: own.export },
  { path: '/lifecycle/erasure', method: 'post', handler: own.erasure },
]
