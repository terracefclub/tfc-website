// Applier for the WordPress import plan: dry-run, idempotent apply and rollback through
// Payload's local API. The plan is produced by web/tools/wp-import and re-validated here.
// Every write happens in its own database transaction together with its journal row, so a
// crash can never leave a created document without the record `rollback` needs.
import { commitTransaction, createLocalReq, initTransaction, killTransaction, type Payload, type PayloadRequest } from 'payload'
import { collections, dataFields, destinationFor, hashOf, refFields, validatePlan, wpFields, type Plan, type PlanCollection, type PlanDoc } from '../../../web/tools/wp-import/plan-schema'

export type Doc = Record<string, any> & { id: string | number }
type Counts = { created: number; updated: number; skipped: number; failed: number }
export type DocOutcome = { ordinal: number; collection: PlanCollection; action: 'created' | 'updated' | 'skipped' | 'failed'; reason?: string; sourceHash: string; targetHash: string; appliedHash?: string; status?: string }
export type RedirectOutcome = { ordinal: number; sourcePath: string; destination: string; action: DocOutcome['action']; reason?: string; active: boolean }
export type RunReport = {
  schemaVersion: 1; kind: 'wp-import-run-report'; mode: 'dry-run' | 'apply'; runId: string | null; source: { sha256: string }; planSha256: string; publish: boolean
  counts: Counts & { byCollection: Record<string, Counts>; redirects: Counts }; publishedThisRun: number; notes: string[]; documents: DocOutcome[]; redirects: RedirectOutcome[]; unmapped: Plan['unmapped']; writes: boolean
}
export type RollbackResult = { ok: boolean; runId: string; refusals: { collection: string; reason: string }[]; deleted: number; restored: number; alreadyGone: number }
/** `hooks` is a test seam for injecting failures; production callers leave it unset. */
export type ApplyOptions = { publish?: boolean; runId?: string; overwriteEdited?: boolean; now?: () => Date; hooks?: { afterDocument?: (index: number) => void | Promise<void> } }

const managedKeys = (collection: PlanCollection) => [...dataFields[collection], ...refFields[collection], ...wpFields]
const redirectKeys = ['sourcePath', 'destinationUrl', 'statusCode', 'active']
const runIdPattern = /^[a-z0-9][a-z0-9-]{7,63}$/

export function newRunId(now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14)
  return `wpimport-${stamp}-${crypto.randomUUID().slice(0, 6)}`
}

// --- normalization: one place that decides how a stored document is compared and hashed --------

const empty = (value: unknown) => value === null || value === undefined || value === '' || Array.isArray(value) && value.length === 0
function normalizeValue(value: unknown): unknown {
  if (empty(value)) return undefined
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(value)) return new Date(value).toISOString()
  if (typeof value === 'object' && !Array.isArray(value) && 'id' in (value as object)) return (value as { id: unknown }).id
  return value
}
/** Importer-managed fields of a stored document, in comparable form. */
export function snapshot(keys: readonly string[], doc: Doc): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of keys) {
    const value = normalizeValue(doc[key])
    if (value !== undefined) out[key] = key === 'wpId' ? Number(value) : value
  }
  return out
}
export const appliedHash = (collection: PlanCollection, doc: Doc) => hashOf(snapshot(managedKeys(collection), doc))
const redirectHash = (doc: Doc) => hashOf(snapshot(redirectKeys, doc))

// --- request/transaction helpers ---------------------------------------------------------------

async function inTransaction<T>(payload: Payload, work: (req: PayloadRequest) => Promise<T>): Promise<T> {
  const req = await createLocalReq({}, payload)
  await initTransaction(req)
  try {
    const result = await work(req)
    await commitTransaction(req)
    return result
  } catch (error) {
    await killTransaction(req)
    throw error
  }
}

/** Newest saved state, including draft-only saves an editor made after the import (the main row is not touched by those). */
async function latestOf(payload: Payload, collection: string, id: string | number, req?: PayloadRequest): Promise<Doc | undefined> {
  try { return await payload.findByID({ collection: collection as any, id, depth: 0, draft: true, overrideAccess: true, ...(req ? { req } : {}) }) as Doc } catch { return undefined }
}

