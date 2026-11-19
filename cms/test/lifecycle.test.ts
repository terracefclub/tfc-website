import { afterAll, beforeAll, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getPayload, type Payload } from 'payload'
import config from '../src/payload.config'
import { isMember } from '../src/access/members'
import { own, intake } from '../src/lifecycle/endpoints'
import { inspectInvitation, issueInvitation, redeemInvitation } from '../src/lifecycle/invitations'
import { hashToken } from '../src/lifecycle/tokens'
import { pool } from '../src/lifecycle/visibility'

const suffix = crypto.randomUUID().slice(0, 8)
const secret = `synthetic-intake-secret-${crypto.randomUUID()}`
const outbox = mkdtempSync(join(tmpdir(), 'terrace-outbox-'))
let payload: Payload
let admin: any
let editor: any
let alice: any
let bob: any
let carol: any
const users: Array<number | string> = []
const members: number[] = []
const trash: Array<{ collection: any; id: number | string }> = []

const q = (text: string, values: unknown[] = []) => pool(payload).query(text, values)
async function makeUser(role: 'admin' | 'editor') {
  const created = await payload.create({ collection: 'users', overrideAccess: true, data: { email: `${role}-${suffix}-${users.length}@terrace.invalid`, password: `local-${crypto.randomUUID()}`, displayName: `Lifecycle ${role}`, role } })
  users.push(created.id)
  return { ...created, collection: 'users' }
}
async function makeMember(name: string, roles: Array<'current-member' | 'alumni'>) {
  const record = await payload.create({ collection: 'members', overrideAccess: true, data: { identityKey: `${suffix}-${name}`, issuer: 'http://127.0.0.1:8080/realms/test', subject: `${suffix}-${name}`, displayName: name, roles } })
  members.push(record.id)
  return { ...record, collection: 'members' }
}
const as = async (collection: any, data: any, user: any) => {
  const doc = await payload.create({ collection, data, user, overrideAccess: false })
  trash.unshift({ collection, id: doc.id })
  return doc
}
const fresh = async (member: any) => ({ ...(await payload.findByID({ collection: 'members', id: member.id, overrideAccess: true })), collection: 'members' })
const request = (user: any, body?: unknown, headers: Record<string, string> = {}) => ({ user, payload, headers: new Headers(headers), json: async () => body }) as any
const apply = (body: unknown, key: string | null = secret) => intake.apply(request(null, body, key ? { 'x-terrace-intake': key } : {}))
const valid = (over: Record<string, unknown> = {}) => ({ name: `Applicant ${suffix}`, affiliation: 'alumni', classYear: 2004, contactEmail: `applicant-${suffix}@terrace.invalid`, note: 'Synthetic note.', ...over })
const mirror = () => readdirSync(outbox).sort().map((file) => ({ file, ...JSON.parse(readFileSync(join(outbox, file), 'utf8')) }))

beforeAll(async () => {
  if (process.env.CMS_LOCAL_BOOTSTRAP !== '1') throw new Error('Lifecycle tests require isolated local data.')
  process.env.LIFECYCLE_INTAKE_SECRET = secret
  process.env.LIFECYCLE_OUTBOX_DIR = outbox
  process.env.LIFECYCLE_PUBLIC_ORIGIN = 'http://127.0.0.1:4194'
  payload = await getPayload({ config, key: 'lifecycle-tests' })
  admin = await makeUser('admin')
  editor = await makeUser('editor')
  alice = await makeMember(`Alice ${suffix}`, ['current-member'])
  bob = await makeMember(`Bob ${suffix}`, ['alumni'])
  carol = await makeMember(`Carol ${suffix}`, ['alumni'])
})

afterAll(async () => {
  for (const item of trash) await payload.delete({ ...item, overrideAccess: true }).catch(() => {})
  await q(`DELETE FROM data_requests WHERE member_id = ANY($1)`, [members]).catch(() => {})
  await q(`DELETE FROM member_offboardings WHERE member_id = ANY($1)`, [members]).catch(() => {})
  await q(`DELETE FROM moderation_reports WHERE reporter_id = ANY($1) OR target_author_id = ANY($1)`, [members]).catch(() => {})
  await q(`DELETE FROM member_invitations WHERE application_id IN (SELECT id FROM member_applications WHERE contact_email LIKE $1)`, [`%${suffix}%`]).catch(() => {})
  await q(`DELETE FROM member_applications WHERE contact_email LIKE $1 OR name LIKE $2`, [`%${suffix}%`, `%${suffix}%`]).catch(() => {})
  for (const id of members) await payload.delete({ collection: 'members', id, overrideAccess: true }).catch(() => {})
  for (const id of users) await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => {})
  rmSync(outbox, { recursive: true, force: true })
  await payload.db.destroy?.()
})

