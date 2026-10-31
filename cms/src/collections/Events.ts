import type { CollectionConfig } from 'payload'
import { publishedOrMember, memberOnly } from '@/access/rules'
import { editorialAccess, imageCoverOnly, posterImageMimeTypes, publicMediaOnPublish, slugField } from './shared'

export const Events: CollectionConfig = {
  slug: 'events',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'startsAt', '_status'] },
  versions: { drafts: true },
  access: { ...editorialAccess, read: publishedOrMember, readVersions: memberOnly },
  hooks: { beforeChange: [
    ({ data, originalDoc }) => {
      const start = data?.startsAt ?? originalDoc?.startsAt
      const end = Object.hasOwn(data ?? {}, 'endsAt') ? data?.endsAt : originalDoc?.endsAt
      if (end && start && new Date(end).getTime() <= new Date(start).getTime()) {
        throw new Error('Event end must be after its start.')
      }
      return data
    },
    imageCoverOnly,
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
    {
      name: 'coverImage', label: 'Poster image', type: 'relationship', relationTo: 'media',
      filterOptions: { mimeType: { in: posterImageMimeTypes } },
      admin: { description: 'Optional JPEG, PNG, or WebP poster. Shown uncropped; the media item must have alt text and be marked public before publishing. Without one, the site shows no poster (or its built-in sample poster for sample slugs).' },
    },
  ],
}