async function byWpId(payload: Payload, collection: string, wpId: number): Promise<Doc | undefined> {
  const found = await payload.find({ collection: collection as any, where: { wpId: { equals: wpId } }, limit: 2, depth: 0, pagination: false, overrideAccess: true })
  if (found.docs.length > 1) throw new Error('duplicate-wp-id')
  return found.docs[0] as Doc | undefined
}

// --- apply / dry run ---------------------------------------------------------------------------

export async function dryRun(payload: Payload, input: unknown, options: ApplyOptions = {}): Promise<RunReport> {
  return execute(payload, validatePlan(input), options, false)
}
export async function apply(payload: Payload, input: unknown, options: ApplyOptions = {}): Promise<RunReport> {
  return execute(payload, validatePlan(input), options, true)
}

async function execute(payload: Payload, plan: Plan, options: ApplyOptions, write: boolean): Promise<RunReport> {
  const now = options.now ?? (() => new Date())
  const runId = write ? options.runId ?? newRunId(now()) : null
  if (runId && !runIdPattern.test(runId)) throw new Error('Invalid run id.')
  const publish = options.publish === true
  const byCollection = Object.fromEntries(collections.map(name => [name, { created: 0, updated: 0, skipped: 0, failed: 0 }])) as Record<string, Counts>
  const total: Counts = { created: 0, updated: 0, skipped: 0, failed: 0 }
  const redirectTotal: Counts = { created: 0, updated: 0, skipped: 0, failed: 0 }
  const documents: DocOutcome[] = [], redirects: RedirectOutcome[] = []
  const ids = new Map<string, string | number>() // `${collection}:${wpId}` -> CMS id
  const slugs = new Map<string, string>(), published = new Map<string, boolean>()
  let sequence = 0

  if (runId) {
    const existing = await payload.find({ collection: 'wp-import-runs', where: { runId: { equals: runId } }, limit: 1, overrideAccess: true })
    if (existing.totalDocs) throw new Error('Run id already used.')
    const last = await payload.find({ collection: 'wp-import-journal', limit: 1, sort: '-sequence', where: { runId: { equals: runId } }, overrideAccess: true })
    sequence = Number(last.docs[0]?.sequence ?? 0)
    await payload.create({ collection: 'wp-import-runs', overrideAccess: true, data: { runId, status: 'running', publish, startedAt: now().toISOString(), sourceSha256: plan.sourceSha256, planSha256: plan.planSha256 } })
  }
  const count = (target: Counts, action: DocOutcome['action']) => { target[action]++ }
  let completed = false
  try {
  let index = 0
  for (const doc of plan.docs) {
    if (options.hooks?.afterDocument) await options.hooks.afterDocument(index++)
    const key = `${doc.collection}:${doc.wpId}`
    const outcome: DocOutcome = { ordinal: doc.ordinal, collection: doc.collection, action: 'skipped', sourceHash: doc.sourceHash, targetHash: doc.targetHash }
    try {
      const existing = await byWpId(payload, doc.collection, doc.wpId)
      if (existing) {
        ids.set(key, existing.id); if (existing.slug) slugs.set(key, existing.slug); published.set(key, existing._status === 'published')
        if (existing.wpContentHash === doc.targetHash) { outcome.reason = 'unchanged'; outcome.appliedHash = existing.wpAppliedHash }
        else if (existing.wpAppliedHash !== appliedHash(doc.collection, (await latestOf(payload, doc.collection, existing.id)) ?? existing) && !options.overwriteEdited) outcome.reason = 'locally-edited'
        else if (!write) outcome.action = 'updated'
        else {
          const result = await updateDocument(payload, doc, existing, ids, runId!, ++sequence)
          Object.assign(outcome, result.outcome); ids.set(key, existing.id); slugs.set(key, result.slug)
          if (result.outcome.action === 'failed') sequence--
        }
      } else if (!write) outcome.action = 'created'
      else {
        const result = await createDocument(payload, doc, ids, publish, runId!, ++sequence)
        Object.assign(outcome, result.outcome)
        if (result.id !== undefined) { ids.set(key, result.id); slugs.set(key, result.slug!); published.set(key, result.published!) } else sequence--
      }
    } catch (error) {
      outcome.action = 'failed'; outcome.reason = reasonOf(error)
    }
    if (!write && outcome.action !== 'skipped') { published.set(key, publish && doc.desiredStatus === 'published') }
    if (!write && outcome.action === 'created' && doc.collection !== 'media') slugs.set(key, String(doc.data.slug))
    if (!write && outcome.action === 'updated') slugs.set(key, slugs.get(key) ?? String(doc.data.slug))
    count(total, outcome.action); count(byCollection[doc.collection], outcome.action)
    documents.push(outcome)
  }

  for (const redirect of plan.redirects) {
    const key = `${redirect.collection}:${redirect.wpId}`
    const slug = slugs.get(key)
    const destination = redirect.mode === 'served-in-place' ? redirect.destination : slug ? destinationFor(redirect.collection, slug) : redirect.destination
    const active = redirect.mode === 'redirect' && published.get(key) === true
    const outcome: RedirectOutcome = { ordinal: redirect.ordinal, sourcePath: redirect.sourcePath, destination, action: 'skipped', active }
    if (redirect.mode === 'served-in-place') { outcome.reason = 'served-in-place'; redirects.push(outcome); count(redirectTotal, 'skipped'); continue }
    try {
      const wanted = { sourcePath: redirect.sourcePath, destinationUrl: destination, statusCode: '301', active }
      const existing = await byWpId(payload, 'redirects', redirect.wpId)
      const taken = await payload.find({ collection: 'redirects', where: { sourcePath: { equals: redirect.sourcePath } }, limit: 1, depth: 0, overrideAccess: true })
      if (taken.docs[0] && (taken.docs[0] as Doc).wpId !== redirect.wpId) outcome.reason = 'source-path-taken'
      else if (existing && existing.wpContentHash === hashOf(wanted)) outcome.reason = 'unchanged'
      else if (existing && existing.wpAppliedHash !== redirectHash(existing) && !options.overwriteEdited) outcome.reason = 'locally-edited'
      else if (!write) outcome.action = existing ? 'updated' : 'created'
      else outcome.action = await writeRedirect(payload, redirect.wpId, wanted, existing, runId!, ++sequence)
    } catch (error) { outcome.action = 'failed'; outcome.reason = reasonOf(error) }
    count(redirectTotal, outcome.action)
    redirects.push(outcome)
  }

  completed = true
  } finally {
    if (runId) {
      // A crash or injected failure must never leave the run `running`: mark it failed so rollback can proceed.
      const failed = !completed || total.failed + redirectTotal.failed > 0
      const run = await payload.find({ collection: 'wp-import-runs', where: { runId: { equals: runId } }, limit: 1, overrideAccess: true })
      await payload.update({ collection: 'wp-import-runs', id: run.docs[0].id, overrideAccess: true, data: { status: failed ? 'failed' : 'completed', finishedAt: now().toISOString(), counts: { documents: total, redirects: redirectTotal, byCollection } } })
    }
  }
  const publishedThisRun = documents.filter(item => item.action === 'created' && item.status === 'published').length
  const notes = publish && publishedThisRun === 0 ? ['publish-requested-but-nothing-published: --publish only affects documents created by the same run'] : []
  return {
    schemaVersion: 1, kind: 'wp-import-run-report', mode: write ? 'apply' : 'dry-run', runId, source: { sha256: plan.sourceSha256 }, planSha256: plan.planSha256, publish,
    counts: { ...total, byCollection, redirects: redirectTotal }, publishedThisRun, notes, documents, redirects, unmapped: plan.unmapped, writes: write,
  }
}

