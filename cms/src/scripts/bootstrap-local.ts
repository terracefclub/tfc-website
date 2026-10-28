import { getPayload } from 'payload'
import config from '../payload.config'

if (process.env.CMS_LOCAL_BOOTSTRAP !== '1' || process.env.CMS_ORIGIN !== 'http://127.0.0.1:3010') {
  throw new Error('Synthetic bootstrap is restricted to the localhost development profile.')
}
const email = process.env.CMS_BOOTSTRAP_EMAIL
const password = process.env.CMS_BOOTSTRAP_PASSWORD
if (!email || !password) throw new Error('Local bootstrap credentials are missing.')

const payload = await getPayload({ config })
const existing = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, overrideAccess: true })
if (existing.totalDocs === 0) {
  await payload.create({ collection: 'users', data: { email, password, displayName: 'Local administrator', role: 'admin' }, overrideAccess: true })
}

const slug = 'preview-community-dinner'
const seeded = await payload.find({ collection: 'events', where: { slug: { equals: slug } }, limit: 1, overrideAccess: true })
if (seeded.totalDocs === 0) {
  await payload.create({
    collection: 'events',
    data: {
      slug,
      title: '[Preview] Community dinner',
      summary: 'Synthetic local preview content for testing the editorial workflow.',
      startsAt: '2030-01-18T23:00:00.000Z',
      category: 'food',
      locationName: 'Local preview only',
      _status: 'draft',
    },
    overrideAccess: true,
  })
}
const publishedSlug = 'preview-open-mic'
const publishedSeed = await payload.find({ collection: 'events', where: { slug: { equals: publishedSlug } }, limit: 1, overrideAccess: true })
if (publishedSeed.totalDocs === 0) {
  await payload.create({
    collection: 'events',
    data: {
      slug: publishedSlug,
      title: '[Preview] Open mic',
      summary: 'Synthetic local preview content. This is not an announced Terrace event.',
      startsAt: '2030-01-25T23:00:00.000Z',
      category: 'music',
      locationName: 'Local preview only',
      _status: 'published',
    },
    overrideAccess: true,
  })
}
console.log('Local bootstrap complete. Credentials remain in ignored .state/local.env.')
await payload.db.destroy?.()
process.exit(0)
