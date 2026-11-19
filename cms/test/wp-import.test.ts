import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { apply, appliedHash, dryRun, rollback } from '../tools/wp-import/apply'
import { isLocalDatabase, parseArgs } from '../tools/wp-import'
import { canonicalJson, hashOf, planHash, validatePlan, type Plan } from '../../web/tools/wp-import/plan-schema'

const original: Plan = JSON.parse(readFileSync(new URL('./fixtures/wp-import-plan.synthetic.json', import.meta.url), 'utf8'))
let payload: Awaited<ReturnType<typeof getPayload>>
const stamp = crypto.randomUUID().slice(0, 6)
let counter = 0
const runId = () => `wpimport-test-${stamp}-${++counter}`
const importCollections = ['media', 'events', 'newsletters', 'posts', 'pages', 'initiatives', 'redirects'] as const

/** Edit a plan document and re-seal every hash, the way a fresh export would. */
function changed(plan: Plan, wpId: number, collection: string, patch: Record<string, unknown>): Plan {
  const docs = plan.docs.map(doc => {
    if (doc.wpId !== wpId || doc.collection !== collection) return doc
    const data = { ...doc.data, ...patch }
    return { ...doc, data, targetHash: hashOf({ data, refs: doc.refs }) }
  })
  const { planSha256: _, ...rest } = { ...plan, docs }
  return { ...rest, planSha256: planHash(rest) }
}
function resealed(plan: Plan): Plan {
  const { planSha256: _, ...rest } = plan
  return { ...rest, planSha256: planHash(rest) }
}

async function dump() {
  const out: Record<string, unknown[]> = {}
  for (const collection of importCollections) {
    const found = await payload.find({ collection, where: { wpId: { exists: true } }, limit: 1000, pagination: false, depth: 0, sort: 'wpId', overrideAccess: true })
    out[collection] = found.docs
  }
  return out
}
async function tableCounts() {
  const counts: Record<string, number> = {}
  for (const collection of [...importCollections, 'wp-import-runs', 'wp-import-journal'] as const) {
    counts[collection] = (await payload.count({ collection, overrideAccess: true })).totalDocs
  }
  return counts
}
async function purge() {
  for (const collection of ['redirects', 'events', 'newsletters', 'posts', 'pages', 'initiatives', 'media'] as const) {
    await payload.delete({ collection, where: { wpId: { exists: true } }, overrideAccess: true })
  }
  await payload.delete({ collection: 'wp-import-journal', where: { runId: { like: 'wpimport-test-' } }, overrideAccess: true })
  await payload.delete({ collection: 'wp-import-runs', where: { runId: { like: 'wpimport-test-' } }, overrideAccess: true })
}

beforeAll(async () => {
  if (process.env.CMS_LOCAL_BOOTSTRAP !== '1') throw new Error('Integration tests require the isolated local profile.')
  payload = await getPayload({ config, key: 'wp-import-tests' })
  await purge()
})
afterAll(async () => {
  await purge()
  await payload.db.destroy?.()
})

describe('plan validation', () => {
  test('the committed fixture plan is valid and sealed', () => {
    expect(validatePlan(original).docs.length).toBe(original.docs.length)
  })
  test('unsafe html, unknown fields, tampering and ineligible publication are rejected', () => {
    const page = original.docs.find(doc => doc.collection === 'pages' && doc.data.bodyHtml)!
    expect(() => validatePlan(changed(original, page.wpId, 'pages', { bodyHtml: '<p>x</p><script>alert(1)</script>' }))).toThrow('unsafe html')
    expect(() => validatePlan(changed(original, page.wpId, 'pages', { bodyHtml: '<p onclick="x()">x</p>' }))).toThrow('unsafe html')
    expect(() => validatePlan(changed(original, page.wpId, 'pages', { notAField: 'x' }))).toThrow('unknown field')
    expect(() => validatePlan(changed(original, page.wpId, 'pages', { slug: 'Bad Slug' }))).toThrow('slug')
    expect(() => validatePlan({ ...original, sourceBytes: original.sourceBytes + 1 })).toThrow('plan hash mismatch')
    const protectedDoc = original.docs.find(doc => doc.data.wpPasswordProtected === true)!
    const forged = resealed({ ...original, docs: original.docs.map(doc => doc === protectedDoc ? { ...doc, desiredStatus: 'published' as const, publishEligible: true } : doc) })
    expect(() => validatePlan(forged)).toThrow('password-protected publication')
    const media = original.docs.find(doc => doc.collection === 'media')!
    expect(() => validatePlan(changed(original, media.wpId, 'media', { public: true }))).toThrow('media must be non-public')
    expect(() => validatePlan(changed(original, media.wpId, 'media', { sourceUrl: 'javascript:alert(1)' }))).toThrow('url')
  })
  test('the Posts collection refuses active markup written by hand', async () => {
    await expect(payload.create({ collection: 'posts', overrideAccess: true, data: { slug: `hand-${stamp}`, title: 'Hand', bodyHtml: '<p>x</p><script>1</script>', _status: 'draft' } as any })).rejects.toThrow()
  })
})

