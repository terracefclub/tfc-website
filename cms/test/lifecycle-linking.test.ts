import { afterAll, beforeAll, expect, test } from 'bun:test'
import { exportJWK, generateKeyPair, decodeJwt, SignJWT } from 'jose'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getPayload, handleEndpoints, type Payload } from 'payload'
import config from '../src/payload.config'
import { resetMemberVerifier, type KeycloakConfig } from '../src/auth/keycloak'
import { intake, own } from '../src/lifecycle/endpoints'
import { countUnlinkedRedeemed, linkMemberToApplications } from '../src/lifecycle/linking'
import { reconcileMirror } from '../src/lifecycle/outbox'
import { spawnSync } from 'node:child_process'
import { invitationState } from '../src/lifecycle/outbox'
import { sweep, sweepExit } from '../src/lifecycle/sweep'
import { pool } from '../src/lifecycle/visibility'

// A real signed token verified against a local identity stub (signature, audience and introspection), so the
// chain below runs through the same authentication strategy a signed-in member uses.
const key = await generateKeyPair('RS256')
const jwk = { ...await exportJWK(key.publicKey), kid: 'test-key', alg: 'RS256', use: 'sig' }
const server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
  const url = new URL(request.url)
  if (url.pathname.endsWith('/certs')) return Response.json({ keys: [jwk] })
  if (url.pathname.endsWith('/token/introspect')) {
    const form = await request.formData()
    return Response.json({ active: true, sub: decodeJwt(String(form.get('token'))).sub, exp: Math.floor(Date.now() / 1000) + 60 })
  }
  return new Response(null, { status: 404 })
} })
const settings: KeycloakConfig = { issuer: `http://127.0.0.1:${server.port}/realms/terrace-test`, audience: 'terrace-community', clientId: 'terrace-web', introspectionClientId: 'test-introspection', introspectionSecret: 'synthetic-secret' }
const suffix = crypto.randomUUID().slice(0, 8)
const secret = `synthetic-intake-secret-${crypto.randomUUID()}`
const outbox = mkdtempSync(join(tmpdir(), 'terrace-outbox-l-'))
let payload: Payload
let admin: any
let editor: any
const users: Array<number | string> = []
const members: number[] = []
const q = (text: string, values: unknown[] = []) => pool(payload).query(text, values)

