import type { Payload } from 'payload'

type Client = { query: (text: string, values?: unknown[]) => Promise<{ rowCount: number | null; rows: Array<Record<string, unknown>> }>; release: () => void }
export type LinkResult = { invitations: number; applications: number }

/**
 * Bind a member to their application and invitation, so erasure and export find them without anyone linking by hand.
 *
 * Called when the member signs in with a token whose `email` the identity realm verified. The binding is:
 *  - the realm user was created by an operator for exactly one applicant, with the applicant's contact email, and
 *    members cannot register, change that address or share it (`duplicateEmailsAllowed` is off, `editEmailAllowed`
 *    is off, and the CMS ignores an address the realm does not mark verified);
 *  - the invitation must have been REDEEMED (a person holding the one-time link accepted it) and its application
 *    approved: pending, expired, revoked or never-redeemed invitations are never bound;
 *  - a row is bound only while its `member_id` is empty, in one conditional statement: a link, once set, is never
 *    overwritten, so a second person cannot claim it. Nothing the browser sends takes part in the decision.
 * It is safe to repeat and is attempted on every authenticated call until it has bound something (a person may sign in
 * before accepting the link; the redemption then binds at their next call).
 */
export async function linkMemberToApplications(payload: Payload, memberId: number, contactEmail: string): Promise<LinkResult> {
  const client = await (payload.db as unknown as { pool: { connect: () => Promise<Client> } }).pool.connect()
  try {
    await client.query('BEGIN')
    const invitations = await client.query(
      `UPDATE member_invitations i SET member_id = $1
         FROM member_applications a
        WHERE a.id = i.application_id AND i.status = 'redeemed' AND i.member_id IS NULL
          AND a.status = 'approved' AND (a.member_id IS NULL OR a.member_id = $1) AND lower(a.contact_email) = $2
        RETURNING i.application_id`, [memberId, contactEmail.toLowerCase()])
    const applications = invitations.rows.length
      ? await client.query(`UPDATE member_applications SET member_id = $1 WHERE id = ANY($2::int[]) AND member_id IS NULL`, [memberId, invitations.rows.map((row) => Number(row.application_id))])
      : { rowCount: 0 }
    await client.query('COMMIT')
    return { invitations: invitations.rowCount ?? 0, applications: applications.rowCount ?? 0 }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally { client.release() }
}

/**
 * Backfill for members who signed in before sign-in linked automatically (or whose realm tokens carry no email).
 * Only an UNAMBIGUOUS pair is linked: a redeemed, unlinked invitation whose applicant name equals (case-insensitively) the
 * display name of exactly one member who has no linked application, and no other such invitation has that name.
 * Anything ambiguous (two applicants or two members with one name) is left for an administrator. Run by the sweep.
 */
export async function backfillLinks(payload: Payload): Promise<LinkResult & { ambiguous: number }> {
  const client = await (payload.db as unknown as { pool: { connect: () => Promise<Client> } }).pool.connect()
  try {
    await client.query('BEGIN')
    const pairs = `SELECT i.id AS invitation_id, a.id AS application_id, m.id AS member_id
         FROM member_invitations i JOIN member_applications a ON a.id = i.application_id
         JOIN members m ON lower(m.display_name) = lower(a.name) AND m.status IN ('active', 'offboarded')
        WHERE i.status = 'redeemed' AND i.member_id IS NULL AND a.member_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM member_invitations x WHERE x.member_id = m.id)
          AND NOT EXISTS (SELECT 1 FROM member_applications y WHERE y.member_id = m.id)`
    const unique = `SELECT p.* FROM (${pairs}) p
        WHERE (SELECT count(*) FROM (${pairs}) q WHERE q.member_id = p.member_id) = 1 AND (SELECT count(*) FROM (${pairs}) q WHERE q.invitation_id = p.invitation_id) = 1`
    const total = (await client.query(`SELECT count(DISTINCT invitation_id)::int AS n FROM (${pairs}) p`)).rows[0]
    const chosen = (await client.query(unique)).rows
    const invitations = chosen.length ? await client.query(`UPDATE member_invitations i SET member_id = c.member_id FROM (SELECT unnest($1::int[]) AS invitation_id, unnest($2::int[]) AS member_id) c WHERE i.id = c.invitation_id AND i.member_id IS NULL`, [chosen.map((r) => Number(r.invitation_id)), chosen.map((r) => Number(r.member_id))]) : { rowCount: 0 }
    const applications = chosen.length ? await client.query(`UPDATE member_applications a SET member_id = c.member_id FROM (SELECT unnest($1::int[]) AS application_id, unnest($2::int[]) AS member_id) c WHERE a.id = c.application_id AND a.member_id IS NULL`, [chosen.map((r) => Number(r.application_id)), chosen.map((r) => Number(r.member_id))]) : { rowCount: 0 }
    await client.query('COMMIT')
    return { invitations: invitations.rowCount ?? 0, applications: applications.rowCount ?? 0, ambiguous: Math.max(0, Number(total.n) - chosen.length) }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally { client.release() }
}
