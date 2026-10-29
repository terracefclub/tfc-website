import type { CollectionConfig } from 'payload'
import { publishedOrMember, memberOnly } from '@/access/rules'
import { editorialAccess, publicMediaOnPublish, slugField } from './shared'

export const Initiatives: CollectionConfig = {
  slug: 'initiatives',
  admin: { useAsTitle: 'title' },
  versions: { drafts: true },
  access: { ...editorialAccess, read: publishedOrMember, readVersions: memberOnly },
  hooks: { beforeChange: [publicMediaOnPublish] },
  fields: [
    slugField,
    { name: 'title', type: 'text', required: true },
    { name: 'summary', type: 'textarea', required: true },
    { name: 'body', type: 'textarea' },
    { name: 'ctaLabel', type: 'text' },
    { name: 'ctaUrl', type: 'text', validate: (value: unknown) => !value || typeof value === 'string' && /^https:\/\/[^\s]+$/.test(value) || 'Use an HTTPS URL.' },
    { name: 'coverImage', type: 'relationship', relationTo: 'media' },
  ],
}
