import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { apply, publishExisting, rollback, snapshot } from '../tools/wp-import/apply'
import { parseArgs } from '../tools/wp-import'
import { redirectHooks, redirectRoutes, redirectRowHash } from '../src/collections/redirect-sync'
import { hashOf, planHash, routes, type Plan } from '../../web/tools/wp-import/plan-schema'

const original: Plan = JSON.parse(readFileSync(new URL('./fixtures/wp-import-plan.synthetic.json', import.meta.url), 'utf8'))
let payload: Awaited<ReturnType<typeof getPayload>>
let editor: any
const stamp = crypto.randomUUID().slice(0, 6)
let counter = 0
const runId = () => `wpimport-pub-${stamp}-${++counter}`
const eligible = original.docs.filter(doc => doc.publishEligible && doc.collection !== 'media')
const editorFor = async () => {
  const created = await payload.create({ collection: 'users', overrideAccess: true, data: { email: `pub-${stamp}@terrace.invalid`, password: `local-${crypto.randomUUID()}`, displayName: 'Publisher', role: 'editor' } })
  return { ...created, collection: 'users' }
}
const docOf = async (collection: any, wpId: number, draft = false) => (await payload.find({ collection, where: { wpId: { equals: wpId } }, draft, overrideAccess: true, limit: 1 })).docs[0] as any
const rowOf = async (wpId: number) => (await payload.find({ collection: 'redirects', where: { wpId: { equals: wpId } }, overrideAccess: true, limit: 1 })).docs[0] as any
const as = (user: any) => ({ user, overrideAccess: false as const })
async function purge() {
  for (const collection of ['redirects', 'events', 'newsletters', 'posts', 'pages', 'initiatives', 'media'] as const) await payload.delete({ collection, where: { wpId: { exists: true } }, overrideAccess: true })
  await payload.delete({ collection: 'wp-import-journal', where: { runId: { like: 'wpimport-pub-' } }, overrideAccess: true })
  await payload.delete({ collection: 'wp-import-runs', where: { runId: { like: 'wpimport-pub-' } }, overrideAccess: true })
}
function reseal(plan: Plan, docs = plan.docs): Plan { const { planSha256: _, ...rest } = { ...plan, docs }; return { ...rest, planSha256: planHash(rest) } }

beforeAll(async () => {
  if (process.env.CMS_LOCAL_BOOTSTRAP !== '1') throw new Error('Integration tests require the isolated local profile.')
  payload = await getPayload({ config, key: 'wp-import-publish-tests' })
  await purge()
  editor = await editorFor()
})
afterAll(async () => {
  await purge()
  await payload.delete({ collection: 'users', id: editor.id, overrideAccess: true }).catch(() => {})
  await payload.db.destroy?.()
})

