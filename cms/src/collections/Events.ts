import type { CollectionConfig } from 'payload'
import { publishedOrMember } from '@/access/rules'
import { editorialAccess, publicMediaOnPublish, slugField } from './shared'

export const Events: CollectionConfig = {
  slug: 'events',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'startsAt', '_status'] },
  versions: { drafts: true },
  access: { ...editorialAccess, read: publishedOrMember, readVersions: ({ req }) => !!req.user },
  hooks: { beforeChange: [
    ({ data, originalDoc }) => {
      const start = data?.startsAt ?? originalDoc?.startsAt
      const end = Object.hasOwn(data ?? {}, 'endsAt') ? data?.endsAt : originalDoc?.endsAt
      if (end && start && new Date(end).getTime() <= new Date(start).getTime()) {
        throw new Error('Event end must be after its start.')
      }
      return data
    },
    publicMediaOnPublish,
  ] },
  fields: [
    slugField,
    { name: 'title', type: 'text', required: true },
    { name: 'summary', type: 'textarea', required: true },
    { name: 'startsAt', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'endsAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'category', type: 'select', required: true, options: ['music', 'food', 'community'] },
    { name: 'locationName', type: 'text', required: true },
    { name: 'body', type: 'textarea' },
    { name: 'coverImage', type: 'relationship', relationTo: 'media' },
  ],
}
