import type { Payload } from 'payload'
import { graceMs } from './policy'
import { hideTargets, pool } from './visibility'

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
    const old = await q.query(`SELECT count(*)::int AS n FROM ${table} WHERE hidden_reason = 'moderation' AND hidden_at < $1`, [cutoff])
    pastGrace[collection] = Number(old.rows[0].n)
    if (options.purgeModerated && pastGrace[collection]) {
      const gone = await q.query(`DELETE FROM ${table} WHERE hidden_reason = 'moderation' AND hidden_at < $1`, [cutoff])
      purged += gone.rowCount ?? 0
    }
  }
  const offboarded = await q.query(`SELECT count(*)::int AS n FROM member_offboardings WHERE state = 'offboarded' AND grace_ends_at < now()`)
  return { invitationsExpired: expired.rowCount ?? 0, moderatedPastGrace: pastGrace, moderatedPurged: purged, offboardedPastGrace: Number(offboarded.rows[0].n) }
}
