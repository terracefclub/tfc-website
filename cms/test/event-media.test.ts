import { afterAll, beforeAll, expect, test } from 'bun:test'
import { getPayload } from 'payload'
import config from '../src/payload.config'

const suffix = crypto.randomUUID().slice(0, 8)
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl7L2sAAAAASUVORK5CYII=', 'base64')
let payload: Awaited<ReturnType<typeof getPayload>>
let editor: any
let editorId: string | number | undefined
const mediaIds: Array<string | number> = []
const eventIds: Array<string | number> = []

const upload = async (data: Record<string, unknown>, file = { data: png, mimetype: 'image/png', name: `poster-${crypto.randomUUID()}.png`, size: png.length }) => {
  const media = await payload.create({ collection: 'media', data: data as any, file, user: editor, overrideAccess: false })
  mediaIds.push(media.id)
  return media
}
const createEvent = async (name: string, data: Record<string, unknown>) => {
  const event = await payload.create({
    collection: 'events', user: editor, overrideAccess: false,
    data: { slug: `media-${name}-${suffix}`, title: `Poster ${name}`, summary: 'Synthetic test item.', startsAt: '2030-02-01T23:00:00.000Z', category: 'community', locationName: 'Test only', ...data } as any,
  })
  eventIds.push(event.id)
  return event
}

beforeAll(async () => {
  if (process.env.CMS_LOCAL_BOOTSTRAP !== '1') throw new Error('Integration tests require the isolated local profile.')
  payload = await getPayload({ config, key: 'event-media-tests' })
  const login = await payload.login({ collection: 'users', data: { email: process.env.CMS_BOOTSTRAP_EMAIL!, password: process.env.CMS_BOOTSTRAP_PASSWORD! } })
  const created = await payload.create({ collection: 'users', data: { email: `media-editor-${suffix}@terrace.invalid`, password: `local-${crypto.randomUUID()}`, displayName: 'Media editor', role: 'editor' }, user: { ...login.user, collection: 'users' }, overrideAccess: false })
  editor = { ...created, collection: 'users' }
  editorId = created.id
})

afterAll(async () => {
  for (const id of eventIds) await payload.delete({ collection: 'events', id, overrideAccess: true })
  for (const id of mediaIds) await payload.delete({ collection: 'media', id, overrideAccess: true })
  if (editorId) await payload.delete({ collection: 'users', id: editorId, overrideAccess: true })
  await payload.db.destroy?.()
})

test('the credit migration is applied and the column exists', async () => {
  const pool = (payload.db as any).pool
  const applied = await pool.query(`select 1 from payload_migrations where name = $1`, ['20261031_220233'])
  expect(applied.rowCount).toBe(1)
  const column = await pool.query(`select data_type from information_schema.columns where table_name = 'media' and column_name = 'credit'`)
  expect(column.rows[0]?.data_type).toBe('character varying')
})

test('an event poster needs alt text, and credit and caption are optional but bounded', async () => {
  await expect(upload({ public: true })).rejects.toThrow()
  await expect(upload({ alt: 'x'.repeat(301), public: true })).rejects.toThrow()
  await expect(upload({ alt: 'Poster', credit: 'x'.repeat(201), public: true })).rejects.toThrow()
  await expect(upload({ alt: 'Poster', caption: 'x'.repeat(501), public: true })).rejects.toThrow()
  const bare = await upload({ alt: 'A bare poster', public: true })
  expect(bare.credit ?? null).toBeNull()
  const full = await upload({ alt: 'A credited poster', caption: 'Opening night', credit: 'Ada Example', public: true })
  expect(full.credit).toBe('Ada Example')
  expect(full.caption).toBe('Opening night')
})

test('uploads are limited to 10 MiB and to PNG, JPEG, WebP, or PDF bytes', async () => {
  const gif = Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;', 'binary')
  await expect(upload({ alt: 'GIF', public: true }, { data: gif, mimetype: 'image/gif', name: 'x.gif', size: gif.length })).rejects.toThrow()
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')
  await expect(upload({ alt: 'SVG', public: true }, { data: svg, mimetype: 'image/svg+xml', name: 'x.svg', size: svg.length })).rejects.toThrow()
  await expect(upload({ alt: 'Mislabelled', public: true }, { data: svg, mimetype: 'image/png', name: 'x.png', size: svg.length })).rejects.toThrow()
  const big = Buffer.concat([png, Buffer.alloc(10 * 1024 * 1024)])
  await expect(upload({ alt: 'Huge', public: true }, { data: big, mimetype: 'image/png', name: 'big.png', size: big.length })).rejects.toThrow(/10 MiB/)
})

test('an event poster must be an image, and publishing requires it to be public', async () => {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>']
  let pdfText = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdfText)); pdfText += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = Buffer.byteLength(pdfText)
  pdfText += `xref\n0 4\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Root 1 0 R /Size 4 >>\nstartxref\n${xref}\n%%EOF\n`
  const pdf = Buffer.from(pdfText)
  const doc = await upload({ alt: 'Not a poster', public: true }, { data: pdf, mimetype: 'application/pdf', name: `doc-${suffix}.pdf`, size: pdf.length })
  await expect(createEvent('pdf', { coverImage: doc.id })).rejects.toThrow(/JPEG, PNG, or WebP/)
  const hidden = await upload({ alt: 'Private poster', public: false })
  await expect(createEvent('private', { coverImage: hidden.id, _status: 'published' })).rejects.toThrow(/public/)
  const draft = await createEvent('private-draft', { coverImage: hidden.id, _status: 'draft' })
  await expect(payload.update({ collection: 'events', id: draft.id, data: { _status: 'published' }, user: editor, overrideAccess: false })).rejects.toThrow(/public/)
})

test('anonymous readers receive a published poster with alt text, credit, and file metadata, but not drafts', async () => {
  const media = await upload({ alt: 'A public poster', caption: 'Opening night', credit: 'Ada Example', public: true })
  const published = await createEvent('public', { coverImage: media.id, _status: 'published' })
  const read = await payload.find({ collection: 'events', where: { id: { equals: published.id } }, depth: 1, overrideAccess: false })
  const poster = read.docs[0]?.coverImage as any
  expect(poster).toMatchObject({ alt: 'A public poster', caption: 'Opening night', credit: 'Ada Example', public: true, mimeType: 'image/png' })
  expect(String(poster.url)).toContain('/api/media/file/')
  expect(poster.filesize).toBeGreaterThan(0)
  expect([poster.width, poster.height]).toEqual([1, 1])
  const draft = await createEvent('draft-only', { coverImage: media.id, _status: 'draft' })
  const hiddenDraft = await payload.find({ collection: 'events', where: { id: { equals: draft.id } }, overrideAccess: false })
  expect(hiddenDraft.totalDocs).toBe(0)
})

test('editorial access rules are unchanged: anonymous visitors cannot upload or edit posters', async () => {
  await expect(payload.create({ collection: 'media', data: { alt: 'Anonymous', public: true }, file: { data: png, mimetype: 'image/png', name: 'anon.png', size: png.length }, overrideAccess: false })).rejects.toThrow()
  const member: any = { id: editorId, collection: 'members', role: 'admin' }
  await expect(payload.create({ collection: 'media', data: { alt: 'Member', public: true }, file: { data: png, mimetype: 'image/png', name: 'member.png', size: png.length }, user: member, overrideAccess: false })).rejects.toThrow()
})
