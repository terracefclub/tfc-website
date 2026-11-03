import { afterAll, beforeAll, expect, test } from 'bun:test'
import { getPayload } from 'payload'
import config from '../src/payload.config'

const suffix = crypto.randomUUID().slice(0, 8)
const slug = `test-event-${suffix}`
const editorEmail = `editor-${suffix}@terrace.invalid`
let payload: Awaited<ReturnType<typeof getPayload>>
let admin: any
let editor: any
let eventId: string | number | undefined
let editorId: string | number | undefined
let mediaId: string | number | undefined
let initiativeId: string | number | undefined
let pdfMediaId: string | number | undefined
let newsletterId: string | number | undefined

beforeAll(async () => {
  if (process.env.CMS_LOCAL_BOOTSTRAP !== '1') throw new Error('Integration tests require the isolated local profile.')
  payload = await getPayload({ config })
  const login = await payload.login({ collection: 'users', data: { email: process.env.CMS_BOOTSTRAP_EMAIL!, password: process.env.CMS_BOOTSTRAP_PASSWORD! } })
  admin = { ...login.user, collection: 'users' }
  const created = await payload.create({ collection: 'users', data: { email: editorEmail, password: `local-${crypto.randomUUID()}`, displayName: 'Integration editor', role: 'editor' }, user: admin, overrideAccess: false })
  editor = { ...created, collection: 'users' }
  editorId = created.id
})

afterAll(async () => {
  if (eventId) await payload.delete({ collection: 'events', id: eventId, overrideAccess: true })
  if (initiativeId) await payload.delete({ collection: 'initiatives', id: initiativeId, overrideAccess: true })
  if (newsletterId) await payload.delete({ collection: 'newsletters', id: newsletterId, overrideAccess: true })
  if (mediaId) await payload.delete({ collection: 'media', id: mediaId, overrideAccess: true })
  if (pdfMediaId) await payload.delete({ collection: 'media', id: pdfMediaId, overrideAccess: true })
  if (editorId) await payload.delete({ collection: 'users', id: editorId, overrideAccess: true })
  await payload.db.destroy?.()
})

test('drafts stay private, and publishing makes the current version public', async () => {
  await expect(payload.create({ collection: 'events', data: { slug: `bad-date-${suffix}`, title: 'Bad date', summary: 'Synthetic.', startsAt: '2030-01-18T23:00:00.000Z', endsAt: '2030-01-18T22:00:00.000Z', category: 'food', locationName: 'Test only' }, user: editor, overrideAccess: false })).rejects.toThrow(/after/)
  const created = await payload.create({
    collection: 'events',
    data: { slug, title: 'Integration draft', summary: 'Synthetic test item.', startsAt: '2030-01-18T23:00:00.000Z', category: 'food', locationName: 'Test only', _status: 'draft' },
    user: editor, overrideAccess: false,
  })
  eventId = created.id
  const privateList = await payload.find({ collection: 'events', where: { slug: { equals: slug } }, overrideAccess: false })
  expect(privateList.totalDocs).toBe(0)
  const requestedDraft = await payload.find({ collection: 'events', where: { slug: { equals: slug } }, draft: true, overrideAccess: false })
  expect(requestedDraft.totalDocs).toBe(0)
  const editorList = await payload.find({ collection: 'events', where: { slug: { equals: slug } }, user: editor, overrideAccess: false })
  expect(editorList.totalDocs).toBe(1)
  const published = await payload.update({ collection: 'events', id: eventId, data: { title: 'Integration published', _status: 'published' }, user: editor, overrideAccess: false })
  expect(published._status).toBe('published')
  const publicList = await payload.find({ collection: 'events', where: { slug: { equals: slug } }, overrideAccess: false })
  expect(publicList.docs[0]?.title).toBe('Integration published')
  await payload.update({ collection: 'events', id: eventId, data: { title: 'Private revision' }, draft: true, user: editor, overrideAccess: false })
  const stillPublic = await payload.find({ collection: 'events', where: { slug: { equals: slug } }, overrideAccess: false })
  expect(stillPublic.docs[0]?.title).toBe('Integration published')
})