/** Error text never leaves the tool: only a short fixed code derived from the error. */
function reasonOf(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (/^[a-z][a-z0-9-]{2,60}$/.test(message)) return message
  return 'write-rejected'
}

function resolveRefs(doc: PlanDoc, ids: Map<string, string | number>): Record<string, string | number> {
  const refs: Record<string, string | number> = {}
  for (const [field, wpId] of Object.entries(doc.refs)) {
    const id = ids.get(`media:${wpId}`)
    if (id === undefined) throw new Error('reference-unavailable')
    refs[field] = id
  }
  return refs
}

async function freeSlug(payload: Payload, doc: PlanDoc, req: PayloadRequest): Promise<string | undefined> {
  if (doc.collection === 'media') return undefined
  const slug = String(doc.data.slug)
  for (const candidate of [slug, `${slug}-wp${doc.wpId}`]) {
    const found = await payload.find({ collection: doc.collection as any, where: { slug: { equals: candidate } }, limit: 1, depth: 0, overrideAccess: true, req })
    const other = found.docs[0] as Doc | undefined
    if (!other || other.wpId === doc.wpId) return candidate
  }
  throw new Error('slug-conflict')
}

async function createDocument(payload: Payload, doc: PlanDoc, ids: Map<string, string | number>, publish: boolean, runId: string, sequence: number) {
  const status = doc.collection === 'media' ? undefined : publish && doc.desiredStatus === 'published' ? 'published' : 'draft'
  return inTransaction(payload, async req => {
    const slug = await freeSlug(payload, doc, req)
    const data: Record<string, unknown> = { ...doc.data, ...resolveRefs(doc, ids), wpContentHash: doc.targetHash, wpImportRun: runId }
    if (slug) data.slug = slug
    if (status) data._status = status
    const created = await payload.create({ collection: doc.collection as any, data: data as any, overrideAccess: true, req, depth: 0 }) as Doc
    const stored = (await latestOf(payload, doc.collection, created.id, req))!
    const hash = appliedHash(doc.collection, stored)
    await payload.db.updateOne({ collection: doc.collection as any, id: created.id, data: { wpAppliedHash: hash }, req, returning: false } as any)
    await payload.create({ collection: 'wp-import-journal', overrideAccess: true, req, data: { runId, sequence, collection: doc.collection, docId: String(created.id), wpId: doc.wpId, action: 'created', preImage: { createdStatus: status ?? null }, postHash: hash } })
    return {
      id: created.id, slug: slug ?? undefined, published: status === 'published',
      outcome: { action: 'created' as const, appliedHash: hash, status: status ?? 'inherit' },
    }
  }).catch(error => ({ id: undefined, slug: undefined, published: undefined, outcome: { action: 'failed' as const, reason: reasonOf(error) } }))
}

