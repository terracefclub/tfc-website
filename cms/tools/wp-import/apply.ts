// Applier for the WordPress import plan: dry-run, idempotent apply and rollback through
// Payload's local API. The plan is produced by web/tools/wp-import and re-validated here.
// Every write happens in its own database transaction together with its journal row, so a
// crash can never leave a created document without the record `rollback` needs.
import { sql } from '@payloadcms/db-postgres'
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
export type ApplyOptions = { publish?: boolean; runId?: string; overwriteEdited?: boolean; now?: () => Date; hooks?: { afterDocument?: (index: number) => void | Promise<void>; afterClaim?: (index: number) => void | Promise<void> } }

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

export type Executor = { execute: (query: any) => Promise<{ rows: any[] }> }
export const executor = (payload: Payload, req?: PayloadRequest): Executor => {
  const session = req?.transactionID ? (payload.db as any).sessions[req.transactionID as string]?.db : undefined
  if (req?.transactionID && !session) throw new Error('transaction-session-missing') // never fall back to the shared client mid-transaction
  return (session ?? (payload.db as any).drizzle) as Executor
}

/**
 * Take the run row's lock and confirm the run is still `running`. Called first in every write transaction: a
 * concurrent takeover (rollback) holds the same row lock, so the write either completes before the takeover's snapshot
 * or is refused here. The row-level UPDATE re-checks `status` after waiting, so a taken-over run can never be written to.
 */
async function claimRun(payload: Payload, req: PayloadRequest, runId: string) {
  const result = await executor(payload, req).execute(sql`UPDATE wp_import_runs SET updated_at = now() WHERE run_id = ${runId} AND status = 'running' RETURNING id`)
  if (!result.rows.length) throw new Error('run-no-longer-running')
}

/** Draft-enabled collections keep a version row; stamp the applied hash there too so publishing a draft carries a current hash. */
const versioned = new Set(['events', 'newsletters', 'posts', 'pages', 'initiatives'])
async function stampVersionHash(payload: Payload, req: PayloadRequest, collection: string, id: string | number, hash: string) {
  if (!versioned.has(collection)) return
  await executor(payload, req).execute(sql`UPDATE ${sql.raw(`"_${collection}_v"`)} SET version_wp_applied_hash = ${hash} WHERE parent_id = ${id} AND latest = true`)
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
  const claimHook = (at: number) => options.hooks?.afterClaim ? () => options.hooks!.afterClaim!(at) : undefined
  let completed = false
  try {
  let index = 0
  for (const doc of plan.docs) {
    const at = index++
    if (options.hooks?.afterDocument) await options.hooks.afterDocument(at)
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
          const result = await updateDocument(payload, doc, existing, ids, runId!, ++sequence, claimHook(index - 1))
          Object.assign(outcome, result.outcome); ids.set(key, existing.id); slugs.set(key, result.slug)
          if (result.outcome.action === 'failed') sequence--
        }
      } else if (!write) outcome.action = 'created'
      else {
        const result = await createDocument(payload, doc, ids, publish, runId!, ++sequence, claimHook(index - 1))
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
    if (outcome.reason === 'run-no-longer-running') throw new Error('run-no-longer-running') // taken over: stop writing at once
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
    if (outcome.reason === 'run-no-longer-running') throw new Error('run-no-longer-running')
  }

  completed = true
  } finally {
    if (runId) {
      // A crash or injected failure must never leave the run `running`: mark it failed so rollback can proceed.
      // Conditional on the run still being `running`: a takeover's `rolled-back` is never overwritten.
      const failed = !completed || total.failed + redirectTotal.failed > 0
      await executor(payload).execute(sql`UPDATE wp_import_runs SET status = ${failed ? 'failed' : 'completed'}, finished_at = ${now().toISOString()}, counts = ${JSON.stringify({ documents: total, redirects: redirectTotal, byCollection })}::jsonb, updated_at = now() WHERE run_id = ${runId} AND status = 'running'`)
    }
  }
  const publishedThisRun = documents.filter(item => item.action === 'created' && item.status === 'published').length
  const notes = publish && publishedThisRun === 0 ? ['publish-requested-but-nothing-published: --publish only affects documents created by the same run; use the publish command for drafts that are already imported'] : []
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