let applicationId: number
let token: string
let invitationId: number

test('the intake endpoint fails closed without the website secret and validates input', async () => {
  expect((await apply(valid(), null)).status).toBe(403)
  expect((await apply(valid(), 'wrong-secret')).status).toBe(403)
  const saved = process.env.LIFECYCLE_INTAKE_SECRET
  delete process.env.LIFECYCLE_INTAKE_SECRET
  try { expect((await apply(valid())).status).toBe(503) } finally { process.env.LIFECYCLE_INTAKE_SECRET = saved }
  for (const bad of [valid({ name: '' }), valid({ contactEmail: 'not-an-email' }), valid({ affiliation: 'staff' }), valid({ classYear: 1800 }), valid({ note: 'x'.repeat(1001) }), valid({ name: 42 })]) {
    expect((await apply(bad)).status).toBe(400)
  }
  expect((await intake.apply(request(null, undefined, { 'x-terrace-intake': secret }))).status).toBe(400)
})

test('an application is stored as pending, a repeat looks identical, and no one but staff can read it', async () => {
  const first = await apply(valid())
  expect(first.status).toBe(202)
  const second = await apply(valid())
  expect(second.status).toBe(202)
  expect(await second.json()).toEqual(await first.json())
  const found = await payload.find({ collection: 'member-applications', where: { contactEmail: { equals: valid().contactEmail } }, overrideAccess: true })
  expect(found.totalDocs).toBe(1)
  applicationId = found.docs[0].id as number
  expect(found.docs[0]).toMatchObject({ status: 'pending', affiliation: 'alumni', classYear: 2004 })
  // Only what is needed: no network or browser metadata is stored.
  expect(Object.entries(found.docs[0]).filter(([, value]) => value != null).map(([key]) => key).sort()).toEqual(['affiliation', 'classYear', 'contactEmail', 'createdAt', 'id', 'name', 'note', 'status', 'updatedAt'].sort())
  await expect(payload.find({ collection: 'member-applications', overrideAccess: false })).rejects.toThrow()
  expect((await payload.find({ collection: 'member-applications', user: editor, overrideAccess: false })).totalDocs).toBeGreaterThan(0)
  const asMember = await payload.find({ collection: 'member-applications', user: alice, overrideAccess: false })
  expect(asMember.totalDocs).toBe(0)
  await expect(payload.create({ collection: 'member-applications', data: { name: 'X', affiliation: 'alumni', contactEmail: 'x@terrace.invalid' }, user: alice, overrideAccess: false })).rejects.toThrow()
  await expect(payload.create({ collection: 'member-applications', data: { name: 'X', affiliation: 'alumni', contactEmail: 'x@terrace.invalid' }, overrideAccess: false })).rejects.toThrow()
  await expect(payload.update({ collection: 'member-applications', id: applicationId, data: { status: 'approved', grantRole: 'alumni' }, user: alice, overrideAccess: false })).rejects.toThrow()
})

test('approval records the reviewer, needs a role, and issues a hashed single-use invitation, not an account', async () => {
  await expect(payload.update({ collection: 'member-applications', id: applicationId, data: { status: 'approved' }, user: editor, overrideAccess: false })).rejects.toThrow(/role/)
  expect((await payload.findByID({ collection: 'member-applications', id: applicationId, overrideAccess: true })).status).toBe('pending')
  const before = mirror().length
  const approved = await payload.update({ collection: 'member-applications', id: applicationId, data: { status: 'approved', grantRole: 'alumni', decisionNote: 'Known to the club.' }, user: editor, overrideAccess: false })
  expect(approved.status).toBe('approved')
  const stored = await payload.findByID({ collection: 'member-applications', id: applicationId, depth: 0, overrideAccess: true })
  expect(stored.reviewer).toBe(editor.id)
  expect(new Date(stored.decidedAt!).getTime()).toBeGreaterThan(Date.now() - 60_000)
  const invitations = await payload.find({ collection: 'member-invitations', where: { application: { equals: applicationId } }, overrideAccess: true })
  expect(invitations.totalDocs).toBe(1)
  invitationId = invitations.docs[0].id as number
  expect(invitations.docs[0]).toMatchObject({ role: 'alumni', status: 'pending' })
  // The realm is not touched, and no member record exists for the applicant.
  expect((await payload.find({ collection: 'members', where: { displayName: { equals: `Applicant ${suffix}` } }, overrideAccess: true })).totalDocs).toBe(0)
  // The plaintext token exists only in the local file mirror.
  const messages = mirror().slice(before)
  expect(messages).toHaveLength(1)
  expect(messages[0].kind).toBe('invitation')
  token = /\/join\/([A-Za-z0-9_-]{43})/.exec(messages[0].body)![1]
  const row = (await q(`SELECT token_hash FROM member_invitations WHERE id = $1`, [invitationId])).rows[0]
  expect(row.token_hash).toBe(createHash('sha256').update(token).digest('hex'))
  expect(row.token_hash).toHaveLength(64)
  const dump = JSON.stringify([(await q(`SELECT * FROM member_invitations`)).rows, (await q(`SELECT * FROM message_outbox`)).rows, (await q(`SELECT * FROM member_applications`)).rows])
  expect(dump).not.toContain(token)
  // Staff cannot read the hash through the API either.
  const viaApi = await payload.findByID({ collection: 'member-invitations', id: invitationId, user: editor, overrideAccess: false })
  expect(viaApi).not.toHaveProperty('tokenHash')
  // A decision is final.
  await payload.update({ collection: 'member-applications', id: applicationId, data: { status: 'denied' }, user: admin, overrideAccess: false })
  expect((await payload.findByID({ collection: 'member-applications', id: applicationId, overrideAccess: true })).status).toBe('approved')
  expect((await payload.find({ collection: 'member-invitations', where: { application: { equals: applicationId } }, overrideAccess: true })).totalDocs).toBe(1)
})

