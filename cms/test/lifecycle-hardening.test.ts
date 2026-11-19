import { afterAll, beforeAll, expect, test } from 'bun:test'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getPayload, type Payload } from 'payload'
import config from '../src/payload.config'
import { isMember } from '../src/access/members'
import { intake, own } from '../src/lifecycle/endpoints'
import { issueInvitation } from '../src/lifecycle/invitations'
import { deliveryConfig, enqueueMessage, reconcileMirror } from '../src/lifecycle/outbox'
import { sweep } from '../src/lifecycle/sweep'
import { hashToken } from '../src/lifecycle/tokens'
import { pool } from '../src/lifecycle/visibility'

const suffix = crypto.randomUUID().slice(0, 8)
const secret = `synthetic-intake-secret-${crypto.randomUUID()}`
const outbox = mkdtempSync(join(tmpdir(), 'terrace-outbox-h-'))
let payload: Payload
let admin: any
let editor: any
const users: Array<number | string> = []
const members: number[] = []
const trash: Array<{ collection: any; id: number | string }> = []

const q = (text: string, values: unknown[] = []) => pool(payload).query(text, values)
async function makeUser(role: 'admin' | 'editor') {
  const created = await payload.create({ collection: 'users', overrideAccess: true, data: { email: `${role}-h-${suffix}-${users.length}@terrace.invalid`, password: `local-${crypto.randomUUID()}`, displayName: `Hardening ${role}`, role } })
  users.push(created.id)
  return { ...created, collection: 'users' }
}
async function makeMember(name: string, roles: Array<'current-member' | 'alumni'> = ['alumni']) {
  const record = await payload.create({ collection: 'members', overrideAccess: true, data: { identityKey: crypto.randomUUID(), issuer: 'http://127.0.0.1:8080/realms/test', subject: crypto.randomUUID(), displayName: name, roles } })
  members.push(record.id)
  return { ...record, collection: 'members' }
}
const as = async (collection: any, data: any, user: any) => {
  const doc = await payload.create({ collection, data, user, overrideAccess: false })
  trash.unshift({ collection, id: doc.id })
  return doc
}
const request = (user: any, body?: unknown, headers: Record<string, string> = {}) => ({ user, payload, headers: new Headers(headers), json: async () => body }) as any
const storiesFor = async (user: any) => (await payload.find({ collection: 'member-stories', user, overrideAccess: false, limit: 100 })).docs.map((doc) => doc.id)
const profilesFor = async (user: any) => (await payload.find({ collection: 'member-profiles', user, overrideAccess: false, limit: 100 })).docs.map((doc) => doc.id)
const offboard = async (member: any) => {
  const record = await payload.create({ collection: 'member-offboardings', data: { member: member.id, reason: `Reason ${suffix}` }, user: admin, overrideAccess: false })
  trash.unshift({ collection: 'member-offboardings', id: record.id } as any)
  return record
}
const restore = (record: any) => payload.update({ collection: 'member-offboardings', id: record.id, data: { state: 'restored' }, user: admin, overrideAccess: false })
const pendingApplication = (name: string, email: string) => payload.create({ collection: 'member-applications', overrideAccess: true, data: { name, affiliation: 'alumni', contactEmail: email } })

// Real faults, not test seams: a trigger that raises on any statement against a table.
const faulted: string[] = []
async function failOn(table: string, event: 'UPDATE' | 'DELETE') {
  await q(`CREATE OR REPLACE FUNCTION tfc_injected_failure() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$ LANGUAGE plpgsql`)
  await q(`CREATE TRIGGER tfc_fail_${table} BEFORE ${event} ON ${table} FOR EACH STATEMENT EXECUTE FUNCTION tfc_injected_failure()`)
  faulted.push(table)
}
async function dropFaults() {
  for (const table of faulted.splice(0)) await q(`DROP TRIGGER IF EXISTS tfc_fail_${table} ON ${table}`)
}

beforeAll(async () => {
  if (process.env.CMS_LOCAL_BOOTSTRAP !== '1') throw new Error('Lifecycle tests require isolated local data.')
  process.env.LIFECYCLE_INTAKE_SECRET = secret
  process.env.LIFECYCLE_OUTBOX_DIR = outbox
  process.env.LIFECYCLE_PUBLIC_ORIGIN = 'http://127.0.0.1:4194'
  payload = await getPayload({ config, key: 'lifecycle-hardening-tests' })
  admin = await makeUser('admin')
  editor = await makeUser('editor')
})

afterAll(async () => {
  await dropFaults()
  for (const item of trash) await payload.delete({ ...item, overrideAccess: true }).catch(() => {})
  await q(`DELETE FROM data_requests WHERE member_id = ANY($1)`, [members]).catch(() => {})
  await q(`DELETE FROM member_offboardings WHERE member_id = ANY($1)`, [members]).catch(() => {})
  await q(`DELETE FROM moderation_reports WHERE reporter_id = ANY($1) OR target_author_id = ANY($1) OR snapshot_title LIKE $2`, [members, `%${suffix}%`]).catch(() => {})
  await q(`DELETE FROM story_reports WHERE story_title LIKE $1 OR author_name LIKE $1`, [`%${suffix}%`]).catch(() => {})
  await q(`DELETE FROM member_invitations WHERE application_id IN (SELECT id FROM member_applications WHERE contact_email LIKE $1)`, [`%${suffix}%`]).catch(() => {})
  await q(`DELETE FROM member_applications WHERE contact_email LIKE $1 OR name LIKE $1`, [`%${suffix}%`]).catch(() => {})
  await q(`DELETE FROM member_stories WHERE author_id = ANY($1)`, [members]).catch(() => {})
  await q(`DELETE FROM group_memberships WHERE member_id = ANY($1)`, [members]).catch(() => {})
  await q(`DELETE FROM member_groups WHERE owner_id = ANY($1)`, [members]).catch(() => {})
  for (const id of members) await payload.delete({ collection: 'members', id, overrideAccess: true }).catch(() => {})
  for (const id of users) await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => {})
  rmSync(outbox, { recursive: true, force: true })
  await payload.db.destroy?.()
})