async function signed(subject: string, claims: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ iss: settings.issuer, aud: settings.audience, sub: subject, iat: now, exp: now + 60, jti: crypto.randomUUID(), azp: settings.clientId, typ: 'Bearer', name: 'Someone', realm_access: { roles: ['alumni'] }, ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).sign(key.privateKey)
}
const signIn = async (subject: string, claims: Record<string, unknown> = {}) => {
  const result = await payload.auth({ headers: new Headers({ authorization: `Bearer ${await signed(subject, claims)}` }) })
  if (result.user) members.push(Number(result.user.id))
  return result.user as any
}
async function makeUser(role: 'admin' | 'editor') {
  const created = await payload.create({ collection: 'users', overrideAccess: true, data: { email: `${role}-l-${suffix}-${users.length}@terrace.invalid`, password: `local-${crypto.randomUUID()}`, displayName: `Linking ${role}`, role } })
  users.push(created.id)
  return { ...created, collection: 'users' }
}
async function makeMember(name: string, roles: Array<'current-member' | 'alumni'> = ['alumni']) {
  const record = await payload.create({ collection: 'members', overrideAccess: true, data: { identityKey: crypto.randomUUID(), issuer: settings.issuer, subject: crypto.randomUUID(), displayName: name, roles } })
  members.push(record.id)
  return { ...record, collection: 'members' }
}
const request = (user: any, body?: unknown, headers: Record<string, string> = {}) => ({ user, payload, headers: new Headers(headers), json: async () => body }) as any
const mirror = () => readdirSync(outbox).sort().map((file) => ({ file, text: readFileSync(join(outbox, file), 'utf8') }))
const rest = (path: string, init: RequestInit = {}) => handleEndpoints({ config, payloadInstanceCacheKey: 'linking-tests', request: new Request(`http://127.0.0.1:3010/api${path}`, init) })
const login = async (user: any, password: string) => {
  const response = await rest('/users/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: user.email, password }) })
  return (await response.json() as any).token as string | undefined
}

beforeAll(async () => {
  if (process.env.CMS_LOCAL_BOOTSTRAP !== '1') throw new Error('Lifecycle tests require isolated local data.')
  process.env.LIFECYCLE_INTAKE_SECRET = secret
  process.env.LIFECYCLE_OUTBOX_DIR = outbox
  process.env.LIFECYCLE_PUBLIC_ORIGIN = 'http://127.0.0.1:4194'
  process.env.MEMBER_AUTH_ISSUER = settings.issuer
  process.env.MEMBER_AUTH_AUDIENCE = settings.audience
  process.env.MEMBER_AUTH_CLIENT_ID = settings.clientId
  process.env.MEMBER_AUTH_INTROSPECTION_CLIENT_ID = settings.introspectionClientId
  process.env.MEMBER_AUTH_INTROSPECTION_SECRET = settings.introspectionSecret
  resetMemberVerifier()
  payload = await getPayload({ config, key: 'linking-tests' })
  admin = await makeUser('admin')
  editor = await makeUser('editor')
})

afterAll(async () => {
  // Members created by signing in (including through the REST member token) carry this run's identity-stub issuer.
  members.push(...(await q(`SELECT id FROM members WHERE issuer = $1`, [settings.issuer]).catch(() => ({ rows: [] }))).rows.map((row) => Number(row.id)))
  await q(`DELETE FROM data_requests WHERE member_id = ANY($1)`, [members]).catch(() => {})
  await q(`DELETE FROM member_offboardings WHERE member_id = ANY($1)`, [members]).catch(() => {})
  await q(`DELETE FROM message_outbox WHERE subject LIKE $1 OR recipient_label LIKE $1 OR recipient_email LIKE $1`, [`%${suffix}%`]).catch(() => {})
  await q(`DELETE FROM member_invitations WHERE application_id IN (SELECT id FROM member_applications WHERE contact_email LIKE $1 OR contact_email = 'erased@terrace.invalid' AND member_id = ANY($2))`, [`%${suffix}%`, members]).catch(() => {})
  await q(`DELETE FROM member_applications WHERE contact_email LIKE $1 OR name LIKE $1 OR member_id = ANY($2)`, [`%${suffix}%`, members]).catch(() => {})
  for (const id of members) await payload.delete({ collection: 'members', id, overrideAccess: true }).catch(() => {})
  for (const id of users) await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => {})
  for (const name of ['MEMBER_AUTH_ISSUER', 'MEMBER_AUTH_AUDIENCE', 'MEMBER_AUTH_CLIENT_ID', 'MEMBER_AUTH_INTROSPECTION_CLIENT_ID', 'MEMBER_AUTH_INTROSPECTION_SECRET']) delete process.env[name]
  resetMemberVerifier()
  rmSync(outbox, { recursive: true, force: true })
  await payload.db.destroy?.()
  server.stop(true)
})

// ---- D3: administrators can pick members; nobody else gains anything -------------------------------------------