test('a token verifies by hash, is single use, and expires', async () => {
  expect(hashToken(token)).toHaveLength(64)
  expect(await inspectInvitation(payload, 'short')).toBeNull()
  expect(await inspectInvitation(payload, 'A'.repeat(43))).toBeNull()
  expect(await inspectInvitation(payload, undefined)).toBeNull()
  expect(await inspectInvitation(payload, token)).toMatchObject({ role: 'alumni' })
  // Inspecting does not consume.
  expect(await inspectInvitation(payload, token)).not.toBeNull()
  const results = await Promise.all([1, 2, 3, 4].map(() => redeemInvitation(payload, token)))
  expect(results.filter(Boolean)).toHaveLength(1)
  expect(await redeemInvitation(payload, token)).toBeNull()
  expect(await inspectInvitation(payload, token)).toBeNull()
  const row = (await payload.findByID({ collection: 'member-invitations', id: invitationId, overrideAccess: true }))
  expect(row.status).toBe('redeemed')
  expect(row.redeemedAt).toBeTruthy()
})

test('expired and revoked invitations cannot be redeemed, through the endpoint as well', async () => {
  const application = await payload.create({ collection: 'member-applications', overrideAccess: true, data: { name: `Late ${suffix}`, affiliation: 'current-member', contactEmail: `late-${suffix}@terrace.invalid`, status: 'pending', grantRole: 'current-member' } })
  const { token: late, invitationId: lateId } = await issueInvitation(payload, application as any)
  await q(`UPDATE member_invitations SET expires_at = now() - interval '1 minute' WHERE id = $1`, [lateId])
  expect(await redeemInvitation(payload, late)).toBeNull()
  expect((await payload.findByID({ collection: 'member-invitations', id: lateId, overrideAccess: true })).status).toBe('expired')
  const second = await issueInvitation(payload, application as any)
  await payload.update({ collection: 'member-invitations', id: second.invitationId, data: { status: 'revoked' }, user: admin, overrideAccess: false })
  expect(await redeemInvitation(payload, second.token)).toBeNull()
  const third = await issueInvitation(payload, application as any)
  expect((await intake.redeem(request(null, { token: third.token }, {}))).status).toBe(403)
  const checked = await intake.redeem(request(null, { token: third.token }, { 'x-terrace-intake': secret }))
  expect(await checked.json()).toMatchObject({ valid: true, role: 'current-member' })
  expect((await intake.redeem(request(null, { token: third.token, consume: true }, { 'x-terrace-intake': secret }))).status).toBe(200)
  const again = await intake.redeem(request(null, { token: third.token, consume: true }, { 'x-terrace-intake': secret }))
  expect(again.status).toBe(404)
  expect(await again.json()).toEqual({ valid: false })
  await expect(issueInvitation(payload, { ...application, grantRole: undefined } as any)).rejects.toThrow()
})