async function createDocument(payload: Payload, doc: PlanDoc, ids: Map<string, string | number>, publish: boolean, runId: string, sequence: number, afterClaim?: () => void | Promise<void>) {
  const status = doc.collection === 'media' ? undefined : publish && doc.desiredStatus === 'published' ? 'published' : 'draft'
  return inTransaction(payload, async req => {
    await claimRun(payload, req, runId)
    if (afterClaim) await afterClaim()
    const slug = await freeSlug(payload, doc, req)
    const data: Record<string, unknown> = { ...doc.data, ...resolveRefs(doc, ids), wpContentHash: doc.targetHash, wpImportRun: runId }
    if (slug) data.slug = slug
    if (status) data._status = status
    const created = await payload.create({ collection: doc.collection as any, data: data as any, overrideAccess: true, req, depth: 0 }) as Doc
    const stored = (await latestOf(payload, doc.collection, created.id, req))!
    const hash = appliedHash(doc.collection, stored)
    await payload.db.updateOne({ collection: doc.collection as any, id: created.id, data: { wpAppliedHash: hash }, req, returning: false } as any)
    await stampVersionHash(payload, req, doc.collection, created.id, hash)
    await payload.create({ collection: 'wp-import-journal', overrideAccess: true, req, data: { runId, sequence, collection: doc.collection, docId: String(created.id), wpId: doc.wpId, action: 'created', preImage: { createdStatus: status ?? null }, postHash: hash } })
    return {
      id: created.id, slug: slug ?? undefined, published: status === 'published',
      outcome: { action: 'created' as const, appliedHash: hash, status: status ?? 'inherit' },
    }
  }).catch(error => ({ id: undefined, slug: undefined, published: undefined, outcome: { action: 'failed' as const, reason: reasonOf(error) } }))
}

async function updateDocument(payload: Payload, doc: PlanDoc, main: Doc, ids: Map<string, string | number>, runId: string, sequence: number, afterClaim?: () => void | Promise<void>) {
  const keys = managedKeys(doc.collection)
  const existing = (await latestOf(payload, doc.collection, main.id)) ?? main
  const preImage = { data: Object.fromEntries(keys.map(key => [key, existing[key] === undefined ? null : normalizeValue(existing[key]) ?? null])), status: main._status ?? null, wpContentHash: main.wpContentHash ?? null, wpAppliedHash: main.wpAppliedHash ?? null, wpImportRun: main.wpImportRun ?? null }
  return inTransaction(payload, async req => {
    await claimRun(payload, req, runId)
    if (afterClaim) await afterClaim()
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
    await stampVersionHash(payload, req, doc.collection, main.id, hash)
    await payload.create({ collection: 'wp-import-journal', overrideAccess: true, req, data: { runId, sequence, collection: doc.collection, docId: String(main.id), wpId: doc.wpId, action: 'updated', preImage: { ...preImage, postStatus: main._status ?? null }, postHash: hash } })
    return { slug: slug ?? String(main.slug ?? ''), outcome: { action: 'updated' as const, appliedHash: hash, status: main._status ?? 'inherit' } }
  }).catch(error => ({ slug: String(main.slug ?? ''), outcome: { action: 'failed' as const, reason: reasonOf(error) } }))
}