describe('dry run', () => {
  test('reads, reports created counts and writes nothing', async () => {
    const before = await tableCounts()
    const report = await dryRun(payload, original)
    expect(report.writes).toBe(false)
    expect(report.runId).toBeNull()
    expect(report.counts.created).toBe(original.docs.length)
    expect(report.counts.updated + report.counts.skipped + report.counts.failed).toBe(0)
    expect(report.documents.every(doc => doc.sourceHash.length === 64 && doc.targetHash.length === 64)).toBe(true)
    expect(report.counts.redirects.created).toBe(original.redirects.filter(item => item.mode === 'redirect').length)
    expect(await tableCounts()).toEqual(before)
    expect(JSON.stringify(report)).not.toContain('Fixture Open Mic')
  })
})

describe('apply, idempotency and rollback', () => {
  const first = runId(), second = runId(), third = runId()

  test('apply creates every document as a draft, with provenance and reference-only media', async () => {
    const report = await apply(payload, original, { runId: first })
    expect(report.counts.failed).toBe(0)
    expect(report.counts.created).toBe(original.docs.length)
    const state = await dump()
    expect(state.media.length).toBe(original.docs.filter(doc => doc.collection === 'media').length)
    for (const media of state.media as any[]) {
      expect(media.public).toBe(false)
      expect(media.filename ?? null).toBeNull()
      expect(media.sourceUrl).toMatch(/^https:\/\//)
      expect(typeof media.wpId).toBe('number')
      expect(media.wpImportRun).toBe(first)
    }
    const photo = (state.media as any[]).find(media => media.wpId === 3001)
    expect(photo).toMatchObject({ mimeType: 'image/jpeg', width: 800, height: 600, alt: 'Fall issue cover' })
    for (const collection of ['events', 'newsletters', 'posts', 'pages', 'initiatives'] as const) {
      for (const doc of state[collection] as any[]) {
        expect(doc._status).toBe('draft')
        expect(doc.wpGuid).toMatch(/^https:\/\//)
        expect(doc.wpContentHash).toHaveLength(64)
        expect(doc.wpAppliedHash).toHaveLength(64)
      }
    }
    const newsletter = (state.newsletters as any[])[0]
    const pdf = (state.media as any[]).find(media => media.wpId === 3002)
    expect(newsletter.issuePdf).toBe(pdf.id)
    const event = (state.events as any[]).find(doc => doc.wpId === 4001)
    expect(event).toMatchObject({ startsAt: '2030-01-19T00:00:00.000Z', timezone: 'America/New_York', category: 'music', locationName: 'Fixture Hall', allDay: false })
    expect((state.events as any[]).find(doc => doc.wpId === 4005).allDay).toBe(true)
    const dues = (state.pages as any[]).find(doc => doc.wpId === 1002)
    expect(dues.bodyHtml).not.toContain('<script')
    expect(dues.wpReviewFlags).toContain('builder-code-dropped')
    const protectedPage = (state.pages as any[]).find(doc => doc.wpId === 1004)
    expect(protectedPage).toMatchObject({ wpPasswordProtected: true, _status: 'draft' })
    expect(JSON.stringify(state)).not.toContain('fixture-password-value')
    expect(JSON.stringify(state)).not.toContain('example.invalid/x')
    const run = await payload.find({ collection: 'wp-import-runs', where: { runId: { equals: first } }, overrideAccess: true })
    expect(run.docs[0]).toMatchObject({ status: 'completed', planSha256: original.planSha256 })
    const journal = await payload.count({ collection: 'wp-import-journal', where: { runId: { equals: first } }, overrideAccess: true })
    expect(journal.totalDocs).toBe(report.counts.created + report.counts.redirects.created)
  })

  test('redirects cover every mapped old URL, point at created documents and start inactive', async () => {
    const rows = (await payload.find({ collection: 'redirects', where: { wpId: { exists: true } }, limit: 1000, pagination: false, depth: 0, overrideAccess: true })).docs as any[]
    const expected = original.redirects.filter(item => item.mode === 'redirect')
    expect(rows.length).toBe(expected.length)
    for (const item of expected) {
      const row = rows.find(candidate => candidate.sourcePath === item.sourcePath)!
      expect(row).toBeDefined()
      expect(row.destinationUrl).toBe(item.destination)
      expect(row.active).toBe(false)
      expect(row.statusCode).toBe('301')
      const slug = item.destination.split('/').filter(Boolean).at(-1)!
      if (item.collection !== 'initiatives') expect((await payload.find({ collection: item.collection, where: { slug: { equals: slug } }, overrideAccess: true })).totalDocs).toBe(1)
    }
    // Served-in-place pages need no row, and nothing public is redirected before publication.
    expect(rows.some(row => row.sourcePath === '/about')).toBe(false)
    expect(await payload.count({ collection: 'redirects', where: { active: { equals: true }, wpId: { exists: true } }, overrideAccess: true })).toMatchObject({ totalDocs: 0 })
  })

  test('applying the same plan again is a no-op: identical state, nothing written', async () => {
    const before = await dump()
    const beforeCounts = await tableCounts()
    const report = await apply(payload, original, { runId: second })
    expect(report.counts).toMatchObject({ created: 0, updated: 0, failed: 0, skipped: original.docs.length })
    expect(report.counts.redirects).toMatchObject({ created: 0, updated: 0, failed: 0 })
    expect(report.documents.every(doc => doc.reason === 'unchanged')).toBe(true)
    expect(canonicalJson(await dump())).toBe(canonicalJson(before))
    const afterCounts = await tableCounts()
    expect(afterCounts).toEqual({ ...beforeCounts, 'wp-import-runs': beforeCounts['wp-import-runs'] + 1 })
    const dry = await dryRun(payload, original)
    expect(dry.counts).toMatchObject({ created: 0, updated: 0, skipped: original.docs.length })
  })

  test('a changed source updates in place, never clobbers an editor, and records a pre-image', async () => {
    const edited = changed(original, 1006, 'pages', { title: 'Child Page (revised)' })
    const dry = await dryRun(payload, edited)
    expect(dry.counts).toMatchObject({ updated: 1, created: 0 })
    const report = await apply(payload, edited, { runId: third })
    expect(report.counts).toMatchObject({ updated: 1, created: 0, failed: 0 })
    const stored = (await payload.find({ collection: 'pages', where: { wpId: { equals: 1006 } }, overrideAccess: true })).docs[0] as any
    expect(stored.title).toBe('Child Page (revised)')
    expect(stored.wpImportRun).toBe(third)
    const row = (await payload.find({ collection: 'wp-import-journal', where: { runId: { equals: third } }, overrideAccess: true })).docs[0] as any
    expect(row).toMatchObject({ action: 'updated', collection: 'pages' })
    expect(row.preImage.data.title).toBe('Child Page')

    // An editor changes the document; a later source change is held back rather than overwritten.
    await payload.update({ collection: 'pages', id: stored.id, data: { title: 'Editor wording' } as any, draft: true, overrideAccess: true })
    const again = changed(edited, 1006, 'pages', { title: 'Child Page (revised twice)' })
    const held = await apply(payload, again, { runId: runId() })
    expect(held.documents.find(doc => doc.ordinal === 6)).toMatchObject({ action: 'skipped', reason: 'locally-edited' })
    expect(((await payload.findByID({ collection: 'pages', id: stored.id, draft: true, overrideAccess: true })) as any).title).toBe('Editor wording')
    const forced = await apply(payload, again, { runId: runId(), overwriteEdited: true })
    expect(forced.counts.updated).toBe(1)
    expect(((await payload.findByID({ collection: 'pages', id: stored.id, draft: true, overrideAccess: true })) as any).title).toBe('Child Page (revised twice)')
  })

  test('rollback refuses while a later run depends on the documents, then undoes runs newest first', async () => {
    const refused = await rollback(payload, first)
    expect(refused.ok).toBe(false)
    expect(refused.refusals.some(item => item.reason === 'later-run-depends-on-document')).toBe(true)
    expect(await payload.count({ collection: 'pages', where: { wpId: { exists: true } }, overrideAccess: true })).toMatchObject({ totalDocs: 6 })

    // Undo every later run, newest first (the no-op runs wrote nothing; two others updated one page).
    const runs = (await payload.find({ collection: 'wp-import-runs', sort: '-startedAt', limit: 100, overrideAccess: true, where: { runId: { like: `wpimport-test-${stamp}` } } })).docs as any[]
    for (const run of runs) {
      if (run.runId === first) continue
      if (run.runId === third) {
        // The editor's wording replaced this run's content: undoing it needs an explicit decision.
        expect((await rollback(payload, run.runId)).refusals.map(item => item.reason)).toContain('edited-since-import')
        expect((await rollback(payload, run.runId, { discardEdits: true })).ok).toBe(true)
      } else expect((await rollback(payload, run.runId)).ok).toBe(true)
    }
    const restored = (await payload.find({ collection: 'pages', where: { wpId: { equals: 1006 } }, overrideAccess: true })).docs[0] as any
    expect(restored.title).toBe('Child Page')
    expect(restored.wpImportRun).toBe(first)
    expect(restored.wpAppliedHash).toBe(appliedHash('pages', restored))
    expect((await rollback(payload, third)).refusals[0].reason).toBe('already-rolled-back')
  })

  test('rollback refuses media that other documents reference and edits made since the import', async () => {
    const media = (await payload.find({ collection: 'media', where: { wpId: { equals: 3006 } }, overrideAccess: true })).docs[0] as any
    const outsider = await payload.create({ collection: 'events', overrideAccess: true, data: { slug: `outsider-${stamp}`, title: 'Outsider', summary: 'Not imported.', startsAt: '2031-01-01T00:00:00.000Z', category: 'community', locationName: 'Test only', coverImage: media.id, _status: 'draft' } as any })
    let result = await rollback(payload, first)
    expect(result.ok).toBe(false)
    expect(result.refusals.map(item => item.reason)).toContain('referenced-by-other-documents')
    await payload.delete({ collection: 'events', id: outsider.id, overrideAccess: true })

    const page = (await payload.find({ collection: 'pages', where: { wpId: { equals: 1001 } }, overrideAccess: true })).docs[0] as any
    await payload.update({ collection: 'pages', id: page.id, data: { title: 'Edited after import' } as any, draft: true, overrideAccess: true })
    result = await rollback(payload, first)
    expect(result.refusals.map(item => item.reason)).toContain('edited-since-import')
    expect(await payload.count({ collection: 'pages', where: { wpId: { exists: true } }, overrideAccess: true })).toMatchObject({ totalDocs: 6 })
    await payload.update({ collection: 'pages', id: page.id, data: { title: 'About the Synthetic Club' } as any, draft: true, overrideAccess: true })
  })

  test('rollback of the creating run removes everything it created and nothing else', async () => {
    const keep = await payload.create({ collection: 'events', overrideAccess: true, data: { slug: `bystander-${stamp}`, title: 'Bystander', summary: 'Not imported.', startsAt: '2031-02-01T00:00:00.000Z', category: 'food', locationName: 'Test only', _status: 'draft' } as any })
    const result = await rollback(payload, first)
    expect(result.ok).toBe(true)
    expect(result.deleted).toBe(original.docs.length + original.redirects.filter(item => item.mode === 'redirect').length)
    const after = await dump()
    for (const collection of importCollections) expect(after[collection].length).toBe(0)
    expect(await payload.count({ collection: 'events', where: { id: { equals: keep.id } }, overrideAccess: true })).toMatchObject({ totalDocs: 1 })
    await payload.delete({ collection: 'events', id: keep.id, overrideAccess: true })
    expect(((await payload.find({ collection: 'wp-import-runs', where: { runId: { equals: first } }, overrideAccess: true })).docs[0] as any).status).toBe('rolled-back')
  })
})

describe('publication is explicit', () => {
  test('--publish publishes only eligible documents and activates their redirects; protected and flagged ones stay drafts', async () => {
    const id = runId()
    const report = await apply(payload, original, { publish: true, runId: id })
    expect(report.counts.failed).toBe(0)
    const state = await dump()
    const published = ['events', 'newsletters', 'posts', 'pages', 'initiatives'].flatMap(collection => (state[collection] as any[]).filter(doc => doc._status === 'published').map(doc => ({ collection, wpId: doc.wpId })))
    expect(published.length).toBe(original.docs.filter(doc => doc.desiredStatus === 'published').length)
    expect(published.some(doc => doc.wpId === 1004 || doc.wpId === 1002 || doc.wpId === 2003 || doc.wpId === 4001 || doc.wpId === 2001)).toBe(false)
    const active = (await payload.find({ collection: 'redirects', where: { active: { equals: true }, wpId: { exists: true } }, limit: 1000, pagination: false, overrideAccess: true })).docs as any[]
    expect(active.length).toBeGreaterThan(0)
    for (const row of active) expect(published.some(doc => doc.wpId === row.wpId)).toBe(true)
    expect((await rollback(payload, id)).ok).toBe(true)
  })

  test('dangling media references are rejected before any write', async () => {
    const poisoned = resealed({ ...original, docs: original.docs.map(doc => doc.wpId === 4001 ? { ...doc, desiredStatus: 'draft' as const, refs: { coverImage: 999999 } , targetHash: hashOf({ data: doc.data, refs: { coverImage: 999999 } }) } : doc) })
    expect(() => validatePlan(poisoned)).toThrow('dangling reference')
  })
})

describe('later editorial publication', () => {
  test('publishing in the CMS activates its redirect on the next apply, and rollback then refuses to unpublish it', async () => {
    const id = runId()
    await apply(payload, original, { runId: id })
    const page = (await payload.find({ collection: 'pages', where: { wpId: { equals: 1006 } }, overrideAccess: true })).docs[0] as any
    const row = async () => (await payload.find({ collection: 'redirects', where: { wpId: { equals: 1006 } }, overrideAccess: true })).docs[0] as any
    expect((await row()).active).toBe(false)
    await payload.update({ collection: 'pages', id: page.id, data: { _status: 'published' } as any, overrideAccess: true })
    const again = runId()
    const report = await apply(payload, original, { runId: again })
    expect(report.counts).toMatchObject({ created: 0, updated: 0, failed: 0 })
    expect(report.counts.redirects).toMatchObject({ updated: 1, created: 0, failed: 0 })
    expect((await row()).active).toBe(true)
    expect((await rollback(payload, id)).refusals.map(item => item.reason)).toContain('later-run-depends-on-document')
    expect((await rollback(payload, again)).ok).toBe(true)
    expect((await row()).active).toBe(false)
    const refused = await rollback(payload, id)
    expect(refused.refusals.map(item => item.reason)).toContain('published-since-import')
    expect((await rollback(payload, id, { discardEdits: true })).ok).toBe(true)
    expect(await payload.count({ collection: 'pages', where: { wpId: { exists: true } }, overrideAccess: true })).toMatchObject({ totalDocs: 0 })
  })
})

describe('command line guards', () => {
  test('arguments are strict and the database must be local', () => {
    expect(parseArgs(['dry-run', '--plan', '/x/plan.json']).command).toBe('dry-run')
    expect(parseArgs(['rollback', '--run', 'wpimport-abc']).values['--run']).toBe('wpimport-abc')
    expect(() => parseArgs(['apply'])).toThrow('Usage')
    expect(() => parseArgs(['rollback', '--run', 'x', '--plan', 'y'])).toThrow('Usage')
    expect(() => parseArgs(['apply', '--plan', 'a', '--bogus'])).toThrow('Usage')
    expect(isLocalDatabase('postgresql:///terrace_cms?host=/tmp/socket&port=55432')).toBe(true)
    expect(isLocalDatabase('postgresql://postgres@127.0.0.1:5432/terrace_cms')).toBe(true)
    expect(isLocalDatabase('postgresql://postgres@db.example.invalid:5432/terrace_cms')).toBe(false)
    expect(isLocalDatabase(undefined)).toBe(false)
  })
})