test('the member picker: only administrators list and search members, and only by display name and status', async () => {
  const alice = await makeMember(`Picker Alice ${suffix}`, ['current-member'])
  const bob = await makeMember(`Picker Bob ${suffix}`)
  const offboarded = await makeMember(`Picker Off ${suffix}`)
  await q(`UPDATE members SET status = 'offboarded' WHERE id = $1`, [offboarded.id])
  const stale = { ...(await payload.findByID({ collection: 'members', id: offboarded.id, overrideAccess: true })), collection: 'members' }
  const unapproved = { id: bob.id, collection: 'members', status: 'active', roles: [] }
  const search = (user: any, term: string) => payload.find({ collection: 'members', where: { displayName: { like: term } }, user, overrideAccess: false, depth: 0, limit: 50 })

  // Local API
  const found = await search(admin, `Picker `)
  expect(found.docs.map((doc) => doc.displayName).sort()).toEqual([`Picker Alice ${suffix}`, `Picker Bob ${suffix}`, `Picker Off ${suffix}`].sort())
  expect((await search(admin, `Alice ${suffix}`)).docs.map((doc) => doc.id)).toEqual([alice.id])
  for (const doc of found.docs) {
    expect(Object.keys(doc).filter((key) => key !== 'collection').sort()).toEqual(['createdAt', 'displayName', 'id', 'status', 'updatedAt'])
  }
  await expect(payload.find({ collection: 'members', where: { identityKey: { equals: 'x' } }, user: admin, overrideAccess: false })).rejects.toThrow()
  await expect(payload.find({ collection: 'members', where: { subject: { like: 'x' } }, user: admin, overrideAccess: false })).rejects.toThrow()
  for (const operation of [
    () => payload.create({ collection: 'members', data: { identityKey: 'k', issuer: 'i', subject: 's', displayName: 'No' }, user: admin, overrideAccess: false }),
    () => payload.update({ collection: 'members', id: alice.id, data: { displayName: 'Renamed' }, user: admin, overrideAccess: false }),
    () => payload.delete({ collection: 'members', id: alice.id, user: admin, overrideAccess: false }),
  ]) await expect(operation()).rejects.toThrow()
  // Everyone else
  await expect(payload.find({ collection: 'members', overrideAccess: false })).rejects.toThrow() // anonymous
  await expect(search(editor, 'Picker')).rejects.toThrow()
  await expect(payload.findByID({ collection: 'members', id: alice.id, user: editor, overrideAccess: false })).rejects.toThrow()
  await expect(search(unapproved, 'Picker')).rejects.toThrow()
  await expect(search(stale, 'Picker')).rejects.toThrow() // offboarded
  const asMember = await search(alice, 'Picker')
  expect(asMember.docs.map((doc) => doc.id)).toEqual([alice.id]) // member-to-member access is unchanged
  expect(asMember.docs[0]).toHaveProperty('roles') // a member still sees their own roles
  await expect(payload.findByID({ collection: 'members', id: bob.id, user: alice, overrideAccess: false })).rejects.toThrow()

  // REST
  const adminToken = await login(admin, await passwordOf(admin))
  expect(adminToken).toBeTruthy()
  const asAdmin = await rest(`/members?where[displayName][like]=Picker&depth=0&limit=50`, { headers: { authorization: `JWT ${adminToken}` } })
  expect(asAdmin.status).toBe(200)
  const body = await asAdmin.json() as any
  expect(body.docs.length).toBe(3)
  expect(JSON.stringify(body)).not.toMatch(/identityKey|issuer|subject|roles|statusChangedAt|realms/)
  expect((await rest(`/members?where[identityKey][equals]=x`, { headers: { authorization: `JWT ${adminToken}` } })).status).toBeGreaterThanOrEqual(400)
  expect((await rest(`/members/${alice.id}`, { method: 'PATCH', headers: { authorization: `JWT ${adminToken}`, 'content-type': 'application/json' }, body: '{"displayName":"x"}' })).status).toBeGreaterThanOrEqual(400)
  expect((await rest(`/members/${alice.id}`, { method: 'DELETE', headers: { authorization: `JWT ${adminToken}` } })).status).toBeGreaterThanOrEqual(400)
  expect((await rest(`/members?limit=5`)).status).toBe(403)
  const editorToken = await login(editor, await passwordOf(editor))
  expect((await rest(`/members?limit=5`, { headers: { authorization: `JWT ${editorToken}` } })).status).toBe(403)
  expect((await rest(`/members/${alice.id}`, { headers: { authorization: `JWT ${editorToken}` } })).status).toBe(403)
  const memberJwt = await signed(String(alice.subject), { realm_access: { roles: ['current-member'] } })
  const memberList = await (await rest('/members?depth=0', { headers: { authorization: `Bearer ${memberJwt}` } })).json() as any
  expect(memberList.docs.length).toBeLessThanOrEqual(1) // a member sees only themselves
  const forged = await rest('/members?depth=0', { headers: { authorization: 'Bearer not-a-token' } })
  expect(forged.status).toBe(403)
  expect((await rest(`/members?limit=5`, { headers: { authorization: `JWT ${await login(admin, 'wrong-password') ?? 'nope'}` } })).status).toBe(403)
})

const passwords = new Map<unknown, string>()
async function passwordOf(user: any) {
  if (!passwords.has(user.id)) { const password = `local-${crypto.randomUUID()}`; await payload.update({ collection: 'users', id: user.id, data: { password }, overrideAccess: true }); passwords.set(user.id, password) }
  return passwords.get(user.id)!
}

