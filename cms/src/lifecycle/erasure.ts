import type { Payload, PayloadRequest } from 'payload'
import { enqueueMessage, scrubMirror } from './outbox'
import { pool } from './visibility'

/** Test seam: lets a test fail an erasure part-way to prove it is all-or-nothing. Never set outside tests. */
let probe: ((step: string) => void) | undefined
export const setErasureProbe = (value: typeof probe) => { probe = value }

const REMOVED = 'Removed at the member’s request.'

/**
 * Erasure policy (see docs/member-lifecycle.md). Run it inside one transaction (callers pass a
 * `req` that owns one); a failure anywhere leaves nothing changed.
 *  - deleted: profile, mentorship offer, group memberships, authored stories;
 *  - anonymised in place so other members' conversations stay coherent: mentorship requests sent or
 *    received (names and the erased member's own text) and the founder name on groups they founded;
 *  - scrubbed: legacy story reports about their stories, reports they filed, offboarding reason and
 *    notice address, applications and decision notes (found by member link, by invitation chain and
 *    by contact email), and the recipient of outbox messages addressed to them. Outbox rows stay;
 *    only their personal columns are redacted, and only here;
 *  - the member row becomes a tombstone (status erased, no roles, name and OIDC subject wiped) that
 *    keeps only the one-way identity hash, so a still-live realm account cannot re-enter.
 */
export async function eraseMember(payload: Payload, memberId: number, req?: PayloadRequest, options: { afterStep?: (step: string) => void } = {}) {
  const q = pool(payload, req)
  const step = (name: string) => (options.afterStep ?? probe)?.(name)
  const counts: Record<string, number> = {}

  const storyIds = (await q.query(`SELECT id FROM member_stories WHERE author_id = $1`, [memberId])).rows.map((row) => Number(row.id))
  // Applications are found by member link and through invitations, then by their contact email.
  const linked = await q.query(`SELECT a.id, a.contact_email FROM member_applications a WHERE a.member_id = $1 UNION SELECT a.id, a.contact_email FROM member_invitations i JOIN member_applications a ON a.id = i.application_id WHERE i.member_id = $1`, [memberId])
  const notice = await q.query(`SELECT notice_email FROM member_offboardings WHERE member_id = $1 AND notice_email IS NOT NULL`, [memberId])
  const emails = [...new Set([...linked.rows.map((row) => String(row.contact_email)), ...notice.rows.map((row) => String(row.notice_email))].map((email) => email.toLowerCase()))]
  step('collected')

  for (const [collection, field] of [['member-stories', 'author'], ['member-profiles', 'member'], ['mentorship-offers', 'member'], ['group-memberships', 'member']] as const) {
    const result = await payload.delete({ collection, where: { [field]: { equals: memberId } }, overrideAccess: true, req })
    counts[collection] = result.docs.length
  }
  step('deleted')

  counts['mentorship-requests-sent'] = (await q.query(`UPDATE mentorship_requests SET requester_name = 'Former member', message = $2 WHERE requester_id = $1`, [memberId, REMOVED])).rowCount ?? 0
  counts['mentorship-requests-received'] = (await q.query(`UPDATE mentorship_requests SET mentor_name = 'Former member', reply = NULL WHERE mentor_id = $1`, [memberId])).rowCount ?? 0
  counts['groups-anonymised'] = (await q.query(`UPDATE member_groups SET owner_name = 'Former member' WHERE owner_id = $1`, [memberId])).rowCount ?? 0
  step('anonymised')

  if (storyIds.length) await q.query(`UPDATE story_reports SET story_title = $2, story_body = $2, author_name = 'Former member' WHERE story_id = ANY($1::numeric[])`, [storyIds, REMOVED])
  await q.query(`UPDATE moderation_reports SET author_name = 'Former member', snapshot_title = $2, snapshot_body = $2, detail = NULL, resolution_note = NULL WHERE target_author_id = $1`, [memberId, REMOVED])
  await q.query(`UPDATE moderation_reports SET detail = NULL, reporter_id = NULL WHERE reporter_id = $1`, [memberId])
  await q.query(`UPDATE member_offboardings SET reason = NULL, notice_email = NULL, state = 'erased' WHERE member_id = $1`, [memberId])
  const ids = linked.rows.map((row) => Number(row.id))
  counts['applications-anonymised'] = (await q.query(
    `UPDATE member_applications SET name = 'Erased applicant', contact_email = 'erased@terrace.invalid', note = NULL, decision_note = NULL, class_year = NULL WHERE id = ANY($1::int[]) OR lower(contact_email) = ANY($2::text[])`, [ids, emails])).rowCount ?? 0
  await q.query(`UPDATE message_outbox SET recipient_email = NULL, recipient_label = 'Former member' WHERE lower(recipient_email) = ANY($1::text[]) OR recipient_label = $2`, [emails, `Member #${memberId}`])
  scrubMirror(emails)
  step('scrubbed')

  await payload.update({
    collection: 'members', id: memberId, overrideAccess: true, req,
    data: { status: 'erased', statusChangedAt: new Date().toISOString(), displayName: 'Former member', roles: [], subject: 'erased', issuer: 'erased' },
  })
  step('tombstoned')
  await enqueueMessage(payload, {
    kind: 'erasure-confirmation', recipientLabel: `Former member #${memberId}`,
    subject: 'Your Terrace data was erased',
    body: `Erasure of member #${memberId} is complete. Content was deleted or anonymised as described in the Terrace member-lifecycle policy. A Terrace operator must also disable the matching sign-in account in the identity realm.`,
  }, req)
  return counts
}
