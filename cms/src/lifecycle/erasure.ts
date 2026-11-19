import type { Payload, PayloadRequest } from 'payload'
import { markMirrored, recordMessage, redactMirrorFiles, writeMirror, type Recorded } from './outbox'
import { pool } from './visibility'

const REMOVED = 'Removed at the member’s request.'

export type Erasure = {
  counts: Record<string, number>
  /** Outbox rows whose personal columns were redacted; their mirror files are rewritten after commit. */
  redactedOutboxIds: number[]
  confirmation: Recorded
}

/**
 * Erasure policy (see docs/member-lifecycle.md). Call it inside one transaction (pass a `req` that
 * owns one); a failure anywhere leaves nothing changed. Only the database is touched here: file
 * copies are handled by `finishErasure` after the commit.
 *  - deleted: profile, mentorship offer, group memberships, authored stories;
 *  - anonymised in place so other members' conversations stay coherent: mentorship requests sent or
 *    received (names and the erased member's own text) and the founder name on groups they founded
 *    (group name and description are retained: owner decision pending);
 *  - scrubbed: legacy story reports about their stories; reports about their content; reports they
 *    filed (including snapshots and staff notes); reports of mentorship requests addressed to them;
 *    the offboarding reason and notice address; and applications, decision notes and outbox recipients;
 *  - the member row becomes a tombstone (status erased, no roles, name and OIDC subject wiped) that
 *    keeps only the one-way identity hash, so a still-live realm account cannot re-enter.
 *
 * Applications and outbox rows are matched only through links: applications linked to the member (by
 * member link or through their invitations), plus UNLINKED applications with the same contact email as
 * one of those. The offboarding notice address is free text and is never a match key.
 */
export async function eraseMember(payload: Payload, memberId: number, req?: PayloadRequest): Promise<Erasure> {
  const q = pool(payload, req)
  const counts: Record<string, number> = {}

  const storyIds = (await q.query(`SELECT id FROM member_stories WHERE author_id = $1`, [memberId])).rows.map((row) => Number(row.id))
  const linked = await q.query(`SELECT a.id, a.contact_email FROM member_applications a WHERE a.member_id = $1 UNION SELECT a.id, a.contact_email FROM member_invitations i JOIN member_applications a ON a.id = i.application_id WHERE i.member_id = $1`, [memberId])
  const ids = linked.rows.map((row) => Number(row.id))
  const emails = [...new Set(linked.rows.map((row) => String(row.contact_email).toLowerCase()))]

  for (const [collection, field] of [['member-stories', 'author'], ['member-profiles', 'member'], ['mentorship-offers', 'member'], ['group-memberships', 'member']] as const) {
    const result = await payload.delete({ collection, where: { [field]: { equals: memberId } }, overrideAccess: true, req })
    counts[collection] = result.docs.length
  }

  counts['mentorship-requests-sent'] = (await q.query(`UPDATE mentorship_requests SET requester_name = 'Former member', message = $2 WHERE requester_id = $1`, [memberId, REMOVED])).rowCount ?? 0
  // Reports of a request addressed to this member carry their name in the snapshot title.
  await q.query(`UPDATE moderation_reports SET snapshot_title = $2 WHERE target_type = 'mentorship-request' AND target_id IN (SELECT id FROM mentorship_requests WHERE mentor_id = $1)`, [memberId, REMOVED])
  counts['mentorship-requests-received'] = (await q.query(`UPDATE mentorship_requests SET mentor_name = 'Former member', reply = NULL WHERE mentor_id = $1`, [memberId])).rowCount ?? 0
  counts['groups-anonymised'] = (await q.query(`UPDATE member_groups SET owner_name = 'Former member' WHERE owner_id = $1`, [memberId])).rowCount ?? 0

  if (storyIds.length) await q.query(`UPDATE story_reports SET story_title = $2, story_body = $2, author_name = 'Former member' WHERE story_id = ANY($1::numeric[])`, [storyIds, REMOVED])
  await q.query(`UPDATE moderation_reports SET author_name = 'Former member', snapshot_title = $2, snapshot_body = $2, detail = NULL, resolution_note = NULL WHERE target_author_id = $1`, [memberId, REMOVED])
  await q.query(`UPDATE moderation_reports SET detail = NULL, resolution_note = NULL, snapshot_title = $2, snapshot_body = $2, reporter_id = NULL WHERE reporter_id = $1`, [memberId, REMOVED])
  await q.query(`UPDATE member_offboardings SET reason = NULL, notice_email = NULL, state = 'erased' WHERE member_id = $1`, [memberId])
  counts['applications-anonymised'] = (await q.query(
    `UPDATE member_applications SET name = 'Erased applicant', contact_email = 'erased@terrace.invalid', note = NULL, decision_note = NULL, class_year = NULL
     WHERE id = ANY($1::int[]) OR (member_id IS NULL AND lower(contact_email) = ANY($2::text[]))`, [ids, emails])).rowCount ?? 0
  // A still-pending invitation must not stay redeemable after its person is erased.
  counts['invitations-revoked'] = (await q.query(`UPDATE member_invitations SET status = 'revoked' WHERE status = 'pending' AND (member_id = $1 OR application_id = ANY($2::int[]))`, [memberId, ids])).rowCount ?? 0
  const outbox = await q.query(
    `UPDATE message_outbox SET recipient_email = NULL, recipient_label = 'Former member' WHERE lower(recipient_email) = ANY($1::text[]) OR recipient_label = $2 RETURNING id`, [emails, `Member #${memberId}`])
  counts['outbox-rows-redacted'] = outbox.rowCount ?? 0

  await payload.update({
    collection: 'members', id: memberId, overrideAccess: true, req,
    data: { status: 'erased', statusChangedAt: new Date().toISOString(), displayName: 'Former member', roles: [], subject: 'erased', issuer: 'erased' },
  })
  const confirmation = await recordMessage(payload, {
    kind: 'erasure-confirmation', recipientLabel: `Former member #${memberId}`,
    subject: 'Your Terrace data was erased',
    body: `Erasure of member #${memberId} is complete. Content was deleted or anonymised as described in the Terrace member-lifecycle policy. A Terrace operator must also disable the matching sign-in account in the identity realm.`,
  }, req)
  return { counts, redactedOutboxIds: outbox.rows.map((row) => Number(row.id)), confirmation }
}

/**
 * Post-commit file step: redact mirror files of the redacted outbox rows and write the confirmation
 * file. The database erasure stands whatever happens here; a failure is reported and the sweep
 * (`reconcileMirror`) completes it later.
 */
export async function finishErasure(payload: Payload, result: Erasure): Promise<{ mirror: 'complete' | 'pending' }> {
  try {
    redactMirrorFiles(result.redactedOutboxIds)
    writeMirror(result.confirmation)
    await markMirrored(payload, result.confirmation.id)
    return { mirror: 'complete' }
  } catch { return { mirror: 'pending' } }
}