async function updateDocument(payload: Payload, doc: PlanDoc, main: Doc, ids: Map<string, string | number>, runId: string, sequence: number) {
  const keys = managedKeys(doc.collection)
  const existing = (await latestOf(payload, doc.collection, main.id)) ?? main
  const preImage = { data: Object.fromEntries(keys.map(key => [key, existing[key] === undefined ? null : normalizeValue(existing[key]) ?? null])), status: main._status ?? null, wpContentHash: main.wpContentHash ?? null, wpAppliedHash: main.wpAppliedHash ?? null, wpImportRun: main.wpImportRun ?? null }
  return inTransaction(payload, async req => {
    const slug = await freeSlug(payload, doc, req)
    const next: Record<string, unknown> = { ...doc.data, ...resolveRefs(doc, ids) }
    if (slug) next.slug = slug
    // Fields the plan no longer supplies are cleared, so the document matches the source exactly.
    const data: Record<string, unknown> = Object.fromEntries(keys.map(key => [key, next[key] === undefined ? null : next[key]]))
    Object.assign(data, { wpContentHash: doc.targetHash, wpImportRun: runId })
    // Updates never change publication state. A published document gets a draft version, so the public
    // page stays as it was until an editor reviews and publishes the new content.
    const published = main._status === 'published'
    if (main._status && !published) data._status = main._status
    await payload.update({ collection: doc.collection as any, id: main.id, data: data as any, overrideAccess: true, req, depth: 0, ...(published ? { draft: true } : {}) })
    const stored = (await latestOf(payload, doc.collection, main.id, req))!
    const hash = appliedHash(doc.collection, stored)
    await payload.db.updateOne({ collection: doc.collection as any, id: main.id, data: published ? { wpAppliedHash: hash, wpContentHash: doc.targetHash, wpImportRun: runId } : { wpAppliedHash: hash }, req, returning: false } as any)
    await payload.create({ collection: 'wp-import-journal', overrideAccess: true, req, data: { runId, sequence, collection: doc.collection, docId: String(main.id), wpId: doc.wpId, action: 'updated', preImage: { ...preImage, postStatus: main._status ?? null }, postHash: hash } })
    return { slug: slug ?? String(main.slug ?? ''), outcome: { action: 'updated' as const, appliedHash: hash, status: main._status ?? 'inherit' } }
  }).catch(error => ({ slug: String(main.slug ?? ''), outcome: { action: 'failed' as const, reason: reasonOf(error) } }))
}