async function writeRedirect(payload: Payload, wpId: number, wanted: Record<string, unknown>, existing: Doc | undefined, runId: string, sequence: number): Promise<'created' | 'updated'> {
  return inTransaction(payload, async req => {
    await claimRun(payload, req, runId)
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

// --- publish already-imported drafts -----------------------------------------------------------

export type PublishOutcome = { ordinal: number; collection: PlanCollection; action: 'published' | 'skipped' | 'failed'; reason?: string; redirect?: 'activated' | 'none' }
export type PublishReport = {
  schemaVersion: 1; kind: 'wp-import-publish-report'; mode: 'dry-run' | 'publish'; runId: string | null; planSha256: string
  counts: { eligible: number; published: number; skipped: number; failed: number; redirectsActivated: number; notEligible: number }; documents: PublishOutcome[]; writes: boolean
}

/**
 * Publish the plan's eligible documents that were already imported as drafts (`apply` without `--publish`), as its own run in
 * the ledger, so it can be rolled back (`rollback --run ID` sets those documents back to draft). It never touches a document
 * that is already published, that an editor changed since the import (the stored applied hash no longer matches the newest saved
 * state, drafts included), whose stored content differs from this plan, or that the plan does not mark eligible. The redirect rows of
 * each published document are activated by the collection hook inside the same transaction; the report says which. Safe to
 * repeat: a document published by an earlier run is `already-published`.
 */
export async function publishExisting(payload: Payload, input: unknown, options: { write?: boolean; runId?: string; now?: () => Date } = {}): Promise<PublishReport> {
  const plan = validatePlan(input)
  const write = options.write !== false
  const now = options.now ?? (() => new Date())
  const runId = write ? options.runId ?? newRunId(now()) : null
  if (runId && !runIdPattern.test(runId)) throw new Error('Invalid run id.')
  let sequence = 0
  if (runId) {
    if ((await payload.find({ collection: 'wp-import-runs', where: { runId: { equals: runId } }, limit: 1, overrideAccess: true })).totalDocs) throw new Error('Run id already used.')
    await payload.create({ collection: 'wp-import-runs', overrideAccess: true, data: { runId, status: 'running', publish: true, startedAt: now().toISOString(), sourceSha256: plan.sourceSha256, planSha256: plan.planSha256 } })
  }
  const documents: PublishOutcome[] = []
  let completed = false
  try {
    for (const doc of plan.docs) {
      if (doc.collection === 'media' || !doc.publishEligible) continue
      const outcome: PublishOutcome = { ordinal: doc.ordinal, collection: doc.collection, action: 'skipped' }
      try {
        const existing = await byWpId(payload, doc.collection, doc.wpId)
        if (!existing) outcome.reason = 'not-imported'
        else if (existing._status === 'published') outcome.reason = 'already-published'
        else if (existing.wpContentHash !== doc.targetHash) outcome.reason = 'differs-from-plan'
        else if (existing.wpAppliedHash !== appliedHash(doc.collection, (await latestOf(payload, doc.collection, existing.id)) ?? existing)) outcome.reason = 'locally-edited'
        else if (!write) outcome.action = 'published'
        else {
          const result = await inTransaction(payload, async req => {
            await claimRun(payload, req, runId!)
            await payload.update({ collection: doc.collection as any, id: existing.id, data: { _status: 'published' }, overrideAccess: true, req, depth: 0 })
            const stored = (await latestOf(payload, doc.collection, existing.id, req))!
            const hash = appliedHash(doc.collection, stored)
            await stampVersionHash(payload, req, doc.collection, existing.id, hash)
            const rows = await payload.find({ collection: 'redirects', where: { wpId: { equals: doc.wpId } }, limit: 1, depth: 0, overrideAccess: true, req })
            await payload.create({
              collection: 'wp-import-journal', overrideAccess: true, req,
              data: { runId, sequence: ++sequence, collection: doc.collection, docId: String(existing.id), wpId: doc.wpId, action: 'updated', postHash: hash,
                preImage: { publish: true, statusBefore: existing._status ?? 'draft', postStatus: 'published', data: {}, wpContentHash: existing.wpContentHash ?? null, wpAppliedHash: existing.wpAppliedHash ?? null, wpImportRun: existing.wpImportRun ?? null } },
            })
            return rows.docs[0] && (rows.docs[0] as Doc).active === true ? 'activated' as const : 'none' as const
          }).catch(error => { sequence--; throw error })
          outcome.action = 'published'; outcome.redirect = result
        }
      } catch (error) { outcome.action = 'failed'; outcome.reason = reasonOf(error) }
      documents.push(outcome)
      if (outcome.reason === 'run-no-longer-running') throw new Error('run-no-longer-running')
    }
    completed = true
  } finally {
    if (runId) {
      const failed = !completed || documents.some(item => item.action === 'failed')
      const counts = { published: documents.filter(item => item.action === 'published').length }
      await executor(payload).execute(sql`UPDATE wp_import_runs SET status = ${failed ? 'failed' : 'completed'}, finished_at = ${now().toISOString()}, counts = ${JSON.stringify(counts)}::jsonb, updated_at = now() WHERE run_id = ${runId} AND status = 'running'`)
    }
  }
  const count = (action: PublishOutcome['action']) => documents.filter(item => item.action === action).length
  return {
    schemaVersion: 1, kind: 'wp-import-publish-report', mode: write ? 'publish' : 'dry-run', runId, planSha256: plan.planSha256,
    counts: { eligible: documents.length, published: count('published'), skipped: count('skipped'), failed: count('failed'), redirectsActivated: documents.filter(item => item.redirect === 'activated').length, notEligible: plan.docs.filter(doc => doc.collection !== 'media' && !doc.publishEligible).length },
    documents, writes: write,
  }
}

// --- rollback ----------------------------------------------------------------------------------

type JournalRow = { id: string | number; sequence: number; collection: string; docId: string; wpId: number; action: 'created' | 'updated'; preImage: any; postHash: string; createdAt: string }

export type RollbackOptions = {
  discardEdits?: boolean
  /** Take over a run still marked `running`. Only allowed once it is older than `staleAfterMs`. */
  takeOverStale?: boolean
  /** Idle time since the run's last write (its heartbeat). Default one hour; lowering it is an explicit operator decision (CLI `--stale-after-minutes`). */
  staleAfterMs?: number
  now?: () => Date
  /** Test seam for injecting failures. */
  hooks?: { beforeRow?: (index: number) => void | Promise<void> }
}
export const defaultStaleAfterMs = 60 * 60 * 1000

class Refused extends Error {}

/**
 * Undo a run. The whole operation, including every precondition check, runs in ONE transaction that first takes the run
 * row's lock: a concurrent apply for the same run is blocked at its next write and then refused (it sees a run that is
 * no longer `running`), so the snapshot this reads cannot go stale, and any failure changes nothing.
 */
export async function rollback(payload: Payload, runId: string, options: RollbackOptions = {}): Promise<RollbackResult> {
  const result: RollbackResult = { ok: false, runId, refusals: [], deleted: 0, restored: 0, alreadyGone: 0 }
  const refuse = (collection: string, reason: string) => { result.refusals.push({ collection, reason }) }
  const now = options.now ?? (() => new Date())
  try {
    await inTransaction(payload, async req => {
      // Lock the run row for the rest of the transaction and read it as of now.
      const locked = await executor(payload, req).execute(sql`SELECT id, status, updated_at FROM wp_import_runs WHERE run_id = ${runId} FOR UPDATE`)
      const run = locked.rows[0]
      if (!run) { refuse('wp-import-runs', 'unknown-run'); throw new Refused() }
      if (run.status === 'rolled-back') { refuse('wp-import-runs', 'already-rolled-back'); throw new Refused() }
      if (run.status === 'running') {
        const age = now().getTime() - new Date(run.updated_at).getTime() // heartbeat: claimRun bumps updated_at on every write
        if (!options.takeOverStale) { refuse('wp-import-runs', 'run-still-running'); throw new Refused() }
        if (age < (options.staleAfterMs ?? defaultStaleAfterMs)) { refuse('wp-import-runs', 'run-not-stale'); throw new Refused() }
      }
      const rows = (await payload.find({ collection: 'wp-import-journal', where: { runId: { equals: runId } }, sort: '-sequence', limit: 100000, pagination: false, depth: 0, overrideAccess: true, req })).docs as unknown as JournalRow[]
      const liveRuns = new Set((await payload.find({ collection: 'wp-import-runs', where: { status: { not_equals: 'rolled-back' } }, limit: 100000, pagination: false, overrideAccess: true, req })).docs.map(doc => (doc as Doc).runId as string))
      const touchedHere = new Set(rows.map(row => `${row.collection}:${row.docId}`))

      // Preconditions, all evaluated inside the transaction.
      const current = new Map<string, Doc | undefined>()
      for (const row of rows) {
        const label = row.collection
        const others = (await payload.find({ collection: 'wp-import-journal', where: { and: [{ collection: { equals: row.collection } }, { docId: { equals: row.docId } }, { runId: { not_equals: runId } }] }, limit: 1000, pagination: false, depth: 0, overrideAccess: true, req })).docs as unknown as JournalRow[]
        if (others.some(other => liveRuns.has((other as any).runId) && new Date(other.createdAt) > new Date(row.createdAt))) { refuse(label, 'later-run-depends-on-document'); continue }
        const doc = await latestOf(payload, row.collection, row.docId, req)
        current.set(`${row.collection}:${row.docId}`, doc)
        if (!doc) continue
        // A redirect row follows its document's publication state (an editor publishing or unpublishing it flips `active` inside the
        // same transaction, see src/collections/redirect-sync.ts), so that flip alone is not an edit.
        const hashes = row.collection === 'redirects' ? [true, false].map(active => redirectHash({ ...doc, active })) : [appliedHash(row.collection as PlanCollection, doc)]
        if (!hashes.includes(row.postHash) && !options.discardEdits) refuse(label, 'edited-since-import')
        if (versioned.has(row.collection) && !options.discardEdits) {
          const main = await payload.findByID({ collection: row.collection as any, id: row.docId, depth: 0, overrideAccess: true, req }).catch(() => undefined) as Doc | undefined
          if (main && row.action === 'created') {
            const created = row.preImage?.createdStatus
            if (created !== undefined && main._status !== created) refuse(label, main._status === 'published' ? 'published-since-import' : 'status-changed-since-import')
          } else if (main && row.action === 'updated' && row.preImage && 'postStatus' in row.preImage) {
            // Rows written before postStatus existed carry no value: that check is skipped for them.
            if ((main._status ?? null) !== (row.preImage.postStatus ?? null)) refuse(label, 'status-changed-since-import')
          }
        }
        if (row.action === 'created' && row.collection === 'media') {
          for (const [collection, fields] of Object.entries(refFields)) for (const field of fields) {
            const referencing = await payload.find({ collection: collection as any, where: { [field]: { equals: row.docId } }, limit: 1000, pagination: false, depth: 0, overrideAccess: true, req })
            for (const other of referencing.docs as Doc[]) if (!touchedHere.has(`${collection}:${other.id}`)) refuse(label, 'referenced-by-other-documents')
          }
        }
      }
      if (result.refusals.length) throw new Refused()

      let index = 0
      for (const row of rows) {
        if (options.hooks?.beforeRow) await options.hooks.beforeRow(index++)
        const doc = current.get(`${row.collection}:${row.docId}`)
        if (!doc) { result.alreadyGone++; continue }
        if (row.action === 'created') {
          await payload.delete({ collection: row.collection as any, id: row.docId, overrideAccess: true, req })
          result.deleted++
        } else if (row.preImage?.publish === true) {
          // A `publish` row: undo only the publication (the document goes back to the status it had); its redirect rows follow through the hook.
          await payload.update({ collection: row.collection as any, id: row.docId, overrideAccess: true, req, depth: 0, data: { _status: row.preImage.statusBefore ?? 'draft' } })
          result.restored++
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
          if (image.wpAppliedHash) await stampVersionHash(payload, req, row.collection, row.docId, image.wpAppliedHash)
          result.restored++
        }
      }
      await payload.update({ collection: 'wp-import-runs', id: run.id, overrideAccess: true, req, data: { status: 'rolled-back', rolledBackAt: now().toISOString() } })
    })
    result.ok = true
  } catch (error) {
    if (!(error instanceof Refused)) refuse('rollback', 'rolled-back-transaction-failed')
    result.deleted = 0; result.restored = 0; result.alreadyGone = 0
  }
  return result
}
