import type { Payload, PayloadRequest } from 'payload'
import { deliveryConfig, enqueueMessage } from './outbox'
import { invitationTtlMs, type GrantRole } from './policy'
import { hashToken, newToken, tokenShape } from './tokens'
import { pool } from './visibility'

type Application = { id: number | string; name: string; contactEmail: string; grantRole?: GrantRole | null }

/**
 * Create a single-use invitation for an approved application. Only the SHA-256 of the token is
 * stored. The plaintext link goes solely into the local file mirror of the outbox message.
 * No Keycloak account is created here; an operator provisions the realm user (docs/member-lifecycle.md).
 */
export async function issueInvitation(payload: Payload, application: Application, req?: PayloadRequest): Promise<{ token: string; invitationId: number }> {
  if (application.grantRole !== 'current-member' && application.grantRole !== 'alumni') throw new Error('Choose the role this invitation grants.')
  const { origin } = deliveryConfig()
  const token = newToken()
  const expiresAt = new Date(Date.now() + invitationTtlMs())
  const invitation = await payload.create({
    collection: 'member-invitations', overrideAccess: true, req,
    data: { application: Number(application.id), tokenHash: hashToken(token), role: application.grantRole, status: 'pending', expiresAt: expiresAt.toISOString() },
  })
  await enqueueMessage(payload, {
    kind: 'invitation', recipientEmail: application.contactEmail, recipientLabel: application.name,
    subject: 'Your Terrace invitation',
    body: `Your Terrace application was approved. An invitation was issued and expires ${expiresAt.toISOString().slice(0, 10)}. The one-time link is delivered separately by a Terrace operator; it is not stored in this record.`,
    mirrorBody: `Your Terrace application was approved.\nOpen this one-time link before ${expiresAt.toISOString().slice(0, 10)}:\n${origin}/join/#${token}\n`,
    invitationId: Number(invitation.id),
  }, req)
  return { token, invitationId: Number(invitation.id) }
}

export type Redeemed = { role: GrantRole; invitationId: number; name: string }

/**
 * Check a token without consuming it. Unknown, malformed, expired, redeemed or revoked tokens all
 * return null so a caller cannot tell them apart. An expired pending invitation is marked expired.
 */
export async function inspectInvitation(payload: Payload, token: unknown): Promise<Redeemed | null> {
  if (typeof token !== 'string' || !tokenShape.test(token)) return null
  const found = await payload.find({ collection: 'member-invitations', where: { tokenHash: { equals: hashToken(token) } }, limit: 1, depth: 1, overrideAccess: true })
  const invitation = found.docs[0]
  if (!invitation || invitation.status !== 'pending') return null
  if (new Date(invitation.expiresAt).getTime() <= Date.now()) {
    await pool(payload).query(`UPDATE member_invitations SET status = 'expired' WHERE id = $1 AND status = 'pending'`, [invitation.id])
    return null
  }
  const application = typeof invitation.application === 'object' ? invitation.application : null
  return { role: invitation.role, invitationId: Number(invitation.id), name: application?.name ?? 'Terran' }
}

/** Consume a token exactly once. The conditional UPDATE makes concurrent redemptions race-safe. */
export async function redeemInvitation(payload: Payload, token: unknown): Promise<Redeemed | null> {
  const inspected = await inspectInvitation(payload, token)
  if (!inspected) return null
  const result = await pool(payload).query(
    `UPDATE member_invitations SET status = 'redeemed', redeemed_at = now() WHERE id = $1 AND status = 'pending' AND expires_at > now()`, [inspected.invitationId])
  return (result.rowCount ?? 0) === 1 ? inspected : null
}