test('denial records the reviewer and a notice; members cannot approve or read invitations', async () => {
  const application = await payload.create({ collection: 'member-applications', overrideAccess: true, data: { name: `Denied ${suffix}`, affiliation: 'alumni', contactEmail: `denied-${suffix}@terrace.invalid` } })
  const before = mirror().length
  await payload.update({ collection: 'member-applications', id: application.id, data: { status: 'denied', decisionNote: 'Not verifiable.' }, user: admin, overrideAccess: false })
  const stored = await payload.findByID({ collection: 'member-applications', id: application.id, depth: 0, overrideAccess: true })
  expect(stored).toMatchObject({ status: 'denied', reviewer: admin.id })
  expect(mirror().slice(before).map((message) => message.kind)).toEqual(['denial'])
  expect((await payload.find({ collection: 'member-invitations', where: { application: { equals: application.id } }, overrideAccess: true })).totalDocs).toBe(0)
  await expect(payload.find({ collection: 'member-invitations', overrideAccess: false })).rejects.toThrow()
  expect((await payload.find({ collection: 'member-invitations', user: alice, overrideAccess: false })).totalDocs).toBe(0)
})

test('a member reads only an application and invitation linked to them', async () => {
  await payload.update({ collection: 'member-applications', id: applicationId, data: { member: alice.id }, user: admin, overrideAccess: false })
  await payload.update({ collection: 'member-invitations', id: invitationId, data: { member: alice.id }, user: admin, overrideAccess: false })
  expect((await payload.find({ collection: 'member-applications', user: alice, overrideAccess: false })).docs.map((doc) => doc.id)).toEqual([applicationId])
  expect((await payload.find({ collection: 'member-invitations', user: alice, overrideAccess: false })).docs.map((doc) => doc.id)).toEqual([invitationId])
  expect((await payload.find({ collection: 'member-applications', user: bob, overrideAccess: false })).totalDocs).toBe(0)
  expect((await payload.find({ collection: 'member-invitations', user: bob, overrideAccess: false })).totalDocs).toBe(0)
  // Editors cannot see or set the member link, which ties an application to an identity.
  const forEditor = await payload.findByID({ collection: 'member-applications', id: applicationId, user: editor, overrideAccess: false })
  expect(forEditor).not.toHaveProperty('member')
  await payload.update({ collection: 'member-applications', id: applicationId, data: { member: null }, user: editor, overrideAccess: false })
  expect((await payload.findByID({ collection: 'member-applications', id: applicationId, depth: 0, overrideAccess: true })).member).toBeTruthy()
  await payload.update({ collection: 'member-applications', id: applicationId, data: { member: null }, user: admin, overrideAccess: true })
})

test('editors cannot read identity fields or member records', async () => {
  await expect(payload.find({ collection: 'members', user: editor, overrideAccess: false })).rejects.toThrow()
  const adminView = await payload.find({ collection: 'members', user: admin, overrideAccess: false }).catch(() => null)
  for (const doc of adminView?.docs ?? []) for (const key of ['identityKey', 'issuer', 'subject']) expect(doc).not.toHaveProperty(key)
})

test('the outbox is append-only, admin-readable, and keeps links out of the database', async () => {
  const rows = await payload.find({ collection: 'message-outbox', user: admin, overrideAccess: false, limit: 100 })
  expect(rows.totalDocs).toBeGreaterThan(0)
  expect(rows.docs.every((doc) => !doc.body.includes('/join/'))).toBe(true)
  await expect(payload.find({ collection: 'message-outbox', user: editor, overrideAccess: false })).rejects.toThrow()
  await expect(payload.find({ collection: 'message-outbox', user: alice, overrideAccess: false })).rejects.toThrow()
  await expect(payload.delete({ collection: 'message-outbox', id: rows.docs[0].id, user: admin, overrideAccess: false })).rejects.toThrow()
  await expect(payload.create({ collection: 'message-outbox', data: { kind: 'denial', recipientLabel: 'x', subject: 'x', body: 'x' }, user: admin, overrideAccess: false })).rejects.toThrow()
  const changed = await payload.update({ collection: 'message-outbox', id: rows.docs[0].id, data: { status: 'delivered-by-operator', body: 'rewritten' }, user: admin, overrideAccess: false })
  expect(changed.status).toBe('delivered-by-operator')
  expect(changed.body).toBe(rows.docs[0].body)
  const files = mirror()
  expect(files.every((file) => file.id && file.subject)).toBe(true)
  // Mirror directory permissions are owner-only.
  expect((await import('node:fs')).statSync(join(outbox, files[0].file)).mode & 0o777).toBe(0o600)
})

