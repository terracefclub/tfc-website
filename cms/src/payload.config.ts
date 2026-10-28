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

const dirname = path.dirname(fileURLToPath(import.meta.url))
const origin = process.env.CMS_ORIGIN || 'http://127.0.0.1:3010'

if (new URL(origin).protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(new URL(origin).hostname)) {
  throw new Error('This CMS trial only supports a loopback origin until per-user OIDC is implemented.')
}

if (!process.env.PAYLOAD_SECRET || !process.env.DATABASE_URI) {
  throw new Error('PAYLOAD_SECRET and DATABASE_URI are required. Run tools/local-up for local development.')
}

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET,
  serverURL: origin,
  admin: { user: Users.slug, importMap: { baseDir: path.resolve(dirname) } },
  editor: lexicalEditor(),
  db: postgresAdapter({ pool: { connectionString: process.env.DATABASE_URI }, push: false }),
  collections: [Users, Media, Events, Newsletters, Initiatives, Redirects],
  typescript: { outputFile: path.resolve(dirname, '../payload-types.ts') },
  cors: [origin],
  csrf: [origin],
})
