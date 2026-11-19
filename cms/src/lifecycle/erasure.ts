import type { Payload, PayloadRequest } from 'payload'
import { enqueueMessage } from './outbox'
import { pool } from './visibility'

const REMOVED = 'Removed at the member’s request.'

/**
 * Erasure policy (see docs/member-lifecycle.md):
 *  - deleted: profile, mentorship offer, group memberships, authored stories;
 *  - anonymised in place so other members' conversations stay coherent: mentorship requests
 *    sent or received (names and the erased member's own text), names on groups they founded;
 *  - the member row becomes a tombstone (status erased, no roles, name and OIDC subject wiped) and
 *    keeps only the one-way identity hash, so a still-live realm account cannot re-enter;
 *  - linked applications are anonymised, invitations keep no personal data;
 *  - moderation snapshots of their content are blanked.
 */
export async function eraseMember(payload: Payload, memberId: number, req?: PayloadRequest) {
  const where = (field: string) => ({ [field]: { equals: memberId } })
  const counts: Record<string, number> = {}
  for (const [collection, field] of [['member-stories', 'author'], ['member-profiles', 'member'], ['mentorship-offers', 'member'], ['group-memberships', 'member']] as const) {
    const result = await payload.delete({ collection, where: where(field), overrideAccess: true, req })
    counts[collection] = result.docs.length
  }
  const q = pool(payload)
  const sent = await q.query(`UPDATE mentorship_requests SET requester_name = 'Former member', message = $2 WHERE requester_id = $1`, [memberId, REMOVED])
  const received = await q.query(`UPDATE mentorship_requests SET mentor_name = 'Former member', reply = NULL WHERE mentor_id = $1`, [memberId])
  const groups = await q.query(`UPDATE member_groups SET owner_name = 'Former member' WHERE owner_id = $1`, [memberId])
  await q.query(`UPDATE moderation_reports SET author_name = 'Former member', snapshot_title = $2, snapshot_body = $2 WHERE target_author_id = $1`, [memberId, REMOVED])
  const applications = await q.query(`UPDATE member_applications SET name = 'Erased applicant', contact_email = 'erased@terrace.invalid', note = NULL WHERE member_id = $1`, [memberId])
  await q.query(`UPDATE member_offboardings SET state = 'erased' WHERE member_id = $1`, [memberId])
  counts['mentorship-requests-sent'] = sent.rowCount ?? 0
  counts['mentorship-requests-received'] = received.rowCount ?? 0
  counts['groups-anonymised'] = groups.rowCount ?? 0
  counts['applications-anonymised'] = applications.rowCount ?? 0
  await payload.update({
    collection: 'members', id: memberId, overrideAccess: true, req,
    data: { status: 'erased', statusChangedAt: new Date().toISOString(), displayName: 'Former member', roles: [], subject: 'erased', issuer: 'erased' },
  })
  await enqueueMessage(payload, {
    kind: 'erasure-confirmation', recipientLabel: `Former member #${memberId}`,
    subject: 'Your Terrace data was erased',
    body: `Erasure of member #${memberId} is complete. Content was deleted or anonymised as described in the Terrace member-lifecycle policy. A Terrace operator must also disable the matching sign-in account in the identity realm.`,
  }, req)
  return counts
}