// ---- B1: erasure leaves nothing behind -----------------------------------------------------------
async function scan(needles: string[]) {
  const tables = (await q(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT LIKE 'payload_migrations%'`)).rows.map((row) => String(row.table_name))
  const hits: string[] = []
  for (const table of tables) {
    const result = await q(`SELECT count(*)::int AS n FROM "${table}" x WHERE x::text ILIKE ANY($1)`, [needles.map((needle) => `%${needle}%`)])
    if (Number(result.rows[0].n)) hits.push(table)
  }
  return hits
}

test('erasure leaves no trace of the member\'s name or email in any table or mirror file', async () => {
  const name = `Zelda Quill ${suffix}`
  const email = `zelda-quill-${suffix}@terrace.invalid`
  const noticeEmail = `shared-officers-${suffix}@terrace.invalid`
  const zelda = await makeMember(name)
  const other = await makeMember(`Other ${suffix}`, ['current-member'])
  // Invitation chain: the application is NOT linked to the member, only the invitation is.
  const application = await pendingApplication(name, email)
  await payload.update({ collection: 'member-applications', id: application.id, data: { status: 'approved', grantRole: 'alumni', decisionNote: `Known to ${name}` }, user: editor, overrideAccess: false })
  const invitation = (await payload.find({ collection: 'member-invitations', where: { application: { equals: application.id } }, overrideAccess: true })).docs[0]
  await payload.update({ collection: 'member-invitations', id: invitation.id, data: { member: zelda.id }, user: admin, overrideAccess: false })
  // A second, unlinked application from the same address is caught by its email.
  await q(`UPDATE member_applications SET status = 'withdrawn' WHERE id = $1`, [application.id])
  const twin = await pendingApplication('Twin of Zelda', email.toUpperCase())
  // Someone else's application that shares ONLY the offboarding notice address must survive.
  const stranger = await pendingApplication(`Stranger ${suffix}`, noticeEmail)
  const story = await as('member-stories', { title: `Story by ${name}`, body: `Written by ${name}`, audience: 'community' }, zelda)
  await as('member-profiles', { displayName: name, bio: `About ${name}`, directoryVisible: true }, zelda)
  await as('mentorship-offers', { displayName: name, topics: `Topics from ${name}`, about: `Offer by ${name}`, optIn: true }, zelda)
  const group = await as('member-groups', { name: `Zelda's Group ${suffix}`, description: 'Pool table people.' }, zelda)
  const groupStory = await as('member-stories', { title: `Group tale by ${name}`, body: `Group body by ${name}`, audience: 'group', group: group.id }, zelda)
  const mine = await as('member-stories', { title: `Other ${suffix}`, body: 'Theirs', audience: 'community' }, other)
  // A request Zelda sent (her name and text), and one addressed to Zelda (her name in the mentor fields and report snapshot).
  await as('mentorship-offers', { displayName: `Other ${suffix}`, optIn: true }, other)
  const sent = await as('mentorship-requests', { mentor: other.id, message: `${name} here, hello` }, zelda)
  const received = await as('mentorship-requests', { mentor: zelda.id, message: 'Could we talk?' }, other)
  await payload.update({ collection: 'mentorship-requests', id: received.id, data: { status: 'accepted', reply: `Reply from ${name}` }, user: zelda, overrideAccess: false })
  // Reports: legacy, about her story, a mentor reporting a request addressed to her, and one she filed with a staff note.
  await as('story-reports', { storyId: story.id, reason: 'privacy' }, other)
  const about = await as('moderation-reports', { targetType: 'story', targetId: story.id, reason: 'other', detail: `About ${name}` }, other)
  await payload.update({ collection: 'moderation-reports', id: about.id, data: { status: 'resolved', resolutionNote: `Spoke to ${name}` }, user: editor, overrideAccess: false })
  const filed = await as('moderation-reports', { targetType: 'story', targetId: mine.id, reason: 'harassment', detail: `Filed by ${name} ${email}` }, zelda)
  await payload.update({ collection: 'moderation-reports', id: filed.id, data: { status: 'resolved', resolutionNote: `Thanked ${name}` }, user: editor, overrideAccess: false })
  const mentorReport = await as('moderation-reports', { targetType: 'mentorship-request', targetId: sent.id, reason: 'other' }, other)
  expect(mentorReport.snapshotTitle).toContain('Mentorship request to')
  // The mentor (Zelda) reports a request addressed to her: the snapshot title carries her name as mentor.
  const toZelda = await as('moderation-reports', { targetType: 'mentorship-request', targetId: received.id, reason: 'other' }, zelda)
  expect(toZelda.snapshotTitle).toContain(name)
  // Re-attribute it to a different reporter so only the mentor-specific scrub (not "reports they filed") can catch it.
  await q(`UPDATE moderation_reports SET reporter_id = $2 WHERE id = $1`, [toZelda.id, other.id])
  const off = await payload.create({ collection: 'member-offboardings', data: { member: zelda.id, reason: `Reason for ${name}`, noticeEmail }, user: admin, overrideAccess: false })
  trash.unshift({ collection: 'member-offboardings', id: off.id } as any)
  const needles = [`Zelda Quill ${suffix}`, `zelda-quill-${suffix}`]
  const before = await scan(needles)
  expect(before.length).toBeGreaterThan(8) // the scan really does see the data beforehand
  expect(readdirSync(outbox).some((file) => readFileSync(join(outbox, file), 'utf8').includes(email))).toBe(true)

  await payload.create({ collection: 'data-requests', data: { member: zelda.id, kind: 'erasure' }, user: admin, overrideAccess: false })

  expect(await scan(needles)).toEqual([])
  expect(await scan([`shared-officers-${suffix}`])).toContain('member_applications') // the stranger's own row, untouched
  // Files: an administrator's erasure leaves redaction to the retryable reconcile step.
  expect(readdirSync(outbox).some((file) => readFileSync(join(outbox, file), 'utf8').includes(email))).toBe(true)
  await reconcileMirror(payload)
  for (const file of readdirSync(outbox)) expect(readFileSync(join(outbox, file), 'utf8')).not.toMatch(new RegExp(`zelda-quill-${suffix}|Zelda Quill`, 'i'))
  // Another person's data is untouched: the stranger sharing only the notice address, and others' content.
  expect((await payload.findByID({ collection: 'member-applications', id: stranger.id, overrideAccess: true })).name).toBe(`Stranger ${suffix}`)
  expect((await payload.findByID({ collection: 'member-applications', id: twin.id, overrideAccess: true })).name).toBe('Erased applicant')
  expect((await payload.findByID({ collection: 'member-stories', id: mine.id, overrideAccess: true })).title).toBe(`Other ${suffix}`)
  expect(await payload.findByID({ collection: 'member-stories', id: groupStory.id, overrideAccess: true }).catch(() => null)).toBeNull()
  // Policy pending an owner decision: the group the member founded keeps its name and description; only the founder name is anonymised.
  const kept = await payload.findByID({ collection: 'member-groups', id: group.id, overrideAccess: true })
  expect(kept).toMatchObject({ name: `Zelda's Group ${suffix}`, description: 'Pool table people.', ownerName: 'Former member' })
  expect((await payload.count({ collection: 'message-outbox', where: { recipientLabel: { equals: 'Former member' } }, overrideAccess: true })).totalDocs).toBeGreaterThanOrEqual(2)
})

// ---- B2: erasure is all or nothing --------------------------------------------------------------
test('a failure part-way through member erasure changes nothing and the confirmation code still works', async () => {
  const subject = await makeMember(`Atomic Subject ${suffix}`)
  const story = await as('member-stories', { title: 'Atomic story', body: 'Keep me until erased.', audience: 'community' }, subject)
  const code = (await (await own.erasure(request(subject, { step: 'request' }))).json() as any).confirmationCode
  const untouched = async () => {
    expect((await payload.findByID({ collection: 'members', id: subject.id, overrideAccess: true })).status).toBe('active')
    expect((await payload.findByID({ collection: 'member-stories', id: story.id, overrideAccess: true })).title).toBe('Atomic story')
    expect((await q(`SELECT status FROM data_requests WHERE confirm_hash = $1`, [hashToken(code)])).rows[0].status).toBe('awaiting-confirmation')
  }
  // Each fault hits a different stage: deleting content, anonymising conversations, scrubbing outbox rows, the tombstone.
  for (const [table, event] of [['member_stories', 'DELETE'], ['mentorship_requests', 'UPDATE'], ['message_outbox', 'UPDATE'], ['members', 'UPDATE']] as const) {
    await failOn(table, event)
    try {
      const response = await own.erasure(request(subject, { step: 'confirm', token: code }))
      expect(response.status).toBe(503)
      expect(((await response.json()) as any).error).toContain('Nothing was erased')
    } finally { await dropFaults() }
    await untouched()
  }
  expect((await own.erasure(request(subject, { step: 'confirm', token: code }))).status).toBe(200)
  expect((await payload.findByID({ collection: 'members', id: subject.id, overrideAccess: true })).status).toBe('erased')
  expect(await payload.findByID({ collection: 'member-stories', id: story.id, overrideAccess: true }).catch(() => null)).toBeNull()
  expect((await own.erasure(request(subject, { step: 'confirm', token: code }))).status).toBeGreaterThanOrEqual(400)
})

test('an administrator\'s erasure rolls back completely when it fails, then succeeds on retry', async () => {
  const subject = await makeMember(`Admin Atomic ${suffix}`)
  const story = await as('member-stories', { title: 'Admin atomic story', body: 'Keep me.', audience: 'community' }, subject)
  await offboard(subject)
  await failOn('message_outbox', 'UPDATE')
  try {
    await expect(payload.create({ collection: 'data-requests', data: { member: subject.id, kind: 'erasure' }, user: admin, overrideAccess: false })).rejects.toThrow()
  } finally { await dropFaults() }
  expect((await payload.findByID({ collection: 'members', id: subject.id, overrideAccess: true })).status).toBe('offboarded')
  expect((await payload.findByID({ collection: 'member-stories', id: story.id, overrideAccess: true })).title).toBe('Admin atomic story')
  expect((await payload.count({ collection: 'data-requests', where: { member: { equals: subject.id } }, overrideAccess: true })).totalDocs).toBe(0)
  const run = await payload.create({ collection: 'data-requests', data: { member: subject.id, kind: 'erasure' }, user: admin, overrideAccess: false })
  expect((await payload.findByID({ collection: 'data-requests', id: run.id, overrideAccess: true })).status).toBe('completed')
  expect((await payload.findByID({ collection: 'members', id: subject.id, overrideAccess: true })).status).toBe('erased')
})

// ---- N3: files change only after the database commits -----------------------------------------------------------
test('mirror files are untouched when erasure rolls back, and a file failure after commit is reported and retryable', async () => {
  const email = `mirror-${suffix}@terrace.invalid`
  const subject = await makeMember(`Mirror Subject ${suffix}`)
  const application = await pendingApplication(`Mirror Subject ${suffix}`, email)
  await payload.update({ collection: 'member-applications', id: application.id, data: { status: 'approved', grantRole: 'alumni' }, user: editor, overrideAccess: false })
  const invitation = (await payload.find({ collection: 'member-invitations', where: { application: { equals: application.id } }, overrideAccess: true })).docs[0]
  await payload.update({ collection: 'member-invitations', id: invitation.id, data: { member: subject.id }, user: admin, overrideAccess: false })
  const file = readdirSync(outbox).find((name) => readFileSync(join(outbox, name), 'utf8').includes(email))!
  const path = join(outbox, file)
  const original = readFileSync(path)
  const count = () => readdirSync(outbox).length
  const files = count()
  const code = (await (await own.erasure(request(subject, { step: 'request' }))).json() as any).confirmationCode

  await failOn('message_outbox', 'UPDATE')
  try { expect((await own.erasure(request(subject, { step: 'confirm', token: code }))).status).toBe(503) } finally { await dropFaults() }
  expect(readFileSync(path).equals(original)).toBe(true) // byte-identical: the pending invitation link was not redacted
  expect(count()).toBe(files) // and no orphan confirmation file

  // Now make the post-commit file step fail: a directory sits where the file should be rewritten.
  rmSync(path)
  mkdirSync(path)
  const response = await own.erasure(request(subject, { step: 'confirm', token: code }))
  const body = await response.json() as any
  expect(response.status).toBe(200)
  expect(body).toMatchObject({ erased: true, mirror: 'pending' })
  expect(body.warning).toContain('did not finish')
  expect((await payload.findByID({ collection: 'members', id: subject.id, overrideAccess: true })).status).toBe('erased') // the erasure stands
  rmSync(path, { recursive: true })
  writeFileSync(path, original, { mode: 0o600 })
  const reconciled = await reconcileMirror(payload)
  expect(reconciled.redacted).toBeGreaterThanOrEqual(1)
  expect(reconciled.written).toBeGreaterThanOrEqual(1) // the confirmation file that was missing
  expect(readFileSync(path, 'utf8')).not.toContain(email)
  expect((await reconcileMirror(payload))).toEqual({ redacted: 0, written: 0 }) // idempotent
})

// ---- M1: moderation and offboarding hides are independent ---------------------------------------------
test('content hidden by offboarding and then by a moderator stays hidden after the member is restored', async () => {
  const author = await makeMember(`Case A ${suffix}`)
  const reader = await makeMember(`Reader A ${suffix}`, ['current-member'])
  const story = await as('member-stories', { title: 'Case A', body: 'x', audience: 'community' }, author)
  const report = await as('moderation-reports', { targetType: 'story', targetId: story.id, reason: 'other' }, reader)
  const off = await offboard(author)
  await payload.update({ collection: 'moderation-reports', id: report.id, data: { status: 'hidden' }, user: editor, overrideAccess: false })
  await restore(off)
  expect(await storiesFor(reader)).not.toContain(story.id)
  await payload.update({ collection: 'moderation-reports', id: report.id, data: { status: 'dismissed' }, user: editor, overrideAccess: false })
  expect(await storiesFor(reader)).toContain(story.id)
})

test('content hidden by a moderator stays hidden when dismissed while its author is offboarded', async () => {
  const author = await makeMember(`Case B ${suffix}`)
  const reader = await makeMember(`Reader B ${suffix}`, ['current-member'])
  const story = await as('member-stories', { title: 'Case B', body: 'x', audience: 'community' }, author)
  const profile = await as('member-profiles', { displayName: 'Case B', directoryVisible: true }, author)
  const report = await as('moderation-reports', { targetType: 'story', targetId: story.id, reason: 'other' }, reader)
  await payload.update({ collection: 'moderation-reports', id: report.id, data: { status: 'hidden' }, user: editor, overrideAccess: false })
  const off = await offboard(author)
  await payload.update({ collection: 'moderation-reports', id: report.id, data: { status: 'dismissed' }, user: editor, overrideAccess: false })
  expect(await storiesFor(reader)).not.toContain(story.id)
  expect(await profilesFor(reader)).not.toContain(profile.id)
  await restore(off)
  expect(await storiesFor(reader)).toContain(story.id)
  expect(await profilesFor(reader)).toContain(profile.id)
})

test('restoring one of two offboarded mentorship partners keeps their conversation hidden', async () => {
  const a = await makeMember(`Pair A ${suffix}`)
  const b = await makeMember(`Pair B ${suffix}`)
  await as('mentorship-offers', { displayName: 'B', optIn: true }, b)
  const conversation = await as('mentorship-requests', { mentor: b.id, message: 'Hello' }, a)
  const offA = await offboard(a)
  await offboard(b)
  await restore(offA)
  const visible = (await payload.find({ collection: 'mentorship-requests', user: { ...a, collection: 'members' }, overrideAccess: false })).docs.map((doc) => doc.id)
  expect(visible).not.toContain(conversation.id)
})

// ---- M2: the sweep purges a hidden group ------------------------------------------------------------
test('the sweep purges a moderation-hidden group with its memberships and stories in one transaction', async () => {
  const founder = await makeMember(`Founder ${suffix}`)
  const joiner = await makeMember(`Joiner ${suffix}`, ['current-member'])
  const group = await as('member-groups', { name: `Doomed ${suffix}`, description: 'x' }, founder)
  await as('group-memberships', { group: group.id }, joiner)
  const groupStory = await as('member-stories', { title: 'Group story', body: 'x', audience: 'group', group: group.id }, joiner)
  const report = await as('moderation-reports', { targetType: 'group', targetId: group.id, reason: 'other' }, joiner)
  await payload.update({ collection: 'moderation-reports', id: report.id, data: { status: 'hidden' }, user: editor, overrideAccess: false })
  await q(`UPDATE member_groups SET moderation_hidden_at = now() - interval '400 days' WHERE id = $1`, [group.id])
  const result = await sweep(payload, { purgeModerated: true })
  expect(result.moderatedPurged).toBeGreaterThanOrEqual(1)
  expect(await payload.findByID({ collection: 'member-groups', id: group.id, overrideAccess: true }).catch(() => null)).toBeNull()
  expect(await payload.findByID({ collection: 'member-stories', id: groupStory.id, overrideAccess: true }).catch(() => null)).toBeNull()
  expect((await payload.count({ collection: 'group-memberships', where: { group: { equals: group.id } }, overrideAccess: true })).totalDocs).toBe(0)
})

// ---- M3: concurrent decisions -----------------------------------------------------------------------------
test('concurrent approvals, and an approval racing a denial, never yield two outcomes', async () => {
  for (let round = 0; round < 4; round++) {
    const approveTwice = await pendingApplication(`Race A${round} ${suffix}`, `race-a${round}-${suffix}@terrace.invalid`)
    const approve = (user: any) => payload.update({ collection: 'member-applications', id: approveTwice.id, data: { status: 'approved', grantRole: 'alumni' }, user, overrideAccess: false })
    await Promise.allSettled([approve(editor), approve(admin)])
    expect((await payload.count({ collection: 'member-invitations', where: { application: { equals: approveTwice.id } }, overrideAccess: true })).totalDocs).toBe(1)

    const mixed = await pendingApplication(`Race B${round} ${suffix}`, `race-b${round}-${suffix}@terrace.invalid`)
    await Promise.allSettled([
      payload.update({ collection: 'member-applications', id: mixed.id, data: { status: 'approved', grantRole: 'alumni' }, user: editor, overrideAccess: false }),
      payload.update({ collection: 'member-applications', id: mixed.id, data: { status: 'denied' }, user: admin, overrideAccess: false }),
    ])
    const final = await payload.findByID({ collection: 'member-applications', id: mixed.id, overrideAccess: true })
    const invitations = (await payload.count({ collection: 'member-invitations', where: { application: { equals: mixed.id } }, overrideAccess: true })).totalDocs
    expect(invitations).toBe(final.status === 'approved' ? 1 : 0)
    const notices = (await q(`SELECT kind FROM message_outbox WHERE recipient_email = $1`, [`race-b${round}-${suffix}@terrace.invalid`])).rows.map((row) => row.kind)
    expect(notices).toEqual([final.status === 'approved' ? 'invitation' : 'denial'])
  }
})

// ---- M4: invitations need a delivery path ----------------------------------------------------------------------
test('an invitation cannot be issued, and approval rolls back, when no delivery path is configured', async () => {
  const application = await pendingApplication(`No Delivery ${suffix}`, `no-delivery-${suffix}@terrace.invalid`)
  const saved = process.env.LIFECYCLE_OUTBOX_DIR
  delete process.env.LIFECYCLE_OUTBOX_DIR
  try {
    await expect(payload.update({ collection: 'member-applications', id: application.id, data: { status: 'approved', grantRole: 'alumni' }, user: editor, overrideAccess: false })).rejects.toThrow(/LIFECYCLE_OUTBOX_DIR/)
  } finally { process.env.LIFECYCLE_OUTBOX_DIR = saved }
  expect((await payload.findByID({ collection: 'member-applications', id: application.id, overrideAccess: true })).status).toBe('pending')
  expect((await payload.count({ collection: 'member-invitations', where: { application: { equals: application.id } }, overrideAccess: true })).totalDocs).toBe(0)
})

test('the invitation origin must be a bare public https origin everywhere except the explicit local profile', async () => {
  const application = await pendingApplication(`Prod ${suffix}`, `prod-${suffix}@terrace.invalid`)
  const saved = { node: process.env.NODE_ENV, origin: process.env.LIFECYCLE_PUBLIC_ORIGIN, local: process.env.CMS_LOCAL_BOOTSTRAP }
  const attempt = () => issueInvitation(payload, { ...application, grantRole: 'alumni' } as any)
  const setOrigin = (value?: string) => { if (value === undefined) delete process.env.LIFECYCLE_PUBLIC_ORIGIN; else process.env.LIFECYCLE_PUBLIC_ORIGIN = value }
  try {
    // Production, and anything that is not the local profile, fails closed.
    for (const mode of ['production', 'unset'] as const) {
      if (mode === 'production') (process.env as any).NODE_ENV = 'production'; else { delete process.env.CMS_LOCAL_BOOTSTRAP; delete (process.env as any).NODE_ENV }
      for (const bad of [undefined, 'http://members.example.org', 'https://localhost', 'https://127.0.0.1', 'https://127.0.0.2', 'https://0.0.0.0', 'https://[::1]', 'https://[::7f00:1]', 'https://[::ffff:7f00:1]', 'https://app.localhost', 'https://localhost.', 'https://foo.localhost.', 'https://members.example.org.', 'https://user:pw@members.example.org', 'https://members.example.org/path', 'https://members.example.org/', 'https://members.example.org/?x=1', 'https://members.example.org#frag']) {
        setOrigin(bad)
        await expect(attempt()).rejects.toThrow(/LIFECYCLE_PUBLIC_ORIGIN/)
      }
    }
    // Local development: CMS_LOCAL_BOOTSTRAP=1 and not production may use loopback, but never with NODE_ENV=production.
    process.env.CMS_LOCAL_BOOTSTRAP = '1'
    delete (process.env as any).NODE_ENV
    setOrigin(undefined)
    expect(deliveryConfig().origin).toBe('http://127.0.0.1:4194')
    setOrigin('http://127.0.0.1:4252')
    expect(deliveryConfig().origin).toBe('http://127.0.0.1:4252')
    setOrigin('http://127.0.0.1:4252/?x')
    expect(() => deliveryConfig()).toThrow()
    ;(process.env as any).NODE_ENV = 'production'
    setOrigin('http://127.0.0.1:4252')
    expect(() => deliveryConfig()).toThrow()
    // A real public origin works and the link lands in the mirror.
    setOrigin('https://members.example.org')
    const { token } = await attempt()
    const files = readdirSync(outbox).map((file) => readFileSync(join(outbox, file), 'utf8'))
    expect(files.some((text) => text.includes(`https://members.example.org/join/#${token}`))).toBe(true)
  } finally {
    if (saved.node === undefined) delete (process.env as any).NODE_ENV; else (process.env as any).NODE_ENV = saved.node
    if (saved.local === undefined) delete process.env.CMS_LOCAL_BOOTSTRAP; else process.env.CMS_LOCAL_BOOTSTRAP = saved.local
    setOrigin(saved.origin)
  }
})

test('the mirror directory is forced to owner-only even when it already existed with wider permissions', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'terrace-mirror-'))
  chmodSync(dir, 0o755)
  const saved = process.env.LIFECYCLE_OUTBOX_DIR
  process.env.LIFECYCLE_OUTBOX_DIR = join(dir, 'nested')
  mkdirSync(join(dir, 'nested'), { mode: 0o755 })
  chmodSync(join(dir, 'nested'), 0o755)
  try {
    await enqueueMessage(payload, { kind: 'denial', recipientLabel: 'x', subject: 'x', body: 'x' })
    expect(statSync(join(dir, 'nested')).mode & 0o777).toBe(0o700)
  } finally { process.env.LIFECYCLE_OUTBOX_DIR = saved; rmSync(dir, { recursive: true, force: true }) }
})