let story: any
let profile: any
let group: any
let offer: any
let mentorRequest: any
test('member content exists for the lifecycle scenarios', async () => {
  profile = await as('member-profiles', { displayName: 'Bob Terran', directoryVisible: true }, bob)
  story = await as('member-stories', { title: 'Bob story', body: 'Hello.', audience: 'community' }, bob)
  group = await as('member-groups', { name: `Bob group ${suffix}`, description: 'Synthetic.' }, bob)
  offer = await as('mentorship-offers', { displayName: 'Bob Terran', optIn: true, topics: 'food' }, bob)
  mentorRequest = await as('mentorship-requests', { mentor: bob.id, message: 'Could we talk?' }, alice)
  expect((await payload.find({ collection: 'member-stories', user: alice, overrideAccess: false })).docs.some((doc) => doc.id === story.id)).toBe(true)
})

test('only administrators can offboard; offboarding hides content, blocks access, and appends a notice', async () => {
  await expect(payload.create({ collection: 'member-offboardings', data: { member: bob.id }, user: editor, overrideAccess: false })).rejects.toThrow()
  await expect(payload.create({ collection: 'member-offboardings', data: { member: bob.id }, user: alice, overrideAccess: false })).rejects.toThrow()
  const before = mirror().length
  const record = await payload.create({ collection: 'member-offboardings', data: { member: bob.id, reason: 'Synthetic test.' }, user: admin, overrideAccess: false })
  trash.unshift({ collection: 'member-offboardings', id: record.id } as any)
  expect(record.state).toBe('offboarded')
  expect(new Date(record.graceEndsAt!).getTime()).toBeGreaterThan(Date.now() + 86_400_000)
  expect(await fresh(bob)).toMatchObject({ status: 'offboarded' })
  expect(isMember({ user: await fresh(bob) })).toBe(false)
  expect(isMember({ user: bob })).toBe(true) // the stale session object is not the source of truth
  expect(mirror().slice(before).map((message) => message.kind)).toEqual(['offboarding'])
  // Hidden from directory, groups, mentorship and stories, but retained.
  const view = (collection: any) => payload.find({ collection, user: alice, overrideAccess: false, limit: 100 }).then((result) => result.docs.map((doc: any) => doc.id))
  expect(await view('member-profiles')).not.toContain(profile.id)
  expect(await view('member-stories')).not.toContain(story.id)
  expect(await view('member-groups')).not.toContain(group.id)
  expect(await view('mentorship-offers')).not.toContain(offer.id)
  expect(await view('mentorship-requests')).not.toContain(mentorRequest.id)
  await expect(payload.findByID({ collection: 'member-stories', id: story.id, user: alice, overrideAccess: false })).rejects.toThrow()
  expect((await payload.findByID({ collection: 'member-stories', id: story.id, overrideAccess: true })).hiddenReason).toBe('offboarded')
  // A second offboarding of an inactive member is refused.
  await expect(payload.create({ collection: 'member-offboardings', data: { member: bob.id }, user: admin, overrideAccess: false })).rejects.toThrow()
  // Restoring inside the grace period reverses it.
  await payload.update({ collection: 'member-offboardings', id: record.id, data: { state: 'restored' }, user: admin, overrideAccess: false })
  expect(await fresh(bob)).toMatchObject({ status: 'active' })
  expect(await view('member-stories')).toContain(story.id)
  expect(await view('member-groups')).toContain(group.id)
  expect(await view('mentorship-requests')).toContain(mentorRequest.id)
})

test('restoration is refused once the grace period has ended, and offboarding never lifts a moderation hide', async () => {
  const record = await payload.create({ collection: 'member-offboardings', data: { member: bob.id }, user: admin, overrideAccess: false })
  trash.unshift({ collection: 'member-offboardings', id: record.id } as any)
  await q(`UPDATE member_offboardings SET grace_ends_at = now() - interval '1 day' WHERE id = $1`, [record.id])
  await expect(payload.update({ collection: 'member-offboardings', id: record.id, data: { state: 'restored' }, user: admin, overrideAccess: false })).rejects.toThrow(/grace/)
  expect(await fresh(bob)).toMatchObject({ status: 'offboarded' })
  await q(`UPDATE member_offboardings SET grace_ends_at = now() + interval '1 day' WHERE id = $1`, [record.id])
  await payload.update({ collection: 'member-offboardings', id: record.id, data: { state: 'restored' }, user: admin, overrideAccess: false })
  expect(await fresh(bob)).toMatchObject({ status: 'active' })
})