describe('publish the eligible drafts that are already imported', () => {
  test('a dry run writes nothing; the real run publishes only eligible, unedited drafts and activates their redirects; a repeat does nothing', async () => {
    const draftRun = runId()
    await apply(payload, original, { runId: draftRun })
    for (const item of eligible) expect((await docOf(item.collection, item.wpId))._status).toBe('draft')

    const preview = await publishExisting(payload, original, { write: false })
    expect(preview).toMatchObject({ mode: 'dry-run', runId: null, writes: false, counts: { published: eligible.length, failed: 0 } })
    for (const item of eligible) expect((await docOf(item.collection, item.wpId))._status).toBe('draft')

    // One eligible document was edited by an editor (a draft save) and one was published by an editor already.
    const edited = eligible.find(item => item.collection === 'posts' && item.wpId === 2002)!
    const live = eligible.find(item => item.collection === 'pages' && item.wpId === 1006)!
    await payload.update({ collection: 'posts', id: (await docOf('posts', 2002)).id, data: { title: 'Edited by an editor' }, draft: true, ...as(editor) })
    await payload.update({ collection: 'pages', id: (await docOf('pages', 1006)).id, data: { _status: 'published' }, ...as(editor) })

    const id = runId()
    const report = await publishExisting(payload, original, { runId: id })
    expect(report).toMatchObject({ mode: 'publish', runId: id, writes: true, counts: { eligible: eligible.length, published: eligible.length - 2, skipped: 2, failed: 0 } })
    const reasons = Object.fromEntries(report.documents.filter(item => item.action === 'skipped').map(item => [item.ordinal, item.reason]))
    expect(reasons[edited.ordinal]).toBe('locally-edited')
    expect(reasons[live.ordinal]).toBe('already-published')
    expect(JSON.stringify(report)).not.toMatch(/Edited by an editor|About the Synthetic/) // ordinals and codes only
    expect((await docOf('posts', 2002))._status).toBe('draft')
    expect((await docOf('posts', 2002, true)).title).toBe('Edited by an editor')
    expect((await docOf('posts', 2004))._status).toBe('published')
    expect((await docOf('initiatives', 6001))._status).toBe('published')
    // Documents the plan does not mark eligible are untouched.
    for (const item of original.docs.filter(doc => doc.collection !== 'media' && !doc.publishEligible)) expect((await docOf(item.collection, item.wpId))._status).toBe('draft')
    // Redirects follow: the published documents' rows are active, the skipped draft's row is not.
    expect((await rowOf(2004)).active).toBe(true)
    expect((await rowOf(6001)).active).toBe(true)
    expect((await rowOf(2002)).active).toBe(false)
    expect((await rowOf(1005)).active).toBe(true)
    expect((await rowOf(2001)).active).toBe(false) // a newsletter that is not eligible
    expect(report.counts.redirectsActivated).toBeGreaterThanOrEqual(3)

    const again = await publishExisting(payload, original, { runId: runId() })
    expect(again.counts).toMatchObject({ published: 0, failed: 0 })
    expect(again.documents.filter(item => item.reason === 'already-published').length).toBe(eligible.length - 1)

    // Re-applying the same plan stays a no-op (hashes are consistent with the hook's writes).
    const reapply = await apply(payload, original, { runId: runId() })
    expect(reapply.counts).toMatchObject({ created: 0, updated: 0, failed: 0 })
    expect(reapply.counts.redirects).toMatchObject({ created: 0, updated: 0, failed: 0 })

    // The publish run rolls back: those documents are drafts again and their redirects inactive; then the draft run rolls back too.
    expect((await rollback(payload, draftRun)).refusals.map(item => item.reason)).toContain('later-run-depends-on-document')
    const undone = await rollback(payload, id)
    expect(undone).toMatchObject({ ok: true, restored: eligible.length - 2 })
    expect((await docOf('posts', 2004))._status).toBe('draft')
    expect((await rowOf(2004)).active).toBe(false)
    expect((await docOf('pages', 1006))._status).toBe('published') // the editor's own publication is not ours to undo
    expect((await rollback(payload, draftRun, { discardEdits: true })).ok).toBe(true)
    for (const collection of ['pages', 'posts', 'initiatives', 'events'] as const) expect((await payload.count({ collection, where: { wpId: { exists: true } }, overrideAccess: true })).totalDocs).toBe(0)
    await purge()
  })

  test('a document whose stored content differs from the plan, or that is not imported, is skipped with a reason; an editor unpublishing blocks the publish rollback', async () => {
    await apply(payload, original, { runId: runId() })
    const newer = reseal(original, original.docs.map(doc => {
      if (doc.collection !== 'posts' || doc.wpId !== 2004) return doc
      const data = { ...doc.data, title: 'A later export' }
      return { ...doc, data, targetHash: hashOf({ data, refs: doc.refs }) }
    }))
    const id = runId()
    const report = await publishExisting(payload, newer, { runId: id })
    expect(report.documents.find(item => item.ordinal === original.docs.find(doc => doc.wpId === 2004 && doc.collection === 'posts')!.ordinal)).toMatchObject({ action: 'skipped', reason: 'differs-from-plan' })
    expect((await docOf('posts', 2004))._status).toBe('draft')
    expect((await docOf('posts', 2012))._status).toBe('published')
    await payload.update({ collection: 'posts', id: (await docOf('posts', 2012)).id, data: { _status: 'draft' }, ...as(editor) })
    const refused = await rollback(payload, id)
    expect(refused.ok).toBe(false)
    expect(refused.refusals.map(item => item.reason)).toContain('status-changed-since-import')
    expect((await rollback(payload, id, { discardEdits: true })).ok).toBe(true)
    await purge()
    const none = await publishExisting(payload, original, { write: false })
    expect(none.documents.every(item => item.reason === 'not-imported')).toBe(true)
  })

  test('command-line parsing: publish takes a plan, an optional report, run id and --dry-run, and nothing destructive', () => {
    expect(parseArgs(['publish', '--plan', '/p/plan.json', '--dry-run']).flags.has('--dry-run')).toBe(true)
    expect(() => parseArgs(['publish', '--plan', '/p/plan.json', '--publish'])).toThrow('Usage')
    expect(() => parseArgs(['apply', '--plan', '/p/plan.json', '--dry-run'])).toThrow('Usage')
    expect(() => parseArgs(['publish', '--run', 'x'])).toThrow('Usage')
  })
})

