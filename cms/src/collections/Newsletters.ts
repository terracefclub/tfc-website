import type { CollectionConfig } from 'payload'
import { publishedOrMember, memberOnly } from '@/access/rules'
import { editorialAccess, publicMediaOnPublish, slugField } from './shared'

export const Newsletters: CollectionConfig = {
  slug: 'newsletters',
  admin: { useAsTitle: 'title' },
  versions: { drafts: true },
  access: { ...editorialAccess, read: publishedOrMember, readVersions: memberOnly },
  hooks: { beforeChange: [
    async ({ data, originalDoc, req }) => {
      const issue = Object.hasOwn(data ?? {}, 'issuePdf') ? data?.issuePdf : originalDoc?.issuePdf
      if ((data?._status ?? originalDoc?._status) === 'published' && !issue) {
        throw new Error('A public PDF is required before publishing a newsletter.')
      }
      if ((data?._status ?? originalDoc?._status) === 'published') {
        const id = typeof issue === 'object' ? issue.id : issue
        const media = await req.payload.findByID({ collection: 'media', id, req, overrideAccess: true })
        if (media.mimeType !== 'application/pdf') throw new Error('Newsletter issue must be a PDF.')
      }
      return data
    },
    publicMediaOnPublish,
  ] },
  fields: [
    slugField,
    { name: 'title', type: 'text', required: true },
    { name: 'issueDate', type: 'date', required: true },
    { name: 'summary', type: 'textarea', required: true },
    { name: 'issuePdf', type: 'relationship', relationTo: 'media' },
    { name: 'coverImage', type: 'relationship', relationTo: 'media' },
  ],
}