test('reports capture a snapshot, need readable content, and are queued for staff only', async () => {
  await expect(as('moderation-reports', { targetType: 'story', targetId: story.id, reason: 'privacy' }, bob)).rejects.toThrow() // own content
  await expect(as('moderation-reports', { targetType: 'story', targetId: 999999, reason: 'privacy' }, alice)).rejects.toThrow()
  await expect(as('moderation-reports', { targetType: 'story', targetId: story.id, reason: 'bogus' }, alice)).rejects.toThrow()
  await expect(payload.create({ collection: 'moderation-reports', data: { targetType: 'story', targetId: story.id, reason: 'privacy' }, overrideAccess: false })).rejects.toThrow()
  const report = await as('moderation-reports', { targetType: 'story', targetId: story.id, reason: 'harassment', detail: 'Synthetic.' }, alice)
  expect(report).toMatchObject({ status: 'open', snapshotTitle: 'Bob story', authorName: `Bob ${suffix}` })
  await expect(as('moderation-reports', { targetType: 'story', targetId: story.id, reason: 'privacy' }, alice)).rejects.toThrow() // once per reporter
  for (const user of [alice, bob, undefined]) await expect(payload.find({ collection: 'moderation-reports', user, overrideAccess: false })).rejects.toThrow()
  const staffView = await payload.findByID({ collection: 'moderation-reports', id: report.id, user: editor, overrideAccess: false })
  expect(staffView).not.toHaveProperty('reporter')
  expect(staffView).not.toHaveProperty('reportKey')
  // Another member cannot report what they cannot read (a group story outside their groups).
  const private_ = await as('member-stories', { title: 'Private', body: 'Group only.', audience: 'group', group: group.id }, bob)
  await expect(as('moderation-reports', { targetType: 'story', targetId: private_.id, reason: 'other' }, carol)).rejects.toThrow()
})

test('hiding removes content from member views but retains it; dismissing restores it', async () => {
  const report = (await payload.find({ collection: 'moderation-reports', where: { targetId: { equals: story.id } }, overrideAccess: true })).docs[0]
  await expect(payload.update({ collection: 'moderation-reports', id: report.id, data: { status: 'hidden' }, user: alice, overrideAccess: false })).rejects.toThrow()
  const hidden = await payload.update({ collection: 'moderation-reports', id: report.id, data: { status: 'hidden', resolutionNote: 'Violates guidelines.' }, user: editor, overrideAccess: false })
  expect(hidden.status).toBe('hidden')
  expect((await payload.findByID({ collection: 'moderation-reports', id: report.id, depth: 0, overrideAccess: true })).resolver).toBe(editor.id)
  for (const user of [alice, carol]) {
    expect((await payload.find({ collection: 'member-stories', user, overrideAccess: false })).docs.map((doc) => doc.id)).not.toContain(story.id)
    await expect(payload.findByID({ collection: 'member-stories', id: story.id, user, overrideAccess: false })).rejects.toThrow()
  }
  await expect(payload.findByID({ collection: 'member-stories', id: story.id, user: bob, overrideAccess: false })).rejects.toThrow()
  await expect(payload.update({ collection: 'member-stories', id: story.id, data: { body: 'Edited while hidden.' }, user: bob, overrideAccess: false })).rejects.toThrow()
  expect((await payload.findByID({ collection: 'member-stories', id: story.id, overrideAccess: true })).hiddenReason).toBe('moderation')
  // Offboarding then restoring Bob must not un-hide moderation-hidden content.
  const offboarding = await payload.create({ collection: 'member-offboardings', data: { member: bob.id }, user: admin, overrideAccess: false })
  trash.unshift({ collection: 'member-offboardings', id: offboarding.id } as any)
  await payload.update({ collection: 'member-offboardings', id: offboarding.id, data: { state: 'restored' }, user: admin, overrideAccess: false })
  expect((await payload.findByID({ collection: 'member-stories', id: story.id, overrideAccess: true })).hiddenReason).toBe('moderation')
  await expect(payload.update({ collection: 'moderation-reports', id: report.id, data: { status: 'resolved' }, user: editor, overrideAccess: false })).rejects.toThrow()
  await payload.update({ collection: 'moderation-reports', id: report.id, data: { status: 'dismissed' }, user: editor, overrideAccess: false })
  expect((await payload.find({ collection: 'member-stories', user: alice, overrideAccess: false })).docs.map((doc) => doc.id)).toContain(story.id)
})

