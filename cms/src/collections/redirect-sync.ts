import { createHash } from 'node:crypto'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, Payload, PayloadRequest } from 'payload'
import { appExactRoutes, appRoutePrefixes } from '../lib/route-manifest'

// Keeps the redirect rows of an imported document in step with its publication state, in the same transaction as the
// change. The importer writes a redirect inactive until its target is published (nothing public may redirect to a draft);
// when an editor publishes or unpublishes the document in the admin the row must follow without re-running `apply`.
//
// Only a row that BELONGS to the document is touched: it carries the importer's run id, its WordPress ID equals the
// document's, it has not been edited by anyone since the importer wrote it (its applied hash still matches) and its
// destination is this collection's public route. Publishing activates it only when the same-site rules hold: a local
// source that is not a route the site serves or reserves (the generated route manifest), a local destination, and a source
// that is not the destination. Unpublishing and deleting always deactivate.

/** Public route of each imported collection; must equal `routes` in web/tools/wp-import/plan-schema.ts (a test compares them). */
export const redirectRoutes = {
  events: '/events/{slug}', newsletters: '/newsletter/{slug}', initiatives: '/initiatives', posts: '/news/{slug}', pages: '/pages/{slug}',
} as const
export type RedirectCollection = keyof typeof redirectRoutes

const localPath = /^\/(?!\/)[a-zA-Z0-9/_-]*$/
const routeFor = (collection: RedirectCollection, slug: string) => redirectRoutes[collection].replace('{slug}', slug)
const routeBase = (collection: RedirectCollection) => redirectRoutes[collection].replace('{slug}', '')

/** Same rule as the importer and the website's redirect consumer: a source the app serves or reserves is never redirected. */
export function isReservedPath(path: string): boolean {
  const lower = path.toLowerCase()
  return appExactRoutes.includes(lower) || appRoutePrefixes.some(prefix => lower === prefix || lower.startsWith(prefix + '/'))
}

// Hash of a redirect row exactly as the importer computes it (cms/tools/wp-import/apply.ts `redirectHash`): canonical JSON of the
// four importer-managed fields with empty values dropped. A test keeps the two in step.
const canonical = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
}
const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex')
const present = (value: unknown) => value === null || value === undefined || value === '' ? undefined : value
export const redirectRowHash = (row: { sourcePath?: unknown; destinationUrl?: unknown; statusCode?: unknown; active?: unknown }) =>
  sha256(canonical({ sourcePath: present(row.sourcePath), destinationUrl: present(row.destinationUrl), statusCode: present(row.statusCode), active: present(row.active) }))

type Row = { id: number | string; wpId?: number | null; wpImportRun?: string | null; wpAppliedHash?: string | null; sourcePath: string; destinationUrl: string; statusCode: string; active?: boolean | null }

/** Activate (published) or deactivate (anything else) the importer's redirect rows of one document. Returns how many rows changed. */
export async function syncRedirects(payload: Payload, req: PayloadRequest, collection: RedirectCollection, state: { wpId: number; slug?: string | null; published: boolean }): Promise<number> {
  const found = await payload.find({ collection: 'redirects', where: { wpId: { equals: state.wpId } }, limit: 5, depth: 0, pagination: false, overrideAccess: true, req })
  let changed = 0
  for (const row of found.docs as unknown as Row[]) {
    if (!row.wpImportRun || row.wpId !== state.wpId || row.wpAppliedHash !== redirectRowHash(row)) continue // not ours, or edited by a person
    if (!row.destinationUrl.startsWith(routeBase(collection)) || !localPath.test(row.sourcePath)) continue // does not belong to this document's route
    const destination = state.published && state.slug ? routeFor(collection, state.slug) : row.destinationUrl
    const sameSite = localPath.test(destination) && destination.toLowerCase() !== row.sourcePath.toLowerCase() && !isReservedPath(row.sourcePath)
    const active = state.published && sameSite
    if ((row.active ?? false) === active && row.destinationUrl === destination) continue
    await payload.update({ collection: 'redirects', id: row.id, data: { active, destinationUrl: destination }, overrideAccess: true, req, depth: 0 })
    const wanted = { sourcePath: row.sourcePath, destinationUrl: destination, statusCode: row.statusCode, active }
    await payload.db.updateOne({
      collection: 'redirects', id: row.id, req, returning: false,
      data: { wpAppliedHash: redirectRowHash(wanted), wpContentHash: redirectRowHash({ ...wanted, statusCode: '301' }) },
    } as never)
    changed++
  }
  return changed
}

/** Hooks for an imported collection (Events, Newsletters, Initiatives, Posts, Pages). */
export const redirectHooks = (collection: RedirectCollection): { afterChange: CollectionAfterChangeHook[]; afterDelete: CollectionAfterDeleteHook[] } => ({
  afterChange: [async ({ doc, req }) => {
    if (typeof doc?.wpId !== 'number') return doc
    // What is live is the main row: an editor's draft saved over a published document does not unpublish it.
    const live = await req.payload.findByID({ collection, id: doc.id, depth: 0, draft: false, overrideAccess: true, req }).catch(() => null) as { _status?: string; slug?: string } | null
    await syncRedirects(req.payload, req, collection, { wpId: doc.wpId, slug: live?.slug ?? doc.slug, published: live?._status === 'published' })
    return doc
  }],
  afterDelete: [async ({ doc, req }) => {
    if (typeof doc?.wpId === 'number') await syncRedirects(req.payload, req, collection, { wpId: doc.wpId, published: false })
    return doc
  }],
})