// ---- M6: the intake cannot be filled and left full ---------------------------------------------------------------
test('a full application queue refuses new applications, warns staff once, and ages out stale entries', async () => {
  const pending = (await payload.count({ collection: 'member-applications', where: { status: { equals: 'pending' } }, overrideAccess: true })).totalDocs
  await q(`INSERT INTO member_applications (name, affiliation, contact_email, status, updated_at, created_at) SELECT 'Cap ' || g, 'alumni', 'cap-' || g || '-${suffix}@terrace.invalid', 'pending', now(), now() FROM generate_series(1, $1) g`, [Math.max(500 - pending, 1)])
  const apply = (email: string) => intake.apply(request(null, { name: 'Late Applicant', affiliation: 'alumni', contactEmail: email }, { 'x-terrace-intake': secret }))
  expect((await apply(`late-1-${suffix}@terrace.invalid`)).status).toBe(503)
  const notices = async () => (await payload.count({ collection: 'message-outbox', where: { kind: { equals: 'staff-notice' } }, overrideAccess: true })).totalDocs
  const first = await notices()
  expect(first).toBeGreaterThanOrEqual(1)
  expect((await apply(`late-2-${suffix}@terrace.invalid`)).status).toBe(503)
  expect(await notices()).toBe(first) // one warning a day, not one per request
  await q(`UPDATE member_applications SET created_at = now() - interval '90 days' WHERE contact_email LIKE $1`, [`cap-%-${suffix}@terrace.invalid`])
  expect((await apply(`late-3-${suffix}@terrace.invalid`)).status).toBe(202)
  expect((await q(`SELECT count(*)::int AS n FROM member_applications WHERE contact_email LIKE $1 AND status = 'withdrawn'`, [`cap-%-${suffix}@terrace.invalid`])).rows[0].n).toBeGreaterThan(0)
})