test('groups and mentorship messages can be reported and hidden too', async () => {
  const groupReport = await as('moderation-reports', { targetType: 'group', targetId: group.id, reason: 'other' }, alice)
  await payload.update({ collection: 'moderation-reports', id: groupReport.id, data: { status: 'hidden' }, user: admin, overrideAccess: false })
  expect((await payload.find({ collection: 'member-groups', user: carol, overrideAccess: false })).docs.map((doc) => doc.id)).not.toContain(group.id)
  const messageReport = await as('moderation-reports', { targetType: 'mentorship-request', targetId: mentorRequest.id, reason: 'harassment' }, bob)
  expect(messageReport.snapshotBody).toBe('Could we talk?')
  await payload.update({ collection: 'moderation-reports', id: messageReport.id, data: { status: 'hidden' }, user: editor, overrideAccess: false })
  expect((await payload.find({ collection: 'mentorship-requests', user: bob, overrideAccess: false })).docs.map((doc) => doc.id)).not.toContain(mentorRequest.id)
  expect((await payload.find({ collection: 'mentorship-requests', user: alice, overrideAccess: false })).docs.map((doc) => doc.id)).not.toContain(mentorRequest.id)
  await payload.update({ collection: 'moderation-reports', id: groupReport.id, data: { status: 'dismissed' }, user: admin, overrideAccess: false })
  await payload.update({ collection: 'moderation-reports', id: messageReport.id, data: { status: 'dismissed' }, user: admin, overrideAccess: false })
})

test('export returns only the signed-in member\'s own records, never identity fields, and refuses others', async () => {
  const anonymous = await own.export(request(null))
  expect(anonymous.status).toBe(401)
  expect((await own.export(request({ id: 1, collection: 'users', role: 'admin' }))).status).toBe(403)
  expect((await own.export(request({ ...alice, roles: [] }))).status).toBe(403)
  expect((await own.export(request({ ...(await fresh(alice)), status: 'offboarded' }))).status).toBe(403)
  const response = await own.export(request(alice))
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(response.headers.get('content-disposition')).toContain('attachment')
  const data = await response.json() as any
  expect(data.member.displayName).toBe(`Alice ${suffix}`)
  expect(data.mentorshipRequestsSent.map((item: any) => item.message)).toEqual(['Could we talk?'])
  expect(data.stories).toEqual([])
  const text = JSON.stringify(data)
  for (const needle of ['Bob story', `Bob group ${suffix}`, `${suffix}-Alice`, 'http://127.0.0.1:8080/realms/test', 'identityKey', 'issuer']) expect(text).not.toContain(needle)
  const bobData = await (await own.export(request(bob))).json() as any
  expect(bobData.stories.map((item: any) => item.title)).toContain('Bob story')
  expect(bobData.groupsFounded).toHaveLength(1)
  // Bob replies are exported; Alice's request text is not.
  expect(JSON.stringify(bobData)).not.toContain('Could we talk?')
  const audit = await payload.find({ collection: 'data-requests', where: { and: [{ member: { equals: alice.id } }, { kind: { equals: 'export' } }] }, overrideAccess: true })
  expect(audit.totalDocs).toBe(1)
  expect(JSON.stringify(audit.docs)).not.toContain('Could we talk?')
  expect((await payload.find({ collection: 'data-requests', user: bob, overrideAccess: false })).docs.every((doc: any) => (typeof doc.member === 'object' ? doc.member.id : doc.member) === bob.id)).toBe(true)
})

test('erasure is a two-step confirmation that deletes or anonymises member-authored content', async () => {
  const erasure = (user: any, body: unknown) => own.erasure(request(user, body))
  expect((await erasure(null, { step: 'request' })).status).toBe(401)
  expect((await erasure({ ...alice, roles: [] }, { step: 'request' })).status).toBe(403)
  expect((await erasure(alice, { step: 'bogus' })).status).toBe(400)
  // Nothing happens without the confirmation step.
  const asked = await erasure(carol, { step: 'request' })
  expect(asked.status).toBe(201)
  const { confirmationCode } = await asked.json() as any
  expect((await fresh(carol)).status).toBe('active')
  const code = (await (await erasure(alice, { step: 'request' })).json() as any).confirmationCode
  // A code belongs to its member, is single use, expires, and is stored only as a hash.
  expect((await erasure(bob, { step: 'confirm', token: code })).status).toBe(400)
  expect((await erasure(alice, { step: 'confirm', token: 'A'.repeat(43) })).status).toBe(400)
  expect((await erasure(alice, { step: 'confirm', token: 'short' })).status).toBe(400)
  expect(JSON.stringify((await q(`SELECT * FROM data_requests`)).rows)).not.toContain(code)
  await q(`UPDATE data_requests SET confirm_expires_at = now() - interval '1 minute' WHERE confirm_hash = $1`, [hashToken(confirmationCode)])
  expect((await erasure(carol, { step: 'confirm', token: confirmationCode })).status).toBe(400)
  expect((await fresh(carol)).status).toBe('active')
  const before = mirror().length
  const done = await erasure(alice, { step: 'confirm', token: code })
  expect(done.status).toBe(200)
  expect((await erasure(alice, { step: 'confirm', token: code })).status).toBeGreaterThanOrEqual(400)
  const tombstone = await payload.findByID({ collection: 'members', id: alice.id, overrideAccess: true })
  expect(tombstone).toMatchObject({ status: 'erased', displayName: 'Former member', subject: 'erased' })
  expect(tombstone.roles ?? []).toEqual([])
  expect(isMember({ user: { ...tombstone, collection: 'members', roles: ['alumni'] } })).toBe(false)
  expect((await own.export(request({ ...tombstone, collection: 'members', roles: ['alumni'] }))).status).toBe(403)
  const request_ = await payload.findByID({ collection: 'mentorship-requests', id: mentorRequest.id, overrideAccess: true })
  expect(request_).toMatchObject({ requesterName: 'Former member', message: 'Removed at the member’s request.' })
  expect(mirror().slice(before).map((message) => message.kind)).toEqual(['erasure-confirmation'])
  const completed = await payload.find({ collection: 'data-requests', where: { and: [{ member: { equals: alice.id } }, { kind: { equals: 'erasure' } }] }, overrideAccess: true })
  expect(completed.docs.map((doc) => doc.status)).toEqual(['completed'])
})

