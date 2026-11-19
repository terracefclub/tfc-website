import type { Payload, PayloadRequest } from 'payload'
import { enqueueMessage } from './outbox'
import { hideMemberContent, restoreMemberContent } from './visibility'

/**
 * Offboard: the member row is marked so the Keycloak strategy and isMember refuse it (sign-in
 * fails closed at the CMS even if the realm user still exists), and all owned content is hidden
 * but retained for the grace period.
 */
export async function offboardMember(payload: Payload, memberId: number, notice: { email?: string | null; reason?: string | null; graceEndsAt: string }, req?: PayloadRequest) {
  await payload.update({ collection: 'members', id: memberId, data: { status: 'offboarded', statusChangedAt: new Date().toISOString() }, overrideAccess: true, req })
  const hidden = await hideMemberContent(payload, memberId, req)
  await enqueueMessage(payload, {
    kind: 'offboarding', recipientEmail: notice.email, recipientLabel: `Member #${memberId}`,
    subject: 'Your Terrace membership has ended',
    body: `Your access to the Terrace member community has been ended. Your content is hidden and kept until ${notice.graceEndsAt.slice(0, 10)}; contact Terrace before then to ask for restoration, export or erasure.`,
  }, req)
  return { hidden }
}

export async function restoreMember(payload: Payload, memberId: number, req?: PayloadRequest) {
  await payload.update({ collection: 'members', id: memberId, data: { status: 'active', statusChangedAt: new Date().toISOString() }, overrideAccess: true, req })
  return { restored: await restoreMemberContent(payload, memberId, req) }
}