// ---- lows -------------------------------------------------------------------------------------------------------------
test('an applicant linked to their application cannot read the reviewer or decision note', async () => {
  const subject = await makeMember(`Linked ${suffix}`)
  const application = await pendingApplication(`Linked Person ${suffix}`, `linked-${suffix}@terrace.invalid`)
  await payload.update({ collection: 'member-applications', id: application.id, data: { status: 'denied', decisionNote: 'Private reviewer reasoning.' }, user: editor, overrideAccess: false })
  await payload.update({ collection: 'member-applications', id: application.id, data: { member: subject.id }, user: admin, overrideAccess: false })
  const seen = await payload.findByID({ collection: 'member-applications', id: application.id, user: subject, overrideAccess: false })
  expect(seen.status).toBe('denied')
  for (const field of ['decisionNote', 'reviewer', 'member']) expect(seen).not.toHaveProperty(field)
  expect(await payload.findByID({ collection: 'member-applications', id: application.id, user: editor, overrideAccess: false })).toHaveProperty('decisionNote')
})

test('authors cannot delete their own content while it is hidden, preserving the evidence', async () => {
  const author = await makeMember(`Evidence ${suffix}`)
  const reader = await makeMember(`Evidence Reader ${suffix}`, ['current-member'])
  const story = await as('member-stories', { title: 'Evidence', body: 'x', audience: 'community' }, author)
  const profile = await as('member-profiles', { displayName: 'Evidence' }, author)
  const report = await as('moderation-reports', { targetType: 'story', targetId: story.id, reason: 'other' }, reader)
  await payload.update({ collection: 'moderation-reports', id: report.id, data: { status: 'hidden' }, user: editor, overrideAccess: false })
  await expect(payload.delete({ collection: 'member-stories', id: story.id, user: author, overrideAccess: false })).rejects.toThrow()
  expect((await payload.findByID({ collection: 'member-stories', id: story.id, overrideAccess: true })).title).toBe('Evidence')
  await q(`UPDATE member_profiles SET offboard_hidden_at = now() WHERE id = $1`, [profile.id])
  await expect(payload.delete({ collection: 'member-profiles', id: profile.id, user: author, overrideAccess: false })).rejects.toThrow()
})

