import type { Access, CollectionBeforeChangeHook, Field, FieldAccess } from 'payload'
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

export const posterImageMimeTypes = ['image/jpeg', 'image/png', 'image/webp']

/** Event posters are displayed uncropped on the website, so only raster images are accepted. */
export const imageCoverOnly: CollectionBeforeChangeHook = async ({ data, req, originalDoc }) => {
  const value = Object.hasOwn(data ?? {}, 'coverImage') ? data.coverImage : originalDoc?.coverImage
  if (!value) return data
  const id = typeof value === 'object' ? value.id : value
  const media = await req.payload.findByID({ collection: 'media', id, req, overrideAccess: true, depth: 0 })
  if (!posterImageMimeTypes.includes(media.mimeType ?? '')) throw new Error('The poster image must be a JPEG, PNG, or WebP image.')
  return data
}

// --- WordPress import provenance ---------------------------------------------------------------
// Imported documents carry the WordPress post ID and GUID so a re-run updates instead of
// duplicating (see docs/wordpress-import.md). Only the import job writes them (local API);
// staff may read them, the public API never sees them.
const staffRead: FieldAccess = ({ req }) => isMember(req.user)
const importOnly = { read: staffRead, create: () => false, update: () => false }
const provenance = (name: string, field: Omit<Field, 'name'> & Record<string, unknown>): Field => ({
  name, ...field, access: importOnly, admin: { readOnly: true, position: 'sidebar', ...(field.admin as object | undefined) },
} as Field)

export const wpIdField: Field = provenance('wpId', { type: 'number', unique: true, index: true, admin: { description: 'WordPress post ID (import key).' } })
export const wpImportFields: Field[] = [
  wpIdField,
  provenance('wpGuid', { type: 'text', admin: { description: 'WordPress GUID.' } }),
  provenance('wpStatus', { type: 'text', admin: { description: 'Status in the WordPress export; the CMS status is separate.' } }),
  provenance('wpPasswordProtected', { type: 'checkbox', admin: { description: 'The source was password protected. Never publish without review.' } }),
  provenance('wpReviewFlags', { type: 'json', admin: { description: 'Conversion notes that need an editor before publishing.' } }),
  provenance('wpContentHash', { type: 'text', admin: { description: 'Hash of the mapped source content at last import.' } }),
  provenance('wpAppliedHash', { type: 'text', admin: { description: 'Hash of the stored fields as the import wrote them; detects later edits.' } }),
  provenance('wpImportRun', { type: 'text', index: true, admin: { description: 'Import run that last wrote this document.' } }),
]
export const wpRedirectFields: Field[] = [wpIdField, ...wpImportFields.filter(field => 'name' in field && ['wpContentHash', 'wpAppliedHash', 'wpImportRun'].includes(field.name))]

/** Defence in depth for imported/legacy HTML: the importer sanitizes with an allowlist, this refuses obviously active markup. */
const activeHtml = /<\s*(?:script|iframe|object|embed|form|style|svg|math|link|meta|base)\b|\bon[a-z]+\s*=|javascript:|data:text\/html/i
export const refuseActiveHtml = (...fields: string[]): CollectionBeforeChangeHook => ({ data }) => {
  for (const name of fields) {
    const value = data?.[name]
    if (typeof value === 'string' && activeHtml.test(value)) throw new Error(`${name} contains markup that is not allowed. Use the sanitized import or plain formatting.`)
  }
  return data
}