async function writeRedirect(payload: Payload, wpId: number, wanted: Record<string, unknown>, existing: Doc | undefined, runId: string, sequence: number): Promise<'created' | 'updated'> {
  return inTransaction(payload, async req => {
    const data = { ...wanted, wpId, wpContentHash: hashOf(wanted), wpImportRun: runId }
    const preImage = existing ? { data: Object.fromEntries(redirectKeys.map(key => [key, existing[key] ?? null])), wpContentHash: existing.wpContentHash ?? null, wpAppliedHash: existing.wpAppliedHash ?? null, wpImportRun: existing.wpImportRun ?? null } : null
    const doc = existing
      ? await payload.update({ collection: 'redirects', id: existing.id, data: data as any, overrideAccess: true, req, depth: 0 }) as Doc
      : await payload.create({ collection: 'redirects', data: data as any, overrideAccess: true, req, depth: 0 }) as Doc
    const hash = redirectHash(doc)
    await payload.db.updateOne({ collection: 'redirects', id: doc.id, data: { wpAppliedHash: hash }, req, returning: false } as any)
    await payload.create({ collection: 'wp-import-journal', overrideAccess: true, req, data: { runId, sequence, collection: 'redirects', docId: String(doc.id), wpId, action: existing ? 'updated' : 'created', preImage, postHash: hash } })
    return existing ? 'updated' as const : 'created' as const
  })
}

// --- rollback ----------------------------------------------------------------------------------

type JournalRow = { id: string | number; sequence: number; collection: string; docId: string; wpId: number; action: 'created' | 'updated'; preImage: any; postHash: string; createdAt: string }