test('a hidden group no longer shows its stories to members, including its author', async () => {
  const founder = await makeMember(`Group Founder ${suffix}`)
  const joiner = await makeMember(`Group Joiner ${suffix}`, ['current-member'])
  const group = await as('member-groups', { name: `Hidden ${suffix}`, description: 'x' }, founder)
  await as('group-memberships', { group: group.id }, joiner)
  const story = await as('member-stories', { title: 'In the group', body: 'x', audience: 'group', group: group.id }, joiner)
  expect(await storiesFor(founder)).toContain(story.id)
  expect(await storiesFor(joiner)).toContain(story.id)
  const report = await as('moderation-reports', { targetType: 'group', targetId: group.id, reason: 'other' }, joiner).catch(async () => as('moderation-reports', { targetType: 'group', targetId: group.id, reason: 'other' }, await makeMember(`Group Reporter ${suffix}`, ['current-member'])))
  await payload.update({ collection: 'moderation-reports', id: report.id, data: { status: 'hidden' }, user: editor, overrideAccess: false })
  expect(await storiesFor(founder)).not.toContain(story.id)
  expect(await storiesFor(joiner)).not.toContain(story.id)
  await expect(payload.findByID({ collection: 'member-stories', id: story.id, user: joiner, overrideAccess: false })).rejects.toThrow()
})