test('editor cannot create users or grant admin role', async () => {
  await expect(payload.create({ collection: 'users', data: { email: `forbidden-${suffix}@terrace.invalid`, password: 'a-long-local-password', displayName: 'Forbidden', role: 'admin' }, user: editor, overrideAccess: false })).rejects.toThrow()
  const selfUpdate = await payload.update({ collection: 'users', id: editorId!, data: { role: 'admin' }, user: editor, overrideAccess: false })
  expect(selfUpdate.role).toBe('editor')
})

test('managed identities cannot log in with a password in local fallback mode', async () => {
  const email = `fallback-${suffix}@terrace.invalid`
  const password = crypto.randomUUID()
  const user = await payload.create({ collection: 'users', data: { email, password, identityKey: crypto.randomUUID(), displayName: 'Managed identity', role: 'admin' }, overrideAccess: true })
  try {
    await expect(payload.login({ collection: 'users', data: { email, password } })).rejects.toThrow()
  } finally {
    await payload.delete({ collection: 'users', id: user.id, overrideAccess: true })
  }
})

test('a member identity with a colliding ID cannot enter editorial accounts or versions', async () => {
  const member: any = { id: editorId, collection: 'members', role: 'admin' }
  await expect(payload.find({ collection: 'users', user: member, overrideAccess: false })).rejects.toThrow()
  await expect(payload.update({ collection: 'users', id: editorId!, data: { displayName: 'Not an editor' }, user: member, overrideAccess: false })).rejects.toThrow()
  await expect(payload.findVersions({ collection: 'events', user: member, overrideAccess: false })).rejects.toThrow()
  await expect(payload.findVersions({ collection: 'newsletters', user: member, overrideAccess: false })).rejects.toThrow()
  await expect(payload.findVersions({ collection: 'initiatives', user: member, overrideAccess: false })).rejects.toThrow()
  await expect(payload.create({ collection: 'users', data: { email: 'member-escalation@terrace.invalid', password: 'synthetic-only-password', displayName: 'Denied', role: 'admin' }, user: member, overrideAccess: false })).rejects.toThrow()
})

test('private media is hidden, and a public item cannot reference it', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl7L2sAAAAASUVORK5CYII=', 'base64')
  const media = await payload.create({ collection: 'media', data: { alt: 'Synthetic test pixel', public: false }, file: { data: png, mimetype: 'image/png', name: `test-${suffix}.png`, size: png.length }, user: editor, overrideAccess: false })
  mediaId = media.id
  const privateList = await payload.find({ collection: 'media', where: { id: { equals: media.id } }, overrideAccess: false })
  expect(privateList.totalDocs).toBe(0)
  await expect(payload.create({ collection: 'initiatives', data: { slug: `test-initiative-${suffix}`, title: 'Test', summary: 'Synthetic.', coverImage: media.id, _status: 'published' }, user: editor, overrideAccess: false })).rejects.toThrow(/public/)
  await payload.update({ collection: 'media', id: media.id, data: { public: true }, user: editor, overrideAccess: false })
  const publicList = await payload.find({ collection: 'media', where: { id: { equals: media.id } }, overrideAccess: false })
  expect(publicList.totalDocs).toBe(1)
  const published = await payload.create({ collection: 'initiatives', data: { slug: `test-initiative-${suffix}`, title: 'Synthetic initiative', summary: 'Synthetic.', coverImage: media.id, _status: 'published' }, user: editor, overrideAccess: false })
  initiativeId = published.id
  await expect(payload.update({ collection: 'media', id: media.id, data: { public: false }, user: editor, overrideAccess: false })).rejects.toThrow(/published item/)
  await expect(payload.delete({ collection: 'media', id: media.id, user: admin, overrideAccess: false })).rejects.toThrow(/published item/)
})

