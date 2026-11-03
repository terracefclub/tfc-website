import { afterAll, beforeAll, expect, test } from 'bun:test'
import { getPayload, type Payload } from 'payload'
import config from '../src/payload.config'

const suffix = crypto.randomUUID()
let payload: Payload
let current: any
let alumni: any
let outsider: any
let profile: any
let group: any
let groupStory: any
let membership: any
let offer: any
let request: any
const created: Array<{ collection: any; id: number }> = []

async function create(collection: any, data: any, user: any) {
  const doc = await payload.create({ collection, data, user, overrideAccess: false })
  created.unshift({ collection, id: doc.id })
  return doc
}

beforeAll(async () => {
  if (process.env.CMS_LOCAL_BOOTSTRAP !== '1') throw new Error('Community tests require isolated local data.')
  payload = await getPayload({ config, key: 'community-tests' })
  for (const [name, roles] of [['Current Terran', ['current-member']], ['Alumni Terran', ['alumni']], ['Other Terran', ['alumni']]] as const) {
    const record = await payload.create({ collection: 'members', overrideAccess: true, data: { identityKey: `${suffix}-${name}`, issuer: 'http://127.0.0.1:8080/realms/test', subject: `${suffix}-${name}`, displayName: name, roles: [...roles] } })
    const user = { ...record, collection: 'members' }
    created.push({ collection: 'members', id: record.id })
    if (!current) current = user
    else if (!alumni) alumni = user
    else outsider = user
  }
})

afterAll(async () => {
  for (const item of created) await payload.delete({ ...item, overrideAccess: true }).catch(() => {})
  await payload.db.destroy?.()
})

test('anonymous visitors and editorial users cannot read or write community collections', async () => {
  const collections = ['member-profiles', 'member-stories', 'member-groups', 'group-memberships', 'mentorship-offers', 'mentorship-requests'] as const
  for (const collection of collections) {
    await expect(payload.find({ collection, overrideAccess: false })).rejects.toThrow()
    await expect(payload.find({ collection, user: { id: current.id, role: 'admin', collection: 'users' } as any, overrideAccess: false })).rejects.toThrow()
  }
  await expect(payload.create({ collection: 'member-stories', data: { title: 'No', body: 'No' }, overrideAccess: false })).rejects.toThrow()
})

test('profile ownership is assigned by the server and directory sharing is explicit', async () => {
  profile = await create('member-profiles', { member: alumni.id, displayName: 'Current Terran', bio: '<script>not markup</script>' }, current)
  expect(profile.member).toBe(current.id)
  expect(profile.directoryVisible).toBe(false)
  expect((await payload.find({ collection: 'member-profiles', user: alumni, overrideAccess: false })).totalDocs).toBe(0)
  await expect(payload.update({ collection: 'member-profiles', id: profile.id, data: { bio: 'not yours' }, user: alumni, overrideAccess: false })).rejects.toThrow()
  const visible = await payload.update({ collection: 'member-profiles', id: profile.id, data: { directoryVisible: true, member: alumni.id }, user: current, overrideAccess: false })
  expect(visible.member).toBe(current.id)
  expect((await payload.find({ collection: 'member-profiles', user: alumni, overrideAccess: false })).docs[0]?.bio).toBe('<script>not markup</script>')
  const expanded = await payload.findByID({ collection: 'member-profiles', id: profile.id, user: alumni, overrideAccess: false, depth: 10 })
  expect(expanded.member).toBe(current.id)
  expect(expanded).not.toHaveProperty('issuer')
  await expect(create('member-profiles', { displayName: 'Duplicate' }, current)).rejects.toThrow()
  await expect(payload.update({ collection: 'member-profiles', id: profile.id, data: { bio: 'x'.repeat(2001) }, user: current, overrideAccess: false })).rejects.toThrow()
})

test('community stories are member-only and cannot be changed by another member', async () => {
  const story = await create('member-stories', { author: alumni.id, title: 'A night at Terrace', body: '<img src=x onerror=alert(1)>', audience: 'community' }, current)
  expect(story.author).toBe(current.id)
  expect(story.authorName).toBe('Current Terran')
  const visible = await payload.findByID({ collection: 'member-stories', id: story.id, user: alumni, overrideAccess: false })
  expect(visible.body).toBe('<img src=x onerror=alert(1)>')
  await expect(payload.update({ collection: 'member-stories', id: story.id, data: { body: 'Changed' }, user: alumni, overrideAccess: false })).rejects.toThrow()
  await expect(payload.delete({ collection: 'member-stories', id: story.id, user: alumni, overrideAccess: false })).rejects.toThrow()
})