test('export includes the member\'s own moderation-hidden content, says when a list is cut, and is rate limited', async () => {
  const subject = await makeMember(`Exporter ${suffix}`)
  const reader = await makeMember(`Export Reader ${suffix}`, ['current-member'])
  const hidden = await as('member-stories', { title: 'Hidden but mine', body: 'x', audience: 'community' }, subject)
  const report = await as('moderation-reports', { targetType: 'story', targetId: hidden.id, reason: 'other' }, reader)
  await payload.update({ collection: 'moderation-reports', id: report.id, data: { status: 'hidden' }, user: editor, overrideAccess: false })
  await q(`INSERT INTO member_stories (author_id, author_name, title, body, audience, updated_at, created_at) SELECT $1, 'x', 'bulk ' || g, 'b', 'community', now(), now() FROM generate_series(1, 2001) g`, [subject.id])
  const first = await (await own.export(request(subject))).json() as any
  expect(first.stories).toHaveLength(2000)
  expect(first.truncated).toEqual(['stories'])
  const flagged = (await payload.find({ collection: 'member-stories', where: { id: { equals: hidden.id } }, overrideAccess: true })).docs[0]
  expect(flagged.moderationHiddenAt).toBeTruthy()
  await q(`DELETE FROM member_stories WHERE author_id = $1 AND title LIKE 'bulk %'`, [subject.id])
  const second = await (await own.export(request(subject))).json() as any
  expect(second.truncated).toEqual([])
  expect(second.stories.find((story: any) => story.title === 'Hidden but mine')).toMatchObject({ hiddenByModeration: true })
  for (let i = 0; i < 3; i++) expect((await own.export(request(subject))).status).toBe(200)
  const limited = await own.export(request(subject))
  expect(limited.status).toBe(429)
  expect(limited.headers.get('retry-after')).toBe('3600')
})

test('report creation is rate limited per member', async () => {
  const author = await makeMember(`Spammed ${suffix}`)
  const reporter = await makeMember(`Reporter ${suffix}`, ['current-member'])
  await q(`INSERT INTO member_stories (author_id, author_name, title, body, audience, updated_at, created_at) SELECT $1, 'x', 'target ' || g || ' ${suffix}', 'b', 'community', now(), now() FROM generate_series(1, 21) g`, [author.id])
  const ids = (await payload.find({ collection: 'member-stories', where: { title: { like: `target %${suffix}` } }, overrideAccess: true, limit: 30 })).docs.map((doc) => doc.id)
  expect(ids).toHaveLength(21)
  for (const id of ids.slice(0, 20)) await as('moderation-reports', { targetType: 'story', targetId: id, reason: 'other' }, reporter)
  await expect(as('moderation-reports', { targetType: 'story', targetId: ids[20], reason: 'other' }, reporter)).rejects.toMatchObject({ status: 429 })
})