test('the admin forms: offboarding and erasure requests choose a member on create and fix it afterwards; links stay administrator-only', async () => {
  const subject = await makeMember(`Offboard Me ${suffix}`)
  const other = await makeMember(`Other ${suffix}`)
  const field = (slug: any, name: string) => (payload.collections[slug].config.fields as any[]).find((entry) => entry.name === name)
  for (const slug of ['member-offboardings', 'data-requests']) expect(field(slug, 'member').admin?.readOnly).toBeFalsy()
  const record = await payload.create({ collection: 'member-offboardings', data: { member: subject.id, reason: `r ${suffix}` }, user: admin, overrideAccess: false })
  expect((record.member as any)?.id ?? record.member).toBe(subject.id)
  // Not changeable afterwards, whoever asks.
  const changed = await payload.update({ collection: 'member-offboardings', id: record.id, data: { member: other.id, reason: 'later' }, user: admin, overrideAccess: false })
  expect((changed.member as any)?.id ?? changed.member).toBe(subject.id)
  await expect(payload.create({ collection: 'member-offboardings', data: { member: other.id }, user: editor, overrideAccess: false })).rejects.toThrow()
  await expect(payload.create({ collection: 'member-offboardings', data: { member: other.id }, overrideAccess: false })).rejects.toThrow()
  // The link fields on an application: administrators only.
  const application = await payload.create({ collection: 'member-applications', overrideAccess: true, data: { name: `Linker ${suffix}`, affiliation: 'alumni', contactEmail: `linker-${suffix}@terrace.invalid` } })
  const linked = await payload.update({ collection: 'member-applications', id: application.id, data: { member: other.id }, user: admin, overrideAccess: false, depth: 1 })
  expect((linked.member as any).displayName).toBe(`Other ${suffix}`)
  expect(Object.keys(linked.member as any).filter((key) => key !== 'collection').sort()).toEqual(['createdAt', 'displayName', 'id', 'status', 'updatedAt'])
  const byEditor = await payload.update({ collection: 'member-applications', id: application.id, data: { member: subject.id }, user: editor, overrideAccess: false })
  expect((byEditor.member as any)?.id ?? byEditor.member ?? undefined).toBeUndefined() // an editor neither reads nor changes it
  expect((await payload.findByID({ collection: 'member-applications', id: application.id, overrideAccess: true, depth: 0 })).member).toBe(other.id)
})

// ---- D2: the chain without any manual link -----------------------------------------------------------------------