test('administrators erase only offboarded members, with the same policy', async () => {
  await expect(payload.create({ collection: 'data-requests', data: { member: carol.id, kind: 'erasure' }, user: admin, overrideAccess: false })).rejects.toThrow(/Offboard/)
  await expect(payload.create({ collection: 'data-requests', data: { member: carol.id, kind: 'export' }, user: admin, overrideAccess: false })).rejects.toThrow()
  const carolStory = await as('member-stories', { title: 'Carol story', body: 'Mine.', audience: 'community' }, carol)
  const offboarding = await payload.create({ collection: 'member-offboardings', data: { member: carol.id }, user: admin, overrideAccess: false })
  trash.unshift({ collection: 'member-offboardings', id: offboarding.id } as any)
  await expect(payload.create({ collection: 'data-requests', data: { member: carol.id, kind: 'erasure' }, user: editor, overrideAccess: false })).rejects.toThrow()
  const run = await payload.create({ collection: 'data-requests', data: { member: carol.id, kind: 'erasure' }, user: admin, overrideAccess: false })
  expect((await payload.findByID({ collection: 'data-requests', id: run.id, overrideAccess: true })).status).toBe('completed')
  expect(await payload.findByID({ collection: 'member-stories', id: carolStory.id, overrideAccess: true }).catch(() => null)).toBeNull()
  expect((await payload.findByID({ collection: 'members', id: carol.id, overrideAccess: true })).status).toBe('erased')
  expect((await payload.findByID({ collection: 'member-offboardings', id: offboarding.id, overrideAccess: true })).state).toBe('erased')
  await expect(payload.update({ collection: 'member-offboardings', id: offboarding.id, data: { state: 'restored' }, user: admin, overrideAccess: false })).rejects.toThrow()
})

test('the sweep expires stale invitations, reports content past its grace period, and purges only when asked', async () => {
  const { sweep } = await import('../src/lifecycle/sweep')
  const application = await payload.create({ collection: 'member-applications', overrideAccess: true, data: { name: `Sweep ${suffix}`, affiliation: 'alumni', contactEmail: `sweep-${suffix}@terrace.invalid`, grantRole: 'alumni' } })
  const { invitationId: staleId } = await issueInvitation(payload, application as any)
  await q(`UPDATE member_invitations SET expires_at = now() - interval '1 hour' WHERE id = $1`, [staleId])
  const old = await as('member-stories', { title: 'Old hidden', body: 'x', audience: 'community' }, bob)
  await q(`UPDATE member_stories SET hidden_reason = 'moderation', hidden_at = now() - interval '400 days' WHERE id = $1`, [old.id])
  const first = await sweep(payload)
  expect(first.invitationsExpired).toBeGreaterThanOrEqual(1)
  expect((await payload.findByID({ collection: 'member-invitations', id: staleId, overrideAccess: true })).status).toBe('expired')
  expect(first.moderatedPastGrace['member-stories']).toBeGreaterThanOrEqual(1)
  expect(first.moderatedPurged).toBe(0)
  expect((await payload.findByID({ collection: 'member-stories', id: old.id, overrideAccess: true })).title).toBe('Old hidden')
  expect((await sweep(payload, { purgeModerated: true })).moderatedPurged).toBeGreaterThanOrEqual(1)
  expect(await payload.findByID({ collection: 'member-stories', id: old.id, overrideAccess: true }).catch(() => null)).toBeNull()
})