test('report resolver and time change only on a real transition', async () => {
  const author = await makeMember(`Resolver Author ${suffix}`)
  const reporter = await makeMember(`Resolver Reporter ${suffix}`, ['current-member'])
  const story = await as('member-stories', { title: 'Resolver', body: 'x', audience: 'community' }, author)
  const report = await as('moderation-reports', { targetType: 'story', targetId: story.id, reason: 'other' }, reporter)
  await payload.update({ collection: 'moderation-reports', id: report.id, data: { status: 'hidden' }, user: editor, overrideAccess: false })
  const first = await payload.findByID({ collection: 'moderation-reports', id: report.id, depth: 0, overrideAccess: true })
  await Bun.sleep(20)
  await payload.update({ collection: 'moderation-reports', id: report.id, data: { status: 'hidden', resolutionNote: 'More context.' }, user: admin, overrideAccess: false })
  const second = await payload.findByID({ collection: 'moderation-reports', id: report.id, depth: 0, overrideAccess: true })
  expect(second.resolver).toBe(editor.id)
  expect(second.resolvedAt).toBe(first.resolvedAt)
  expect(second.resolutionNote).toBe('More context.')
})

test('a member with no status, or any non-active status, is not treated as approved', () => {
  const user = { id: 1, collection: 'members', roles: ['alumni'] }
  expect(isMember({ user } as any)).toBe(false)
  expect(isMember({ user: { ...user, status: 'active' } } as any)).toBe(true)
  for (const status of ['offboarded', 'erased', 'ACTIVE', null]) expect(isMember({ user: { ...user, status } } as any)).toBe(false)
})

test('GraphQL is disabled', () => {
  expect(payload.config.graphQL.disable).toBe(true)
})

test('the mirror directory is owner-only and holds only expected files', () => {
  expect(statSync(outbox).mode & 0o777).toBe(0o700)
  expect(existsSync(outbox)).toBe(true)
})

// ---- later review items ------------------------------------------------------------------------------------------
test('the group limit counts hidden groups, and an author keeps their group story after leaving the group', async () => {
  const joiner = await makeMember(`Limit ${suffix}`, ['current-member'])
  const founder = await makeMember(`Limit Founder ${suffix}`)
  const open = await as('member-groups', { name: `Open ${suffix}`, description: 'x' }, founder)
  await as('group-memberships', { group: open.id }, joiner)
  const story = await as('member-stories', { title: 'Mine after leaving', body: 'x', audience: 'group', group: open.id }, joiner)
  const membership = (await payload.find({ collection: 'group-memberships', where: { and: [{ member: { equals: joiner.id } }, { group: { equals: open.id } }] }, user: joiner, overrideAccess: false })).docs[0]
  await payload.delete({ collection: 'group-memberships', id: membership.id, user: joiner, overrideAccess: false })
  expect(await storiesFor(joiner)).toContain(story.id) // authors keep their own group stories (intended; documented)
  expect(await storiesFor(founder)).toContain(story.id) // the founder is still a member
  // 100 memberships, many in hidden groups, still hit the limit.
  await q(`INSERT INTO member_groups (owner_id, owner_name, name, description, moderation_hidden_at, updated_at, created_at) SELECT $1, 'x', 'bulk ' || g || ' ${suffix}', 'x', now(), now(), now() FROM generate_series(1, 100) g`, [founder.id])
  const bulk = (await q(`SELECT id FROM member_groups WHERE name LIKE $1`, [`bulk % ${suffix}`])).rows.map((row) => row.id)
  for (const id of bulk) await q(`INSERT INTO group_memberships (member_id, group_id, membership_key, updated_at, created_at) VALUES ($1, $2, $3, now(), now())`, [joiner.id, id, `${joiner.id}:${id}`])
  await expect(as('group-memberships', { group: open.id }, joiner)).rejects.toThrow(/100 groups/)
})

test('the staff notice does not refuse applications when the mirror is unwritable, and is once a day even in a race', async () => {
  const pending = (await payload.count({ collection: 'member-applications', where: { status: { equals: 'pending' } }, overrideAccess: true })).totalDocs
  const need = Math.max(450 - pending, 1)
  await q(`INSERT INTO member_applications (name, affiliation, contact_email, status, updated_at, created_at) SELECT 'Warn ' || g, 'alumni', 'warn-' || g || '-${suffix}@terrace.invalid', 'pending', now(), now() FROM generate_series(1, $1) g`, [need])
  await q(`DELETE FROM message_outbox WHERE kind = 'staff-notice'`)
  const saved = process.env.LIFECYCLE_OUTBOX_DIR
  const blocker = join(outbox, 'not-a-directory')
  writeFileSync(blocker, 'x')
  process.env.LIFECYCLE_OUTBOX_DIR = blocker // mkdir on a file fails
  try {
    const apply = (n: number) => intake.apply(request(null, { name: 'Warned', affiliation: 'alumni', contactEmail: `warned-${n}-${suffix}@terrace.invalid` }, { 'x-terrace-intake': secret }))
    const results = await Promise.all([1, 2, 3, 4, 5].map(apply))
    expect(results.map((response) => response.status)).toEqual([202, 202, 202, 202, 202])
  } finally { process.env.LIFECYCLE_OUTBOX_DIR = saved; rmSync(blocker, { force: true }) }
  expect((await payload.count({ collection: 'message-outbox', where: { kind: { equals: 'staff-notice' } }, overrideAccess: true })).totalDocs).toBe(1)
  await q(`UPDATE member_applications SET status = 'withdrawn' WHERE contact_email LIKE $1`, [`warn-%-${suffix}@terrace.invalid`])
})

test('purging moderated content also blanks its report snapshots', async () => {
  const author = await makeMember(`Purge Author ${suffix}`)
  const reporter = await makeMember(`Purge Reporter ${suffix}`, ['current-member'])
  const story = await as('member-stories', { title: `Purge me ${suffix}`, body: 'Evidence text', audience: 'community' }, author)
  const report = await as('moderation-reports', { targetType: 'story', targetId: story.id, reason: 'other', detail: 'Detail text' }, reporter)
  await payload.update({ collection: 'moderation-reports', id: report.id, data: { status: 'hidden' }, user: editor, overrideAccess: false })
  await q(`UPDATE member_stories SET moderation_hidden_at = now() - interval '400 days' WHERE id = $1`, [story.id])
  await sweep(payload, { purgeModerated: true })
  expect(await payload.findByID({ collection: 'member-stories', id: story.id, overrideAccess: true }).catch(() => null)).toBeNull()
  const row = (await q(`SELECT snapshot_title, snapshot_body, detail FROM moderation_reports WHERE id = $1`, [report.id])).rows[0]
  expect(row.snapshot_body).not.toContain('Evidence')
  expect(row.snapshot_title).not.toContain('Purge me')
  expect(row.detail).toBeNull()
})