async function applyApproveRedeem(name: string, email: string, role: 'alumni' | 'current-member' = 'alumni') {
  expect((await intake.apply(request(null, { name, affiliation: 'alumni', contactEmail: email, note: `Note from ${name}` }, { 'x-terrace-intake': secret }))).status).toBe(202)
  const application = (await payload.find({ collection: 'member-applications', where: { and: [{ contactEmail: { equals: email } }, { status: { equals: 'pending' } }] }, overrideAccess: true })).docs[0]
  await payload.update({ collection: 'member-applications', id: application.id, data: { status: 'approved', grantRole: role }, user: editor, overrideAccess: false })
  const invitation = (await payload.find({ collection: 'member-invitations', where: { application: { equals: application.id } }, overrideAccess: true })).docs[0]
  const file = mirror().filter((entry) => JSON.parse(entry.text).to === email && JSON.parse(entry.text).kind === 'invitation').at(-1)!
  const token = /#([A-Za-z0-9_-]{43})/.exec(JSON.parse(file.text).body)![1]
  return { application, invitation, token }
}
const redeem = (token: string) => intake.redeem(request(null, { token, consume: true }, { 'x-terrace-intake': secret }))
const links = async (applicationId: number, invitationId: number) => ({
  application: (await q(`SELECT member_id FROM member_applications WHERE id = $1`, [applicationId])).rows[0].member_id,
  invitation: (await q(`SELECT member_id FROM member_invitations WHERE id = $1`, [invitationId])).rows[0].member_id,
})
async function everyTable(needles: string[]) {
  const tables = (await q(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT LIKE 'payload_migrations%'`)).rows.map((row) => String(row.table_name))
  const hits: string[] = []
  for (const table of tables) if (Number((await q(`SELECT count(*)::int AS n FROM "${table}" x WHERE x::text ILIKE ANY($1)`, [needles.map((needle) => `%${needle}%`)])).rows[0].n)) hits.push(table)
  return hits
}

test('apply, approve, redeem, first sign-in, erase: nothing is linked by hand and nothing is left behind', async () => {
  const name = `Ida Marsh ${suffix}`
  const email = `ida-marsh-${suffix}@terrace.invalid`
  const { application, invitation, token } = await applyApproveRedeem(name, email)
  // The outbox row carries a real foreign key to its invitation.
  expect((await q(`SELECT invitation_id FROM message_outbox WHERE kind = 'invitation' AND recipient_email = $1`, [email])).rows[0].invitation_id).toBe(invitation.id)
  expect((await redeem(token)).status).toBe(200)
  expect(await links(application.id, invitation.id)).toEqual({ application: null, invitation: null }) // no identity yet: nothing to bind
  // First sign-in: the realm user an operator created for this applicant (verified email) creates the member row and binds both.
  const member = await signIn(`sub-ida-${suffix}`, { name, email, email_verified: true })
  expect(member).toBeTruthy()
  expect(await links(application.id, invitation.id)).toEqual({ application: member.id, invitation: member.id })
  expect(member).not.toHaveProperty('contactEmail')
  expect((await payload.findByID({ collection: 'members', id: member.id, overrideAccess: true }))).not.toHaveProperty('email')
  // The member can read exactly those two records now.
  expect((await payload.find({ collection: 'member-applications', user: member, overrideAccess: false })).docs.map((doc) => doc.id)).toEqual([application.id])

  const needles = [`Ida Marsh ${suffix}`, `ida-marsh-${suffix}`, `Note from Ida`]
  expect((await everyTable(needles)).length).toBeGreaterThan(2)
  expect(mirror().some((entry) => entry.text.includes(email))).toBe(true)

  const code = (await (await own.erasure(request(member, { step: 'request' }))).json() as any).confirmationCode
  const done = await own.erasure(request(member, { step: 'confirm', token: code }))
  expect(done.status).toBe(200)
  expect(((await done.json()) as any).counts['applications-anonymised']).toBe(1)
  await sweep(payload)
  expect(await everyTable(needles)).toEqual([])
  for (const entry of mirror()) expect(entry.text).not.toMatch(new RegExp(`ida-marsh-${suffix}|Ida Marsh`, 'i'))
  expect((await q(`SELECT name, contact_email, note FROM member_applications WHERE id = $1`, [application.id])).rows[0]).toEqual({ name: 'Erased applicant', contact_email: 'erased@terrace.invalid', note: null })
})

test('binding refuses what it cannot vouch for, never overwrites a link, and cannot be claimed by another person', async () => {
  const email = `binder-${suffix}@terrace.invalid`
  const { application, invitation, token } = await applyApproveRedeem(`Binder ${suffix}`, email)
  const unbound = { application: null, invitation: null }
  // Signing in before the link is accepted: nothing is bound (the invitation is still pending).
  const early = await signIn(`sub-binder-${suffix}`, { name: `Binder ${suffix}`, email, email_verified: true })
  expect(await links(application.id, invitation.id)).toEqual(unbound)
  // A token without a verified email, or with someone else's, binds nothing; the other member's own address is not ours.
  expect((await redeem(token)).status).toBe(200)
  await signIn(`sub-binder-${suffix}`, { name: `Binder ${suffix}`, email, email_verified: false })
  await signIn(`sub-binder-${suffix}`, { name: `Binder ${suffix}` })
  const thief = await signIn(`sub-thief-${suffix}`, { name: `Binder ${suffix}`, email: `thief-${suffix}@terrace.invalid`, email_verified: true })
  expect(await links(application.id, invitation.id)).toEqual(unbound)
  // The accepted link is then bound by the next verified sign-in of the real person.
  await signIn(`sub-binder-${suffix}`, { name: `Binder ${suffix}`, email, email_verified: true })
  expect(await links(application.id, invitation.id)).toEqual({ application: early.id, invitation: early.id })
  // Once bound it stays: a different member presenting the same address takes nothing (and it is unaffected by case).
  await signIn(`sub-thief-${suffix}`, { name: `Binder ${suffix}`, email: email.toUpperCase(), email_verified: true })
  expect(await links(application.id, invitation.id)).toEqual({ application: early.id, invitation: early.id })
  expect(thief.id).not.toBe(early.id)
  // Pending, expired and revoked invitations are never bound.
  const pending = await applyApproveRedeem(`Pending ${suffix}`, `pending-${suffix}@terrace.invalid`)
  await signIn(`sub-pending-${suffix}`, { name: `Pending ${suffix}`, email: `pending-${suffix}@terrace.invalid`, email_verified: true })
  await q(`UPDATE member_invitations SET status = 'revoked' WHERE id = $1`, [pending.invitation.id])
  await signIn(`sub-pending-${suffix}`, { name: `Pending ${suffix}`, email: `pending-${suffix}@terrace.invalid`, email_verified: true })
  expect(await links(pending.application.id, pending.invitation.id)).toEqual(unbound)
  // An administrator's manual link is not overwritten either.
  const manual = await applyApproveRedeem(`Manual ${suffix}`, `manual-${suffix}@terrace.invalid`)
  await redeem(manual.token)
  const chosen = await makeMember(`Chosen ${suffix}`)
  await payload.update({ collection: 'member-invitations', id: manual.invitation.id, data: { member: chosen.id }, user: admin, overrideAccess: false })
  await signIn(`sub-manual-${suffix}`, { name: `Manual ${suffix}`, email: `manual-${suffix}@terrace.invalid`, email_verified: true })
  expect((await links(manual.application.id, manual.invitation.id)).invitation).toBe(chosen.id)
})

test('nothing is ever linked by guessing from names: a same-named member is not bound by sweeps, and the sweep only reports', async () => {
  const one = await applyApproveRedeem(`Samename ${suffix}`, `same-${suffix}@terrace.invalid`)
  await redeem(one.token)
  const impostor = await makeMember(`samename ${suffix}`) // another person who chose, or happens to share, the applicant's name
  const before = await countUnlinkedRedeemed(payload)
  expect(before).toBeGreaterThanOrEqual(1)
  const summary = await sweep(payload)
  expect(summary).not.toHaveProperty('links')
  expect(summary.unlinkedRedeemedApplications).toBeGreaterThanOrEqual(1)
  expect(await links(one.application.id, one.invitation.id)).toEqual({ application: null, invitation: null })
  // The impostor cannot read the application, and the real person can still be bound at their own verified sign-in.
  expect((await payload.find({ collection: 'member-applications', user: impostor, overrideAccess: false })).docs.map((doc) => doc.id)).not.toContain(one.application.id)
  const real = await signIn(`sub-same-${suffix}`, { name: `Samename ${suffix}`, email: `same-${suffix}@terrace.invalid`, email_verified: true })
  expect(await links(one.application.id, one.invitation.id)).toEqual({ application: real.id, invitation: real.id })
  expect(JSON.stringify(summary)).not.toContain(suffix) // counts only: no names or emails
})

test('binding is bounded: an ordinary request runs one read, and a sign-in racing an erasure never binds afterwards', async () => {
  const email = `race-${suffix}@terrace.invalid`
  const { application, invitation, token } = await applyApproveRedeem(`Racer ${suffix}`, email)
  await redeem(token)
  const member = await makeMember(`Racer Member ${suffix}`)
  expect(await linkMemberToApplications(payload, member.id, `nobody-${suffix}@terrace.invalid`)).toEqual({ invitations: 0, applications: 0 }) // nothing waiting: no transaction
  // Erasure takes the member lock first (it is in the middle of erasing); the sign-in's bind waits for it, then sees an erased member.
  const holder = await (payload.db as any).pool.connect()
  try {
    await holder.query('BEGIN')
    await holder.query(`SELECT id FROM members WHERE id = $1 FOR UPDATE`, [member.id])
    const binding = linkMemberToApplications(payload, member.id, email)
    await Bun.sleep(300)
    await holder.query(`UPDATE members SET status = 'erased' WHERE id = $1`, [member.id])
    await holder.query('COMMIT')
    expect(await binding).toEqual({ invitations: 0, applications: 0 })
  } finally { holder.release() }
  expect(await links(application.id, invitation.id)).toEqual({ application: null, invitation: null })
  // And the other way round: erasure's lookup waits for a bind in progress, so it sees the links it created.
  const sourceErasure = await Bun.file(new URL('../src/lifecycle/erasure.ts', import.meta.url)).text()
  expect(sourceErasure.indexOf('FROM members WHERE id = $1 FOR UPDATE')).toBeLessThan(sourceErasure.indexOf('const linked = await q.query'))
})

test('concurrent first sign-ins for one address queue on locks: no deadlock, exactly one member wins, both applications bind to them', async () => {
  const email = `twice-${suffix}@terrace.invalid`
  const first = await applyApproveRedeem(`Twice One ${suffix}`, email)
  await q(`UPDATE member_applications SET status = 'withdrawn' WHERE id = $1`, [first.application.id]) // allow a second application for the address
  await q(`UPDATE member_applications SET status = 'approved' WHERE id = $1`, [first.application.id])
  const second = await q(`INSERT INTO member_applications (name, affiliation, contact_email, status, grant_role, updated_at, created_at) VALUES ($1, 'alumni', $2, 'approved', 'alumni', now(), now()) RETURNING id`, [`Twice Two ${suffix}`, email])
  const secondInvitation = await q(`INSERT INTO member_invitations (application_id, token_hash, role, status, expires_at, redeemed_at, updated_at, created_at) VALUES ($1, $2, 'alumni', 'redeemed', now() + interval '1 day', now(), now(), now()) RETURNING id`, [second.rows[0].id, `h-${suffix}-twice`])
  await redeem(first.token)
  const ids = await Promise.all([1, 2, 3, 4].map(async (n) => (await makeMember(`Twice Member ${n} ${suffix}`)).id))
  const results = await Promise.all(ids.map((id) => linkMemberToApplications(payload, id, email)))
  expect(results.filter((result) => result.invitations > 0).length).toBe(1)
  const winner = ids[results.findIndex((result) => result.invitations > 0)]
  expect(await links(first.application.id, first.invitation.id)).toEqual({ application: winner, invitation: winner })
  expect((await q(`SELECT member_id FROM member_applications WHERE id = $1`, [second.rows[0].id])).rows[0].member_id).toBe(winner) // both applications bind to the first member
  expect((await q(`SELECT member_id FROM member_invitations WHERE id = $1`, [secondInvitation.rows[0].id])).rows[0].member_id).toBe(winner)
})

test('an outbox message finds its invitation through the foreign key; only old rows use the email heuristic', async () => {
  const email = `fk-${suffix}@terrace.invalid`
  const { invitation } = await applyApproveRedeem(`FK ${suffix}`, email)
  await q(`UPDATE member_invitations SET status = 'pending', redeemed_at = NULL WHERE id = $1`, [invitation.id])
  const row = (await q(`SELECT id FROM message_outbox WHERE invitation_id = $1`, [invitation.id])).rows[0]
  expect(await invitationState(payload, Number(row.id))).toBe('live')
  // Redact the address: the heuristic could no longer match, the foreign key still does.
  await q(`UPDATE message_outbox SET recipient_email = NULL WHERE id = $1`, [row.id])
  expect(await invitationState(payload, Number(row.id))).toBe('live')
  await q(`UPDATE member_invitations SET status = 'redeemed' WHERE id = $1`, [invitation.id])
  expect(await invitationState(payload, Number(row.id))).toBe('redeemed')
  // An old row without the key falls back to the heuristic.
  await q(`UPDATE message_outbox SET recipient_email = $2, invitation_id = NULL WHERE id = $1`, [row.id, email])
  expect(await invitationState(payload, Number(row.id))).toBe('redeemed')
  await q(`UPDATE message_outbox SET recipient_email = NULL WHERE id = $1`, [row.id])
  expect(await invitationState(payload, Number(row.id))).toBe('unknown')
  // Deleting the invitation clears the key rather than blocking the delete.
  await q(`UPDATE message_outbox SET invitation_id = $2 WHERE id = $1`, [row.id, invitation.id])
  await q(`DELETE FROM member_invitations WHERE id = $1`, [invitation.id])
  expect((await q(`SELECT invitation_id FROM message_outbox WHERE id = $1`, [row.id])).rows[0].invitation_id).toBeNull()
})

// ---- the Members list: sort, select, count and populated relations expose nothing hidden ---------------------------

test('REST: sort is allow-listed, and select, count and populated relations never reveal a hidden member field', async () => {
  const subject = await makeMember(`Exposure ${suffix}`)
  const adminToken = await login(admin, await passwordOf(admin))
  const auth = { headers: { authorization: `JWT ${adminToken}` } }
  for (const field of ['identityKey', 'subject', 'issuer', 'statusChangedAt', '-identityKey', 'roles']) expect((await rest(`/members?sort=${field}&limit=2`, auth)).status).toBe(400)
  expect((await rest(`/members?sort=-displayName&limit=2`, auth)).status).toBe(200)
  expect((await rest(`/members?sort=createdAt&limit=2`, auth)).status).toBe(200)
  // The admin relationship picker sends this exact request (a POST with a GET override); it must keep working.
  expect((await rest(`/members?depth=0&draft=true&limit=10&page=1&select[displayName]=true&sort=id`, auth)).status).toBe(200)
  const selected = await rest(`/members?select[identityKey]=true&select[displayName]=true&limit=3`, auth)
  expect(JSON.stringify(await selected.json())).not.toMatch(/identityKey|issuer|subject|statusChangedAt/)
  expect((await rest(`/members/count?where[identityKey][like]=x`, auth)).status).toBeGreaterThanOrEqual(400)
  expect((await rest(`/members/count?where[subject][equals]=x`, auth)).status).toBeGreaterThanOrEqual(400)
  expect((await rest(`/members/count`, auth)).status).toBe(200)
  // Populated through each relation, at depth.
  const application = await payload.create({ collection: 'member-applications', overrideAccess: true, data: { name: `Expo ${suffix}`, affiliation: 'alumni', contactEmail: `expo-${suffix}@terrace.invalid`, member: subject.id } })
  const invitation = await payload.create({ collection: 'member-invitations', overrideAccess: true, data: { application: application.id, tokenHash: `h-${suffix}-expo`, role: 'alumni', status: 'pending', expiresAt: new Date(Date.now() + 86_400_000).toISOString(), member: subject.id } })
  const offboarding = await payload.create({ collection: 'member-offboardings', data: { member: subject.id }, user: admin, overrideAccess: false })
  const request = await payload.create({ collection: 'data-requests', overrideAccess: true, context: { memberFlow: true }, data: { member: subject.id, kind: 'export', status: 'completed', requestedBy: 'member' } })
  for (const path of [`/member-applications/${application.id}?depth=3`, `/member-invitations/${invitation.id}?depth=3`, `/member-offboardings/${offboarding.id}?depth=3`, `/data-requests/${request.id}?depth=3`, `/message-outbox?depth=3&limit=3`, `/moderation-reports?depth=3&limit=3`]) {
    const text = JSON.stringify(await (await rest(path, auth)).json())
    expect(text).not.toMatch(/identityKey|statusChangedAt|"issuer"|tokenHash/)
    expect(text).not.toContain(settings.issuer)
    expect(text).not.toContain(String(subject.subject))
  }
  const populated = await (await rest(`/member-offboardings/${offboarding.id}?depth=1`, auth)).json() as any
  expect(Object.keys(populated.member).filter((key) => key !== 'collection').sort()).toEqual(['createdAt', 'displayName', 'id', 'status', 'updatedAt'])
  await q(`DELETE FROM data_requests WHERE id = $1`, [request.id])
  await q(`DELETE FROM member_offboardings WHERE id = $1`, [offboarding.id])
  await q(`DELETE FROM member_invitations WHERE id = $1`, [invitation.id])
})

// ---- the sweep as a scheduled job ----------------------------------------------------------------------------------

test('the sweep process exits by itself with code 0 within a bound, and says when it skipped mirror work', async () => {
  const started = Date.now()
  const run = spawnSync(process.execPath, [new URL('../src/scripts/lifecycle-sweep.ts', import.meta.url).pathname], { env: { ...process.env, LIFECYCLE_OUTBOX_DIR: outbox }, encoding: 'utf8', timeout: 90_000, cwd: new URL('..', import.meta.url).pathname })
  expect(run.error).toBeUndefined()
  expect(run.status).toBe(0)
  expect(Date.now() - started).toBeLessThan(60_000)
  expect(JSON.parse(run.stdout.slice(run.stdout.indexOf('{\n  "mirror"'))).mirror).not.toHaveProperty('skipped')
  const saved = process.env.LIFECYCLE_OUTBOX_DIR
  delete process.env.LIFECYCLE_OUTBOX_DIR
  try { expect(await reconcileMirror(payload)).toMatchObject({ redacted: 0, written: 0, skipped: 'outbox directory not configured' }) } finally { process.env.LIFECYCLE_OUTBOX_DIR = saved }
})

test('erasure scrubs two applications sharing one address (same lock order as the bind) and leaves them terminal', async () => {
  const name = `Dora Twin ${suffix}`, email = `dora-twin-${suffix}@terrace.invalid`
  const one = await applyApproveRedeem(name, email)
  const two = await applyApproveRedeem(`${name} again`, email)
  await redeem(one.token); await redeem(two.token)
  const member = await signIn(`sub-dora-${suffix}`, { name, email, email_verified: true })
  expect(await links(one.application.id, one.invitation.id)).toEqual({ application: member.id, invitation: member.id })
  expect(await links(two.application.id, two.invitation.id)).toEqual({ application: member.id, invitation: member.id })
  const code = (await (await own.erasure(request(member, { step: 'request' }))).json() as any).confirmationCode
  expect((await own.erasure(request(member, { step: 'confirm', token: code }))).status).toBe(200)
  await sweep(payload)
  for (const id of [one.application.id, two.application.id]) expect((await q(`SELECT name, contact_email, status FROM member_applications WHERE id = $1`, [id])).rows[0]).toEqual({ name: 'Erased applicant', contact_email: 'erased@terrace.invalid', status: 'withdrawn' })
  expect(await everyTable([`dora-twin-${suffix}`, `Dora Twin ${suffix}`])).toEqual([])
})

test('the sweep exit code names every cause, including an unreadable unlinked count', () => {
  const ok = { mirror: { redacted: 0, written: 0 }, unlinkedRedeemedApplications: 0 }
  expect(sweepExit(ok, {})).toEqual({ code: 0, lines: [] })
  expect(sweepExit({ ...ok, unlinkedRedeemedApplications: -1 }, {})).toEqual({ code: 1, lines: ['lifecycle sweep: could not count unlinked redeemed applications'] })
  expect(sweepExit({ ...ok, mirror: { redacted: 0, written: 0, skipped: 'outbox directory not configured' } }, {}).code).toBe(0)
  expect(sweepExit({ ...ok, mirror: { redacted: 0, written: 0, skipped: 'outbox directory not configured' } }, { CMS_PUBLIC_DEPLOYMENT: '1' }).code).toBe(1)
  expect(sweepExit({ ...ok, mirror: { redacted: 0, written: 0, failed: 2 } }, {}).lines).toEqual(['lifecycle sweep: some mirror files could not be written or redacted'])
})
