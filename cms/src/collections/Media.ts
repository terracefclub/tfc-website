import type { CollectionConfig, PayloadRequest } from 'payload'
import { memberOnly, publicMediaOrMember } from '@/access/rules'
import { mediaDirectory } from '../media-directory'

async function assertNoPublishedReferences(req: PayloadRequest, id: string | number) {
  for (const [collection, field] of [
    ['events', 'coverImage'], ['newsletters', 'coverImage'],
    ['newsletters', 'issuePdf'], ['initiatives', 'coverImage'],
  ] as const) {
    const references = await req.payload.find({
      collection, limit: 1, overrideAccess: true, req,
      where: { and: [{ [field]: { equals: id } }, { _status: { equals: 'published' } }] },
    })
    if (references.totalDocs > 0) throw new Error('A published item references this media; unpublish it first.')
  }
}

export const Media: CollectionConfig = {
  slug: 'media',
  access: { create: memberOnly, read: publicMediaOrMember, update: memberOnly, delete: memberOnly },
  admin: { useAsTitle: 'alt' },
  upload: {
    staticDir: mediaDirectory(),
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    pasteURL: false,
    allowRestrictedFileTypes: false,
  },
  hooks: { beforeDelete: [async ({ req, id }) => assertNoPublishedReferences(req, id)], beforeChange: [async ({ req, data, originalDoc }) => {
    if (originalDoc?.public === true && data?.public === false) {
      await assertNoPublishedReferences(req, originalDoc.id)
    }
    const file = req.file
    if (!file) return data
    const bytes = file.data
    if (!bytes || bytes.length === 0 || bytes.length > 10 * 1024 * 1024) {
      throw new Error('Upload must contain at most 10 MiB of bytes.')
    }
    const isPNG = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    const isJPEG = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    const isWebP = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
    const isPDF = bytes.toString('ascii', 0, 5) === '%PDF-'
    const valid = file.mimetype === 'image/png' && isPNG || file.mimetype === 'image/jpeg' && isJPEG || file.mimetype === 'image/webp' && isWebP || file.mimetype === 'application/pdf' && isPDF
    if (!valid) throw new Error('Upload bytes do not match an allowed file type.')
    return data
  }] },
  fields: [
    { name: 'alt', type: 'text', required: true, maxLength: 300, admin: { description: 'Describe what the image shows for people who cannot see it. Required.' } },
    { name: 'caption', type: 'textarea', maxLength: 500, admin: { description: 'Optional visible caption.' } },
    { name: 'credit', type: 'text', maxLength: 200, admin: { description: 'Optional photographer, artist, or source credit.' } },
    { name: 'public', type: 'checkbox', defaultValue: false, required: true, admin: { description: 'Private uploads cannot be served to anonymous visitors.' } },
  ],
}
