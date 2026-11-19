import type { Payload } from 'payload'

type Client = { query: (text: string, values?: unknown[]) => Promise<{ rowCount: number | null; rows: Array<Record<string, unknown>> }>; release: () => void }
type Db = { pool: { connect: () => Promise<Client>; query: Client['query'] } }
export type LinkResult = { invitations: number; applications: number }

/**
 * Bind a member to their application and invitation, so erasure and export find them without anyone linking by hand.
 *
 * Called with the member's token-verified `email` (the token is signature-checked and introspected; nothing the browser
 * sends takes part). The binding is:
 *  - the realm user was created by an operator for exactly one applicant, with the applicant's contact email (docs/member-lifecycle.md);
 *  - the invitation must have been REDEEMED and its application approved: pending, expired, revoked or never-redeemed ones are never bound;
 *  - a row is bound only while its `member_id` is empty. A link, once set, is never overwritten, so a second person cannot claim it.
 * Two applications with one address both bind to the first member who signs in with it.
 *
 * Cost and cadence: right after the member row is created it runs; afterwards (a person may sign in before accepting the link)
 * it runs only when one indexed-status query finds a redeemed, unlinked invitation for this address, so an ordinary request costs
 * one cheap read. Races: the member row is locked first (`FOR UPDATE`) and its status re-checked, so a bind can never land after an
 * erasure took the same lock (erasure locks the member first too); candidate rows are then locked applications first, then
 * invitations, each in id order, so concurrent first sign-ins queue instead of deadlocking.
 */
export async function linkMemberToApplications(payload: Payload, memberId: number, contactEmail: string, options: { created?: boolean } = {}): Promise<LinkResult> {
  const email = contactEmail.toLowerCase()
  const db = payload.db as unknown as Db
  if (!options.created) {
    const waiting = await db.pool.query(
      `SELECT 1 FROM member_invitations i JOIN member_applications a ON a.id = i.application_id
        WHERE i.status = 'redeemed' AND i.member_id IS NULL AND a.status = 'approved' AND lower(a.contact_email) = $1 LIMIT 1`, [email])
    if (!waiting.rows.length) return { invitations: 0, applications: 0 }
  }
  const client = await db.pool.connect()
  try {
    await client.query('BEGIN')
    const member = await client.query(`SELECT status FROM members WHERE id = $1 FOR UPDATE`, [memberId])
    if (!member.rows[0] || (member.rows[0].status ?? 'active') !== 'active') { await client.query('ROLLBACK'); return { invitations: 0, applications: 0 } }
    const apps = await client.query(
      `SELECT a.id FROM member_applications a
        WHERE a.status = 'approved' AND (a.member_id IS NULL OR a.member_id = $1) AND lower(a.contact_email) = $2
          AND EXISTS (SELECT 1 FROM member_invitations i WHERE i.application_id = a.id AND i.status = 'redeemed' AND i.member_id IS NULL)
        ORDER BY a.id FOR UPDATE OF a`, [memberId, email])
    const appIds = apps.rows.map((row) => Number(row.id))
    let invitations = 0, applications = 0
    if (appIds.length) {
      const locked = await client.query(`SELECT id FROM member_invitations WHERE application_id = ANY($1::int[]) AND status = 'redeemed' AND member_id IS NULL ORDER BY id FOR UPDATE`, [appIds])
      const invitationIds = locked.rows.map((row) => Number(row.id))
      if (invitationIds.length) {
        invitations = (await client.query(`UPDATE member_invitations SET member_id = $1 WHERE id = ANY($2::int[])`, [memberId, invitationIds])).rowCount ?? 0
        applications = (await client.query(`UPDATE member_applications SET member_id = $1 WHERE id = ANY($2::int[]) AND member_id IS NULL`, [memberId, appIds])).rowCount ?? 0
      }
    }
    await client.query('COMMIT')
    return { invitations, applications }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally { client.release() }
}

/** Report only: approved applications whose invitation was redeemed but that no member is linked to. An administrator links them with the member picker. */
export async function countUnlinkedRedeemed(payload: Payload): Promise<number> {
  const result = await (payload.db as unknown as Db).pool.query(
    `SELECT count(DISTINCT a.id)::int AS n FROM member_applications a JOIN member_invitations i ON i.application_id = a.id
      WHERE a.status = 'approved' AND a.member_id IS NULL AND i.status = 'redeemed' AND i.member_id IS NULL`)
  return Number(result.rows[0].n)
}
