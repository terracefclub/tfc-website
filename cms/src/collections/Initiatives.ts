import type { CollectionConfig } from 'payload'
import { publishedOrStaff, staffOnly } from '@/access/rules'
import { redirectHooks } from './redirect-sync'
import { editorialAccess, publicMediaOnPublish, slugField, wpImportFields } from './shared'

export const Initiatives: CollectionConfig = {
  slug: 'initiatives',
  admin: { useAsTitle: 'title' },
  versions: { drafts: true },
  access: { ...editorialAccess, read: publishedOrStaff, readVersions: staffOnly },
  hooks: { beforeChange: [publicMediaOnPublish], ...redirectHooks('initiatives') },
  fields: [
    slugField,
    { name: 'title', type: 'text', required: true },
    { name: 'summary', type: 'textarea', required: true },
    { name: 'body', type: 'textarea' },
    { name: 'ctaLabel', type: 'text' },
    { name: 'ctaUrl', type: 'text', validate: (value: unknown) => !value || typeof value === 'string' && /^https:\/\/[^\s]+$/.test(value) || 'Use an HTTPS URL.' },
    { name: 'coverImage', type: 'relationship', relationTo: 'media' },
    ...wpImportFields,
  ],
}