test('published newsletter requires an actual public PDF', async () => {
  await expect(payload.create({ collection: 'newsletters', data: { slug: `test-news-${suffix}`, title: 'Test issue', issueDate: '2030-01-01T00:00:00.000Z', summary: 'Synthetic.', _status: 'published' }, user: editor, overrideAccess: false })).rejects.toThrow(/PDF/)
  await expect(payload.create({ collection: 'newsletters', data: { slug: `test-news-image-${suffix}`, title: 'Test issue', issueDate: '2030-01-01T00:00:00.000Z', summary: 'Synthetic.', issuePdf: mediaId!, _status: 'published' }, user: editor, overrideAccess: false })).rejects.toThrow(/PDF/)
  const fake = Buffer.from('<html>not a PDF</html>')
  await expect(payload.create({ collection: 'media', data: { alt: 'Fake PDF', public: true }, file: { data: fake, mimetype: 'application/pdf', name: 'fake.pdf', size: fake.length }, user: editor, overrideAccess: false })).rejects.toThrow()
})

test('editor can publish a newsletter with a public PDF', async () => {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>',
  ]
  let pdfText = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdfText)); pdfText += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = Buffer.byteLength(pdfText)
  pdfText += `xref\n0 4\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Root 1 0 R /Size 4 >>\nstartxref\n${xref}\n%%EOF\n`
  const pdf = Buffer.from(pdfText)
  const media = await payload.create({ collection: 'media', data: { alt: 'Synthetic blank PDF', public: true }, file: { data: pdf, mimetype: 'application/pdf', name: `issue-${suffix}.pdf`, size: pdf.length }, user: editor, overrideAccess: false })
  pdfMediaId = media.id
  const draft = await payload.create({ collection: 'newsletters', data: { slug: `test-news-success-${suffix}`, title: 'Synthetic newsletter', issueDate: '2030-01-01T00:00:00.000Z', summary: 'Synthetic.', _status: 'draft' }, user: editor, overrideAccess: false })
  newsletterId = draft.id
  const published = await payload.update({ collection: 'newsletters', id: draft.id, data: { issuePdf: media.id, _status: 'published' }, user: editor, overrideAccess: false })
  expect(published._status).toBe('published')
  const publicList = await payload.find({ collection: 'newsletters', where: { id: { equals: draft.id } }, overrideAccess: false, depth: 1 })
  expect(publicList.totalDocs).toBe(1)
  expect(typeof publicList.docs[0]?.issuePdf).toBe('object')
  await expect(payload.update({ collection: 'newsletters', id: draft.id, data: { issuePdf: null }, user: editor, overrideAccess: false })).rejects.toThrow(/PDF/)
})

const base = process.env.CMS_HTTP_URL
const httpTest = base ? test : test.skip
httpTest('direct URL denies private media and serves explicitly public media', async () => {
  const loginResponse = await fetch(new URL('/api/users/login', base), {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: process.env.CMS_BOOTSTRAP_EMAIL, password: process.env.CMS_BOOTSTRAP_PASSWORD }),
  })
  expect(loginResponse.status).toBe(200)
  const loginBody = await loginResponse.json() as { user?: { role?: string } }
  expect(loginBody.user?.role).toBe('admin')
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl7L2sAAAAASUVORK5CYII=', 'base64')
  const media = await payload.create({ collection: 'media', data: { alt: 'HTTP privacy test', public: false }, file: { data: png, mimetype: 'image/png', name: `http-${crypto.randomUUID()}.png`, size: png.length }, user: editor, overrideAccess: false })
  try {
    expect(new URL(media.url!, base).pathname).toStartWith('/api/media/file/')
    const privateResponse = await fetch(new URL(media.url!, base))
    expect([401, 403, 404]).toContain(privateResponse.status)
    await payload.update({ collection: 'media', id: media.id, data: { public: true }, user: editor, overrideAccess: false })
    const publicResponse = await fetch(new URL(media.url!, base))
    expect(publicResponse.status).toBe(200)
    expect(publicResponse.headers.get('content-type')).toStartWith('image/png')
    expect((await publicResponse.arrayBuffer()).byteLength).toBeGreaterThan(0)
  } finally {
    await payload.delete({ collection: 'media', id: media.id, overrideAccess: true })
  }
})
