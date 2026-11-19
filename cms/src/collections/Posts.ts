import type { CollectionConfig, Field } from 'payload'
import { publishedOrMember, memberOnly } from '@/access/rules'
import { editorialAccess, refuseActiveHtml, slugField, wpImportFields } from './shared'

// Imported WordPress posts and pages, served at /news/{slug} and /pages/{slug}. bodyHtml is sanitized
// allowlist HTML from the importer; the frontend still re-sanitizes it at render time and never trusts it.
const content = (): Field[] => [
  slugField,
  { name: 'title', type: 'text', required: true },
  { name: 'excerpt', type: 'textarea' },
  { name: 'bodyHtml', type: 'textarea', admin: { description: 'Sanitized HTML imported from WordPress. Divi layouts were flattened; review before publishing.' } },
  { name: 'authorName', type: 'text', admin: { description: 'Display name from the WordPress byline. No account is created.' } },
  { name: 'publishedAt', type: 'date' },
  { name: 'categories', type: 'json', admin: { description: 'WordPress category slugs.' } },
  { name: 'tags', type: 'json', admin: { description: 'WordPress tag slugs.' } },
  { name: 'seoTitle', type: 'text' },
  { name: 'seoDescription', type: 'textarea' },
  { name: 'featuredMedia', type: 'relationship', relationTo: 'media', admin: { description: 'May reference a media record whose file has not been copied yet.' } },
]

const base = {
  versions: { drafts: true },
  access: { ...editorialAccess, read: publishedOrMember, readVersions: memberOnly },
  hooks: { beforeChange: [refuseActiveHtml('bodyHtml')] },
}

export const Posts: CollectionConfig = { slug: 'posts', admin: { useAsTitle: 'title' }, ...base, fields: [...content(), ...wpImportFields] }
export const Pages: CollectionConfig = {
  slug: 'pages', admin: { useAsTitle: 'title' }, ...base,
  fields: [...content(), { name: 'parentWpId', type: 'number', admin: { readOnly: true, description: 'WordPress ID of the parent page.' } }, { name: 'menuOrder', type: 'number' }, ...wpImportFields],
}