test('group creation joins its founder and group stories stay inside the group', async () => {
  group = await create('member-groups', { name: 'Pool-table people', description: 'Synthetic test group.' }, current)
  const founder = await payload.find({ collection: 'group-memberships', user: current, overrideAccess: false, where: { group: { equals: group.id } } })
  expect(founder.totalDocs).toBe(1)
  created.unshift({ collection: 'group-memberships', id: founder.docs[0].id })
  groupStory = await create('member-stories', { title: 'Only at our table', body: 'A group story.', audience: 'group', group: group.id }, current)
  expect((await payload.find({ collection: 'member-stories', user: alumni, overrideAccess: false, where: { id: { equals: groupStory.id } } })).totalDocs).toBe(0)
  await expect(create('member-stories', { title: 'Not joined', body: 'No.', audience: 'group', group: group.id }, alumni)).rejects.toThrow()
  await expect(payload.delete({ collection: 'group-memberships', id: founder.docs[0].id, user: current, overrideAccess: false })).rejects.toThrow(/founder/)
})

test('join and leave change group access; membership cannot be created for another person', async () => {
  membership = await create('group-memberships', { member: outsider.id, group: group.id, membershipKey: 'forged' }, alumni)
  expect(membership.member).toBe(alumni.id)
  expect(membership).not.toHaveProperty('membershipKey')
  expect((await payload.findByID({ collection: 'member-stories', id: groupStory.id, user: alumni, overrideAccess: false })).id).toBe(groupStory.id)
  await expect(create('group-memberships', { group: group.id }, alumni)).rejects.toThrow()
  await expect(payload.delete({ collection: 'group-memberships', id: membership.id, user: outsider, overrideAccess: false })).rejects.toThrow()
  await payload.delete({ collection: 'group-memberships', id: membership.id, user: alumni, overrideAccess: false })
  expect((await payload.find({ collection: 'member-stories', user: alumni, overrideAccess: false, where: { id: { equals: groupStory.id } } })).totalDocs).toBe(0)
})

test('mentorship is opt-in, can be withdrawn, and requests are private to their participants', async () => {
  offer = await create('mentorship-offers', { displayName: 'Alumni Terran', topics: 'Cooking and music' }, alumni)
  expect(offer.optIn).toBe(false)
  expect((await payload.find({ collection: 'mentorship-offers', user: current, overrideAccess: false })).totalDocs).toBe(0)
  await expect(create('mentorship-requests', { mentor: alumni.id, message: 'Hello' }, current)).rejects.toThrow(/not accepting/)
  await payload.update({ collection: 'mentorship-offers', id: offer.id, data: { optIn: true }, user: alumni, overrideAccess: false })
  request = await create('mentorship-requests', { requester: outsider.id, mentor: alumni.id, message: 'Could we talk about cooking?', status: 'accepted' }, current)
  expect(request.requester).toBe(current.id)
  expect(request.status).toBe('pending')
  expect((await payload.find({ collection: 'mentorship-requests', user: outsider, overrideAccess: false })).totalDocs).toBe(0)
  await expect(payload.update({ collection: 'mentorship-requests', id: request.id, data: { status: 'accepted' }, user: current, overrideAccess: false })).rejects.toThrow()
  const accepted = await payload.update({ collection: 'mentorship-requests', id: request.id, data: { status: 'accepted', mentor: outsider.id, message: 'forged', reply: 'Let’s talk about cooking.' }, user: alumni, overrideAccess: false })
  expect(accepted.mentor).toBe(alumni.id)
  expect(accepted.message).toBe('Could we talk about cooking?')
  expect(accepted.status).toBe('accepted')
  expect(accepted.reply).toBe('Let’s talk about cooking.')
  await payload.update({ collection: 'mentorship-offers', id: offer.id, data: { optIn: false }, user: alumni, overrideAccess: false })
  expect((await payload.find({ collection: 'mentorship-offers', user: current, overrideAccess: false })).totalDocs).toBe(0)
  await expect(create('mentorship-requests', { mentor: alumni.id, message: 'Another' }, outsider)).rejects.toThrow()
  await payload.delete({ collection: 'mentorship-requests', id: request.id, user: current, overrideAccess: false })
})

