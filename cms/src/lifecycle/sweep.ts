import type { Payload } from 'payload'
import { applicationTtlMs, graceMs } from './policy'
import { hideTargets, pool } from './visibility'

/** Withdraw pending applications nobody reviewed within the (placeholder) time limit. */
export async function expireStaleApplications(payload: Payload): Promise<number> {
  const cutoff = new Date(Date.now() - applicationTtlMs()).toISOString()
  return (await pool(payload).query(`UPDATE member_applications SET status = 'withdrawn', decision_note = 'Withdrawn automatically: not reviewed in time.' WHERE status = 'pending' AND created_at < $1`, [cutoff])).rowCount ?? 0
}

/**
 * Housekeeping, safe to repeat. It always expires stale invitations and reports what is past its
 * grace period. Deleting moderation-hidden content only happens when `purgeModerated` is set,
 * because the retention period is an owner decision (docs/member-lifecycle.md).
 */
export async function sweep(payload: Payload, options: { purgeModerated?: boolean } = {}) {
  const q = pool(payload)
  const expired = await q.query(`UPDATE member_invitations SET status = 'expired' WHERE status = 'pending' AND expires_at <= now()`)
  const cutoff = new Date(Date.now() - graceMs()).toISOString()
  const pastGrace: Record<string, number> = {}
  let purged = 0
  for (const [collection, { table }] of Object.entries(hideTargets)) {
    const old = await q.query(`SELECT count(*)::int AS n FROM ${table} WHERE moderation_hidden_at < $1`, [cutoff])
    pastGrace[collection] = Number(old.rows[0].n)
  }
  if (options.purgeModerated) {
    // One transaction: memberships of a hidden group go first (group_id is NOT NULL), then the rows.
    const client = await (payload.db as unknown as { pool: { connect: () => Promise<{ query: (text: string, values?: unknown[]) => Promise<{ rowCount: number | null }>; release: () => void }> } }).pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`DELETE FROM group_memberships WHERE group_id IN (SELECT id FROM member_groups WHERE moderation_hidden_at < $1)`, [cutoff])
      await client.query(`DELETE FROM member_stories WHERE group_id IN (SELECT id FROM member_groups WHERE moderation_hidden_at < $1)`, [cutoff])
      for (const { table } of Object.values(hideTargets)) purged += (await client.query(`DELETE FROM ${table} WHERE moderation_hidden_at < $1`, [cutoff])).rowCount ?? 0
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally { client.release() }
  }
  const offboarded = await q.query(`SELECT count(*)::int AS n FROM member_offboardings WHERE state = 'offboarded' AND grace_ends_at < now()`)
  const applicationsWithdrawn = await expireStaleApplications(payload)
  return { applicationsWithdrawn, invitationsExpired: expired.rowCount ?? 0, moderatedPastGrace: pastGrace, moderatedPurged: purged, offboardedPastGrace: Number(offboarded.rows[0].n) }
}
