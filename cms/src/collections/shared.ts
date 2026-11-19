import type { Access, CollectionBeforeChangeHook, Field, FieldAccess } from 'payload'
import { isAdmin, isStaff } from '@/access/rules'

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
  create: ({ req }) => isStaff(req.user),
  update: ({ req }) => isStaff(req.user),
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
const staffRead: FieldAccess = ({ req }) => isStaff(req.user)
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

/**
 * Defence in depth for imported/legacy HTML (used by Posts and Pages `bodyHtml`): the importer sanitizes with an
 * allowlist; this refuses markup that is active in tag context. It tokenizes tags with quote-aware attributes, so
 * `<a title="a>b" onclick=x>` is seen, and URL attributes are entity-decoded and stripped of whitespace/control
 * characters before the scheme check, so `java&#115;cript:` and `java<TAB>script:` are seen. Prose such as
 * "javascript: the language" or `?online=1` in a URL is not refused. Fails with the fixed code `active-html-refused`.
 */
const blockedTags = new Set(['script', 'iframe', 'object', 'embed', 'form', 'style', 'svg', 'math', 'link', 'meta', 'base', 'frame', 'frameset', 'applet'])
const urlAttributes = new Set(['href', 'src', 'action', 'formaction', 'xlink:href', 'data', 'poster', 'background', 'srcset', 'ping'])
const namedEntities: Record<string, string> = { colon: ':', tab: '\t', newline: '\n', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", lpar: '(', rpar: ')' }
const decode = (value: string) => value.replace(/&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-zA-Z][a-zA-Z0-9]*));?/g, (whole, dec, hex, name) => {
  const code = dec ? Number(dec) : hex ? Number.parseInt(hex, 16) : undefined
  if (code !== undefined) return code > 0x10ffff || (code >= 0xd800 && code < 0xe000) ? '' : String.fromCodePoint(code)
  if (Object.hasOwn(namedEntities, name)) return namedEntities[name]
  // Entity names are case-sensitive, except that the whitespace ones people use for obfuscation are matched in any case.
  const lower = name.toLowerCase()
  return lower === 'tab' || lower === 'newline' ? namedEntities[lower] : whole
})
const tagPattern = /<\s*(\/?)\s*([a-zA-Z][^\s/>]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>?/g
const attributePattern = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
function activeHtml(html: string): boolean {
  for (const tag of html.matchAll(tagPattern)) {
    if (blockedTags.has(tag[2].toLowerCase())) return true
    if (tag[1]) continue
    for (const attribute of tag[3].matchAll(attributePattern)) {
      const name = attribute[1].toLowerCase()
      if (/^on/.test(name)) return true
      if (urlAttributes.has(name)) {
        const value = decode(attribute[2] ?? attribute[3] ?? attribute[4] ?? '').replace(/[\u0000-\u0020\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g, '').toLowerCase()
        if (/^(?:javascript|vbscript|data):/.test(value)) return true
      }
    }
  }
  return false
}
export const refuseActiveHtml = (...fields: string[]): CollectionBeforeChangeHook => ({ data }) => {
  for (const name of fields) {
    const value = data?.[name]
    if (typeof value === 'string' && activeHtml(value)) throw new Error('active-html-refused')
  }
  return data
}
