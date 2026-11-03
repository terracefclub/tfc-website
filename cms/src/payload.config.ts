import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import { Events } from './collections/Events'
import { Initiatives } from './collections/Initiatives'
import { Media } from './collections/Media'
import { Newsletters } from './collections/Newsletters'
import { Redirects } from './collections/Redirects'
import { Users } from './collections/Users'
import { Members } from './collections/Members'
import { communityCollections } from './community/collections'
import { editorialEndpoints } from './auth/editorial'
import { cmsRuntimeOrigin } from './runtime-policy'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const origin = cmsRuntimeOrigin()

if (!process.env.PAYLOAD_SECRET || !process.env.DATABASE_URI) {
  throw new Error('PAYLOAD_SECRET and DATABASE_URI are required. Run tools/local-up for local development.')
}

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET,
  serverURL: origin,
  admin: { user: Users.slug, importMap: { baseDir: path.resolve(dirname) }, components: {
    beforeLogin: ['/components/EditorialLogin#EditorialLogin'], logout: { Button: '/components/EditorialLogin#EditorialLogout' },
  } },
  endpoints: editorialEndpoints,
  editor: lexicalEditor(),
  db: postgresAdapter({ pool: { connectionString: process.env.DATABASE_URI }, push: false }),
  collections: [Users, Members, Media, Events, Newsletters, Initiatives, Redirects, ...communityCollections],
  typescript: { outputFile: path.resolve(dirname, '../payload-types.ts') },
  cors: [origin],
  csrf: [origin],
})