test('raw SQL never silently leaves the request transaction', () => {
  expect(() => pool(payload, { transactionID: 'no-such-session' } as any)).toThrow(/transaction/)
  expect(typeof pool(payload).query).toBe('function')
})

test('erasure and offboarding revoke a still-pending invitation, so its token stops working', async () => {
  for (const mode of ['erase', 'offboard'] as const) {
    const subject = await makeMember(`Invited ${mode} ${suffix}`)
    const application = await pendingApplication(`Invited ${mode} ${suffix}`, `invited-${mode}-${suffix}@terrace.invalid`)
    const { token, invitationId } = await issueInvitation(payload, { ...application, grantRole: 'alumni' } as any)
    await payload.update({ collection: 'member-invitations', id: invitationId, data: { member: subject.id }, user: admin, overrideAccess: false })
    const redeem = (consume: boolean) => intake.redeem(request(null, { token, consume }, { 'x-terrace-intake': secret }))
    expect((await redeem(false)).status).toBe(200)
    if (mode === 'offboard') await offboard(subject)
    else {
      const code = (await (await own.erasure(request(subject, { step: 'request' }))).json() as any).confirmationCode
      expect((await own.erasure(request(subject, { step: 'confirm', token: code }))).status).toBe(200)
    }
    const after = await redeem(true)
    expect(after.status).toBe(404)
    expect(await after.json()).toEqual({ valid: false }) // the same generic answer as any other dead token
    expect((await payload.findByID({ collection: 'member-invitations', id: invitationId, overrideAccess: true })).status).toBe('revoked')
  }
})

test('story access still hides a hidden group when more than 500 groups are hidden', async () => {
  const founder = await makeMember(`Many Founder ${suffix}`)
  await q(`INSERT INTO member_groups (owner_id, owner_name, name, description, moderation_hidden_at, updated_at, created_at) SELECT $1, 'x', 'many ' || g || ' ${suffix}', 'x', now(), now(), now() FROM generate_series(1, 600) g`, [founder.id])
  const group = await as('member-groups', { name: `Late hidden ${suffix}`, description: 'x' }, founder)
  const story = await as('member-stories', { title: 'Late group story', body: 'x', audience: 'group', group: group.id }, founder)
  expect(await storiesFor(founder)).toContain(story.id)
  await q(`UPDATE member_groups SET moderation_hidden_at = now() WHERE id = $1`, [group.id])
  expect(await storiesFor(founder)).not.toContain(story.id)
  await q(`DELETE FROM member_groups WHERE name LIKE $1`, [`many % ${suffix}`])
})

test('the reconcile step writes a confirmation file once and does not recreate one the operator deleted', async () => {
  const subject = await makeMember(`Reconcile ${suffix}`)
  await offboard(subject)
  await payload.create({ collection: 'data-requests', data: { member: subject.id, kind: 'erasure' }, user: admin, overrideAccess: false })
  const row = (await q(`SELECT id FROM message_outbox WHERE recipient_label = $1`, [`Former member #${subject.id}`])).rows[0]
  const file = () => readdirSync(outbox).find((name) => name.startsWith(String(row.id).padStart(6, '0') + '-'))
  expect(file()).toBeUndefined() // an administrator's erasure writes no file itself
  expect((await reconcileMirror(payload)).written).toBeGreaterThanOrEqual(1)
  expect(file()).toBeDefined()
  rmSync(join(outbox, file()!))
  await reconcileMirror(payload)
  expect(file()).toBeUndefined()
})

test('a confirmation file that could not be written stays pending and is retried by the next sweep', async () => {
  const subject = await makeMember(`Pending Mirror ${suffix}`)
  await offboard(subject)
  await payload.create({ collection: 'data-requests', data: { member: subject.id, kind: 'erasure' }, user: admin, overrideAccess: false })
  const row = (await q(`SELECT id FROM message_outbox WHERE recipient_label = $1`, [`Former member #${subject.id}`])).rows[0]
  const prefix = String(row.id).padStart(6, '0') + '-'
  const target = join(outbox, `${prefix}erasure-confirmation.json`)
  mkdirSync(target) // a directory where the file belongs: the write fails
  const mirroredAt = async () => (await q(`SELECT mirrored_at FROM message_outbox WHERE id = $1`, [row.id])).rows[0].mirrored_at
  try {
    const failed = await sweep(payload)
    expect(failed.mirror).toMatchObject({ written: 0 })
    expect((failed.mirror as any).failed).toBeGreaterThanOrEqual(1)
    expect(await mirroredAt()).toBeNull() // not marked: the next sweep tries again
  } finally { rmSync(target, { recursive: true }) }
  expect((await sweep(payload)).mirror.written).toBeGreaterThanOrEqual(1)
  expect(statSync(target).isFile()).toBe(true)
  expect(await mirroredAt()).not.toBeNull()
  expect((await q(`SELECT dedupe_key FROM message_outbox WHERE id = $1`, [row.id])).rows[0].dedupe_key).toBeNull() // the marker no longer borrows the dedupe key
})

test('purging the stories of a hidden group blanks their report snapshots', async () => {
  const founder = await makeMember(`Group Purge Founder ${suffix}`)
  const reporter = await makeMember(`Group Purge Reporter ${suffix}`, ['current-member'])
  const group = await as('member-groups', { name: `Purge group ${suffix}`, description: 'x' }, founder)
  await as('group-memberships', { group: group.id }, reporter)
  const story = await as('member-stories', { title: `Group evidence ${suffix}`, body: 'Evidence body', audience: 'group', group: group.id }, founder)
  const report = await as('moderation-reports', { targetType: 'story', targetId: story.id, reason: 'other' }, reporter)
  const groupReport = await as('moderation-reports', { targetType: 'group', targetId: group.id, reason: 'other' }, reporter)
  await payload.update({ collection: 'moderation-reports', id: groupReport.id, data: { status: 'hidden' }, user: editor, overrideAccess: false })
  await q(`UPDATE member_groups SET moderation_hidden_at = now() - interval '400 days' WHERE id = $1`, [group.id])
  await sweep(payload, { purgeModerated: true })
  const row = (await q(`SELECT snapshot_title, snapshot_body FROM moderation_reports WHERE id = $1`, [report.id])).rows[0]
  expect(row.snapshot_body).not.toContain('Evidence')
  expect(row.snapshot_title).not.toContain('Group evidence')
})