describe('redirect rows follow publication in the admin', () => {
  test('publish activates, a draft save on a published document does not, unpublish and delete deactivate', async () => {
    await apply(payload, original, { runId: runId() })
    const id = (await docOf('posts', 2004)).id
    expect((await rowOf(2004)).active).toBe(false)
    await payload.update({ collection: 'posts', id, data: { _status: 'published' }, ...as(editor) })
    expect(await rowOf(2004)).toMatchObject({ active: true, destinationUrl: '/news/club-story-2004', statusCode: '301' })
    await payload.update({ collection: 'posts', id, data: { title: 'A draft over the live post' }, draft: true, ...as(editor) })
    expect((await rowOf(2004)).active).toBe(true) // the published version is still live
    // A renamed slug moves the destination with it, so the redirect never points at a page that no longer exists.
    await payload.update({ collection: 'posts', id, data: { slug: 'renamed-story', _status: 'published' }, ...as(editor) })
    expect(await rowOf(2004)).toMatchObject({ active: true, destinationUrl: '/news/renamed-story' })
    await payload.update({ collection: 'posts', id, data: { _status: 'draft' }, ...as(editor) })
    expect((await rowOf(2004)).active).toBe(false)
    await payload.update({ collection: 'posts', id, data: { _status: 'published' }, ...as(editor) })
    expect((await rowOf(2004)).active).toBe(true)
    await payload.delete({ collection: 'posts', id, overrideAccess: true })
    expect((await rowOf(2004)).active).toBe(false)
    // Events, newsletters and initiatives are covered too.
    const initiative = (await docOf('initiatives', 6001)).id
    await payload.update({ collection: 'initiatives', id: initiative, data: { _status: 'published' }, ...as(editor) })
    expect((await rowOf(6001)).active).toBe(true)
    await payload.update({ collection: 'initiatives', id: initiative, data: { _status: 'draft' }, ...as(editor) })
    expect((await rowOf(6001)).active).toBe(false)
    await purge()
  })

  test('only rows that belong to the document are touched, and the same-site and reserved-route rules hold', async () => {
    await apply(payload, original, { runId: runId() })
    const page = (await docOf('pages', 1005)).id
    const row = await rowOf(1005)
    const publish = () => payload.update({ collection: 'pages', id: page, data: { _status: 'published' }, ...as(editor) })
    const unpublish = () => payload.update({ collection: 'pages', id: page, data: { _status: 'draft' }, ...as(editor) })
    const setRow = (data: Record<string, unknown>) => payload.db.updateOne({ collection: 'redirects', id: row.id, data, returning: false } as never)
    const restore = async () => { await unpublish(); await setRow({ sourcePath: row.sourcePath, destinationUrl: row.destinationUrl, active: false, wpImportRun: row.wpImportRun, wpAppliedHash: row.wpAppliedHash, wpContentHash: row.wpContentHash }) }

    // A row an editor changed is theirs: it keeps its state.
    await payload.update({ collection: 'redirects', id: row.id, data: { destinationUrl: '/pages/somewhere-else' }, ...as(editor) })
    await publish()
    expect(await rowOf(1005)).toMatchObject({ active: false, destinationUrl: '/pages/somewhere-else' })
    await restore()
    // A row the importer did not write (no run id) is not touched.
    await setRow({ wpImportRun: null })
    await publish()
    expect((await rowOf(1005)).active).toBe(false)
    await restore()
    // A row of a different route does not belong to this document.
    await setRow({ destinationUrl: '/events/other' })
    await publish()
    expect((await rowOf(1005)).active).toBe(false)
    await restore()
    // A source that is a real site route is never activated, even though the row is otherwise the importer's.
    const reserved = { sourcePath: '/join', destinationUrl: '/pages/undated', statusCode: '301', active: false }
    await setRow({ ...reserved, wpAppliedHash: redirectRowHash(reserved), wpContentHash: redirectRowHash(reserved) })
    await publish()
    expect((await rowOf(1005)).active).toBe(false)
    await restore()
    // Something unrelated that merely shares a WordPress ID in another collection never matches: a document without an import key is ignored.
    const plain = await payload.create({ collection: 'posts', data: { slug: `plain-${stamp}`, title: 'Not imported', _status: 'draft' } as any, overrideAccess: true })
    await payload.update({ collection: 'posts', id: plain.id, data: { _status: 'published' }, ...as(editor) })
    await payload.delete({ collection: 'posts', id: plain.id, overrideAccess: true })
    expect((await rowOf(1005)).active).toBe(false)
    await publish()
    expect((await rowOf(1005)).active).toBe(true) // the untouched row follows once nothing blocks it
    await purge()
  })

  test('the hook keeps the importer\'s own bookkeeping: same row hash, same public routes', () => {
    const sample = { sourcePath: '/a/b', destinationUrl: '/news/x', statusCode: '301', active: true, wpId: 5 }
    expect(redirectRowHash(sample)).toBe(hashOf(snapshot(['sourcePath', 'destinationUrl', 'statusCode', 'active'], sample as any)))
    expect(redirectRowHash({ ...sample, active: false })).toBe(hashOf(snapshot(['sourcePath', 'destinationUrl', 'statusCode', 'active'], { ...sample, active: false } as any)))
    expect(redirectRoutes).toEqual(routes)
    for (const collection of Object.keys(redirectRoutes) as Array<keyof typeof redirectRoutes>) {
      const hooks = redirectHooks(collection)
      expect(hooks.afterChange.length + hooks.afterDelete.length).toBe(2)
      const configured = payload.collections[collection].config.hooks
      expect(configured.afterChange.length).toBeGreaterThanOrEqual(1)
      expect(configured.afterDelete.length).toBeGreaterThanOrEqual(1)
    }
  })
})