export async function rollback(payload: Payload, runId: string, options: { discardEdits?: boolean; takeOverStale?: boolean; now?: () => Date; hooks?: { beforeRow?: (index: number) => void | Promise<void> } } = {}): Promise<RollbackResult> {
  const result: RollbackResult = { ok: false, runId, refusals: [], deleted: 0, restored: 0, alreadyGone: 0 }
  const refuse = (collection: string, reason: string) => result.refusals.push({ collection, reason })
  const runs = await payload.find({ collection: 'wp-import-runs', where: { runId: { equals: runId } }, limit: 1, overrideAccess: true })
  const run = runs.docs[0] as Doc | undefined
  if (!run) { refuse('wp-import-runs', 'unknown-run'); return result }
  if (run.status === 'rolled-back') { refuse('wp-import-runs', 'already-rolled-back'); return result }
  if (run.status === 'running' && !options.takeOverStale) { refuse('wp-import-runs', 'run-still-running'); return result }
  const rows = (await payload.find({ collection: 'wp-import-journal', where: { runId: { equals: runId } }, sort: '-sequence', limit: 100000, pagination: false, depth: 0, overrideAccess: true })).docs as unknown as JournalRow[]
  const liveRuns = new Set((await payload.find({ collection: 'wp-import-runs', where: { status: { not_equals: 'rolled-back' } }, limit: 100000, pagination: false, overrideAccess: true })).docs.map(doc => (doc as Doc).runId as string))
  const createdHere = new Set(rows.filter(row => row.action === 'created').map(row => `${row.collection}:${row.docId}`))
  const touchedHere = new Set(rows.map(row => `${row.collection}:${row.docId}`))

  // Preflight: nothing is written until every row can be undone.
  const current = new Map<string, Doc | undefined>()
  for (const row of rows) {
    const label = row.collection
    const others = (await payload.find({ collection: 'wp-import-journal', where: { and: [{ collection: { equals: row.collection } }, { docId: { equals: row.docId } }, { runId: { not_equals: runId } }] }, limit: 1000, pagination: false, depth: 0, overrideAccess: true })).docs as unknown as JournalRow[]
    if (others.some(other => liveRuns.has((other as any).runId) && new Date(other.createdAt) > new Date(row.createdAt))) { refuse(label, 'later-run-depends-on-document'); continue }
    const doc = await latestOf(payload, row.collection, row.docId)
    current.set(`${row.collection}:${row.docId}`, doc)
    if (!doc) continue
    const hash = row.collection === 'redirects' ? redirectHash(doc) : appliedHash(row.collection as PlanCollection, doc)
    if (hash !== row.postHash && !options.discardEdits) refuse(label, 'edited-since-import')
    if (row.action === 'updated' && row.collection !== 'redirects' && row.collection !== 'media' && !options.discardEdits) {
      // Publication state is an editorial decision this run never changed; if it moved since, undoing the run must not hide it.
      const main = await payload.findByID({ collection: row.collection as any, id: row.docId, depth: 0, overrideAccess: true }).catch(() => undefined) as Doc | undefined
      if (main && (main._status ?? null) !== (row.preImage?.postStatus ?? null)) refuse(label, 'status-changed-since-import')
    }
    if (row.action === 'created' && row.collection !== 'redirects' && row.collection !== 'media' && !options.discardEdits) {
      // An editor published a document this run created as a draft: deleting it would silently unpublish it.
      const main = await payload.findByID({ collection: row.collection as any, id: row.docId, depth: 0, overrideAccess: true }).catch(() => undefined) as Doc | undefined
      if (main?._status === 'published' && row.preImage?.createdStatus !== 'published') refuse(label, 'published-since-import')
    }
    if (row.action === 'created' && row.collection === 'media') {
      for (const [collection, fields] of Object.entries(refFields)) for (const field of fields) {
        const referencing = await payload.find({ collection: collection as any, where: { [field]: { equals: row.docId } }, limit: 1000, pagination: false, depth: 0, overrideAccess: true })
        for (const other of referencing.docs as Doc[]) if (!touchedHere.has(`${collection}:${other.id}`)) refuse(label, 'referenced-by-other-documents')
      }
    }
  }
  if (result.refusals.length) return result

  // One transaction for the whole undo: a failure at any row leaves everything as it was, so a retry is safe.
  const before = { ...result }
  try {
    await inTransaction(payload, async req => {
      let index = 0
      for (const row of rows) {
        if (options.hooks?.beforeRow) await options.hooks.beforeRow(index++)
        const doc = current.get(`${row.collection}:${row.docId}`)
        if (!doc) { result.alreadyGone++; continue }
        if (row.action === 'created') {
          await payload.delete({ collection: row.collection as any, id: row.docId, overrideAccess: true, req })
          result.deleted++
        } else if (row.collection === 'redirects') {
          await payload.update({ collection: 'redirects', id: row.docId, overrideAccess: true, req, depth: 0, data: { ...row.preImage.data, wpContentHash: row.preImage.wpContentHash, wpAppliedHash: row.preImage.wpAppliedHash, wpImportRun: row.preImage.wpImportRun } })
          result.restored++
        } else {
          // Never touches _status. A published document receives the restored content as a draft version.
          const image = row.preImage
          const main = await payload.findByID({ collection: row.collection as any, id: row.docId, depth: 0, overrideAccess: true, req }) as Doc
          const published = main._status === 'published'
          const hashes = { wpContentHash: image.wpContentHash, wpAppliedHash: image.wpAppliedHash, wpImportRun: image.wpImportRun }
          await payload.update({ collection: row.collection as any, id: row.docId, overrideAccess: true, req, depth: 0, ...(published ? { draft: true } : {}), data: { ...image.data, ...hashes } })
          if (published) await payload.db.updateOne({ collection: row.collection as any, id: row.docId, data: hashes, req, returning: false } as any)
          result.restored++
        }
      }
      await payload.update({ collection: 'wp-import-runs', id: run.id, overrideAccess: true, req, data: { status: 'rolled-back', rolledBackAt: (options.now?.() ?? new Date()).toISOString() } })
    })
  } catch (error) {
    Object.assign(result, before)
    refuse('rollback', 'rolled-back-transaction-failed')
    return result
  }
  result.ok = true
  return result
}
