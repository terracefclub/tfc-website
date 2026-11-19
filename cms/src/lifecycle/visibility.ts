import type { Field, Payload, Where } from 'payload'
import { isMember as isStaff } from '../access/rules'

/**
 * Hidden content is retained but excluded from every member view. `hiddenReason` is set only by
 * lifecycle code (moderation hide, offboarding); members and editors cannot write it directly.
 */
export const visible: Where = { hiddenReason: { exists: false } }

export const hiddenFields: Field[] = [
  { name: 'hiddenReason', type: 'select', options: ['moderation', 'offboarded'], admin: { readOnly: true, position: 'sidebar' }, access: { create: () => false, update: () => false, read: ({ req }) => isStaff(req.user) } },
  { name: 'hiddenAt', type: 'date', admin: { readOnly: true, position: 'sidebar' }, access: { create: () => false, update: () => false, read: ({ req }) => isStaff(req.user) } },
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
export const pool = (payload: Payload): Pool => (payload.db as unknown as { pool: Pool }).pool

/** Hide everything a member owns. Rows already hidden for another reason keep that reason. */
export async function hideMemberContent(payload: Payload, memberId: number): Promise<number> {
  let count = 0
  for (const { table, owners } of Object.values(hideTargets)) {
    const owned = owners.map((column) => `${column} = $1`).join(' OR ')
    const result = await pool(payload).query(`UPDATE ${table} SET hidden_reason = 'offboarded', hidden_at = now() WHERE (${owned}) AND hidden_reason IS NULL`, [memberId])
    count += result.rowCount ?? 0
  }
  return count
}

/** Undo only the offboarding hide. Moderation hides stay in force. */
export async function restoreMemberContent(payload: Payload, memberId: number): Promise<number> {
  let count = 0
  for (const { table, owners } of Object.values(hideTargets)) {
    const owned = owners.map((column) => `${column} = $1`).join(' OR ')
    const result = await pool(payload).query(`UPDATE ${table} SET hidden_reason = NULL, hidden_at = NULL WHERE (${owned}) AND hidden_reason = 'offboarded'`, [memberId])
    count += result.rowCount ?? 0
  }
  return count
}

export async function hideTarget(payload: Payload, collection: HideCollection, id: number): Promise<boolean> {
  const { table } = hideTargets[collection]
  const result = await pool(payload).query(`UPDATE ${table} SET hidden_reason = 'moderation', hidden_at = now() WHERE id = $1 AND hidden_reason IS NULL`, [id])
  return (result.rowCount ?? 0) > 0
}

export async function unhideTarget(payload: Payload, collection: HideCollection, id: number): Promise<boolean> {
  const { table } = hideTargets[collection]
  const result = await pool(payload).query(`UPDATE ${table} SET hidden_reason = NULL, hidden_at = NULL WHERE id = $1 AND hidden_reason = 'moderation'`, [id])
  return (result.rowCount ?? 0) > 0
}
