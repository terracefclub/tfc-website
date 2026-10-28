import type { Access, CollectionBeforeChangeHook, Field } from 'payload'
import { isAdmin, isMember } from '@/access/rules'

export const slugField: Field = {
  name: 'slug', type: 'text', required: true, unique: true,
  validate: (value: unknown) => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || 'Use lowercase letters, numbers and hyphens.',
}

export const publicMediaOnPublish: CollectionBeforeChangeHook = async ({ data, req, originalDoc }) => {
  if ((data?._status ?? originalDoc?._status) !== 'published') return data
  for (const name of ['coverImage', 'issuePdf']) {
    const value = data[name] ?? originalDoc?.[name]
    if (!value) continue
    const id = typeof value === 'object' ? value.id : value
    const media = await req.payload.findByID({ collection: 'media', id, req, overrideAccess: true })
    if (!media.public) throw new Error(`${name} must be marked public before publishing.`)
  }
  return data
}

export const editorialAccess: { create: Access; update: Access; delete: Access } = {
  create: ({ req }) => isMember(req.user),
  update: ({ req }) => isMember(req.user),
  delete: ({ req }) => isAdmin(req.user),
}
