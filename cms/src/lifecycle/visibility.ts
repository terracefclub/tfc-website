import type { Field, Payload, PayloadRequest, Where } from 'payload'
import { isMember as isStaff } from '../access/rules'

/**
 * Content can be hidden for two independent reasons that never interfere: its owner was offboarded
 * (`offboardHiddenAt`) or a moderator hid it (`moderationHiddenAt`). It is visible to members only
 * when both are empty, so clearing one reason can never expose content still hidden for the other.
 * Only lifecycle code writes these fields.
 */
export const visible: Where = { and: [{ offboardHiddenAt: { exists: false } }, { moderationHiddenAt: { exists: false } }] }

const staffOnly = { create: () => false, update: () => false, read: ({ req }: { req: { user?: unknown } }) => isStaff(req.user) }
export const hiddenFields: Field[] = [
  { name: 'offboardHiddenAt', type: 'date', admin: { readOnly: true, position: 'sidebar' }, access: staffOnly },
  { name: 'moderationHiddenAt', type: 'date', admin: { readOnly: true, position: 'sidebar' }, access: staffOnly },
]

export const hideTargets = {
  'member-profiles': { table: 'member_profiles', owners: ['member_id'] },
  'member-stories': { table: 'member_stories', owners: ['author_id'] },
  'member-groups': { table: 'member_groups', owners: ['owner_id'] },
  'mentorship-offers': { table: 'mentorship_offers', owners: ['member_id'] },
  'mentorship-requests': { table: 'mentorship_requests', owners: ['requester_id', 'mentor_id'] },
} as const
export type HideCollection = keyof typeof hideTargets

type Pool = { query: (text: string, values?: unknown[]) => Promise<{ rowCount: number | null; rows: Array<Record<string, unknown>> }> }
/**
 * Raw SQL on the connection that belongs to `req`'s transaction when there is one, so lifecycle
 * changes commit or roll back together with the Payload operations around them.
 */
export function pool(payload: Payload, req?: Pick<PayloadRequest, 'transactionID'>): Pool {
  const db = payload.db as unknown as { pool: Pool; sessions?: Record<string, { db: { session: { client: Pool } } }> }
  if (!req?.transactionID) return db.pool
  const session = db.sessions?.[String(req.transactionID)]
  // Never fall back to the shared pool: that would run outside the transaction the caller relies on.
  if (!session) throw new Error('The request transaction is not available.')
  return session.db.session.client
}

const owned = (owners: readonly string[]) => owners.map((column) => `${column} = $1`).join(' OR ')

/** Hide everything a member owns because they were offboarded. */
export async function hideMemberContent(payload: Payload, memberId: number, req?: PayloadRequest): Promise<number> {
  let count = 0
  for (const { table, owners } of Object.values(hideTargets)) {
    count += (await pool(payload, req).query(`UPDATE ${table} SET offboard_hidden_at = now() WHERE (${owned(owners)}) AND offboard_hidden_at IS NULL`, [memberId])).rowCount ?? 0
  }
  return count
}

/** Undo only the offboarding reason. Anything a moderator hid stays hidden. */
export async function restoreMemberContent(payload: Payload, memberId: number, req?: PayloadRequest): Promise<number> {
  let count = 0
  for (const { table, owners } of Object.values(hideTargets)) {
    // A conversation with another offboarded member stays hidden.
    const other = table === 'mentorship_requests' ? ` AND NOT EXISTS (SELECT 1 FROM members m WHERE m.id IN (requester_id, mentor_id) AND m.id <> $1 AND m.status <> 'active')` : ''
    count += (await pool(payload, req).query(`UPDATE ${table} SET offboard_hidden_at = NULL WHERE (${owned(owners)}) AND offboard_hidden_at IS NOT NULL${other}`, [memberId])).rowCount ?? 0
  }
  return count
}

export async function hideTarget(payload: Payload, collection: HideCollection, id: number, req?: PayloadRequest): Promise<boolean> {
  const { table } = hideTargets[collection]
  return ((await pool(payload, req).query(`UPDATE ${table} SET moderation_hidden_at = now() WHERE id = $1 AND moderation_hidden_at IS NULL`, [id])).rowCount ?? 0) > 0
}

/** Undo only the moderation reason; an offboarded owner's content stays hidden. */
export async function unhideTarget(payload: Payload, collection: HideCollection, id: number, req?: PayloadRequest): Promise<boolean> {
  const { table } = hideTargets[collection]
  return ((await pool(payload, req).query(`UPDATE ${table} SET moderation_hidden_at = NULL WHERE id = $1 AND moderation_hidden_at IS NOT NULL`, [id])).rowCount ?? 0) > 0
}