test('a report preserves only the selected story for administrators and cannot bypass group privacy', async () => {
  const readers = [null, alumni, current, { id: current.id, role: 'admin', collection: 'members' }, { id: current.id, role: 'editor', collection: 'users' }]
  const admin = { id: current.id, role: 'admin', collection: 'users' } as any
  const room = await create('member-groups', { name: 'Private test room', description: 'Only its members see these stories.' }, current)
  const story = await create('member-stories', { title: 'Original title', body: 'A group-only story.', audience: 'group', group: room.id }, current)
  const reportData = { storyId: story.id, reason: 'privacy', reportKey: 'forged', storyTitle: 'Spoof', authorName: 'Spoof', storyBody: 'Spoof', status: 'reviewed' }
  for (const user of [null, alumni, admin]) await expect(create('story-reports', reportData, user)).rejects.toThrow()
  await create('group-memberships', { group: room.id }, alumni)
  const report = await create('story-reports', reportData, alumni)
  expect(report.status).toBe('open')
  expect(report).toMatchObject({ storyId: story.id, storyTitle: 'Original title', storyBody: 'A group-only story.', authorName: 'Current Terran', reason: 'privacy' })
  await expect(create('story-reports', { ...reportData, reportKey: 'another' }, alumni)).rejects.toThrow()
  await expect(create('story-reports', { storyId: story.id, reason: 'invented' }, current)).rejects.toThrow()
  for (const user of readers) {
    await expect(payload.find({ collection: 'story-reports', user: user as any, overrideAccess: false })).rejects.toThrow()
    await expect(payload.update({ collection: 'story-reports', id: report.id, user: user as any, data: { status: 'reviewed' }, overrideAccess: false })).rejects.toThrow()
    await expect(payload.delete({ collection: 'story-reports', id: report.id, user: user as any, overrideAccess: false })).rejects.toThrow()
  }
  await payload.update({ collection: 'member-stories', id: story.id, user: current, data: { title: 'Changed title', body: 'Changed story' }, overrideAccess: false })
  const snapshot = await payload.findByID({ collection: 'story-reports', id: report.id, user: admin, overrideAccess: false })
  expect(snapshot.storyTitle).toBe('Original title')
  expect(snapshot.storyBody).toBe('A group-only story.')
  await payload.delete({ collection: 'member-stories', id: story.id, user: current, overrideAccess: false })
  await expect(payload.findByID({ collection: 'member-stories', id: groupStory.id, user: admin, overrideAccess: false })).rejects.toThrow()
  const reviewed = await payload.update({ collection: 'story-reports', id: report.id, user: admin, data: { ...reportData, reason: 'other', storyId: 999 }, overrideAccess: false })
  expect(reviewed).toMatchObject({ storyId: story.id, storyTitle: 'Original title', storyBody: 'A group-only story.', authorName: 'Current Terran', reason: 'privacy', status: 'reviewed' })
  expect(reviewed).not.toHaveProperty('reportKey')
  await payload.delete({ collection: 'story-reports', id: report.id, user: admin, overrideAccess: false })
})

test('excessive writes are rejected without applying another change', async () => {
  const record = await payload.create({ collection: 'members', overrideAccess: true, data: { identityKey: `${suffix}-rate`, issuer: 'http://127.0.0.1:8080/realms/test', subject: `${suffix}-rate`, displayName: 'Rate test member', roles: ['alumni'] } })
  created.push({ collection: 'members', id: record.id })
  const user = { ...record, collection: 'members' } as any
  const entry = await create('member-profiles', { displayName: 'Rate test member' }, user)
  for (let index = 0; index < 29; index++) await payload.update({ collection: 'member-profiles', id: entry.id, data: { bio: String(index) }, user, overrideAccess: false })
  await expect(payload.update({ collection: 'member-profiles', id: entry.id, data: { bio: 'not saved' }, user, overrideAccess: false })).rejects.toMatchObject({ status: 429 })
  expect((await payload.findByID({ collection: 'member-profiles', id: entry.id, user, overrideAccess: false })).bio).toBe('28')
})

const httpTest = process.env.CMS_HTTP_URL ? test : test.skip
httpTest('community REST endpoints deny anonymous and forged identities without cacheable private responses', async () => {
  for (const collection of ['member-profiles', 'member-stories', 'story-reports', 'member-groups', 'group-memberships', 'mentorship-offers', 'mentorship-requests']) {
    for (const headers of [{}, { authorization: 'Bearer not-a-valid-token' }]) {
      const response = await fetch(new URL(`/api/${collection}?depth=999&limit=0`, process.env.CMS_HTTP_URL), { headers })
      expect([401, 403]).toContain(response.status)
      expect(response.headers.get('cache-control')).toContain('no-store')
      expect(response.headers.get('x-robots-tag')).toContain('noindex')
      const body = await response.text()
      expect(body).not.toContain('Current Terran')
      expect(body).not.toContain('Pool-table people')
    }
  }
})
