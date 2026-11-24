// The PACKAGED operator tools: `bin/roster-invite` and `bin/wp-import` from an extracted CMS release, run with Node and no source checkout
// beside them, against the same real PostgreSQL as the other CMS tests. TERRACE_RELEASE_CMS names the extracted release directory: CI
// (tools/ci.ts) sets it to the archive it just built, and tools/release/README.md ("Operator tools") gives the builder procedure. Without it
// these tests are skipped, except in CI, where a missing release fails.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { spawn } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'
import { getPayload, type Payload } from 'payload'
import config from '../src/payload.config'
import { productionRealm } from '../../identity/tools/production-realm'
import { isLocalDatabase } from '../tools/local-database'
import { confirmProductionRefusal } from '../tools/wp-import'

const release = process.env.TERRACE_RELEASE_CMS
const cms = join(import.meta.dir, '..')
test('CI runs these tests against the release it built', () => {
  if (process.env.CI === 'true') expect(release && existsSync(join(release, 'release.json'))).toBe(true)
})

type Result = { code: number | null; out: string; err: string; ms: number }
/** Run a packaged entry (`bin/<name>`) or, for comparison, the source command line with Bun. Environment values set to undefined are removed. */
function run(command: string[], env: Record<string, string | undefined>, cwd = cms): Promise<Result> {
  const merged = Object.fromEntries(Object.entries({ ...process.env, ...env }).filter(([, value]) => value !== undefined)) as Record<string, string>
  const started = Date.now()
  const child = spawn(command[0], command.slice(1), { cwd, env: merged, stdio: ['ignore', 'pipe', 'pipe'] })
  let out = '', err = ''
  child.stdout.on('data', (data) => { out += data }); child.stderr.on('data', (data) => { err += data })
  return new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', (code) => resolve({ code, out, err, ms: Date.now() - started })) })
}
// Payload's own start-up log lines may come first; the tool's summary is the indented JSON object that follows them.
const summaryOf = (out: string) => JSON.parse(out.slice(out.indexOf('\n{\n') + 1))

function productionEnv(): Record<string, string | undefined> {
  const realm = productionRealm('https://www.terrace.example', 'https://editor.terrace.example', { webSecret: 'synthetic-web-'.repeat(4), introspectionSecret: 'synthetic-community-'.repeat(4), cmsSecret: 'synthetic-editor-'.repeat(4), editorialSecret: 'synthetic-editorial-'.repeat(4) })
  const editor = realm.clients.find((client) => client.redirectUris.some((uri) => uri.endsWith('/api/editorial/callback')))!
  const member = realm.clients.find((client) => client.redirectUris.some((uri) => uri.endsWith('/auth/callback')))!
  const resource = (client: typeof editor) => client.protocolMappers![0].config['included.custom.audience']
  const identity = 'https://identity.terrace.example/realms/terrace'
  return {
    CMS_PUBLIC_DEPLOYMENT: '1', CMS_ORIGIN: 'https://editor.terrace.example', PAYLOAD_SECRET: 'synthetic-payload-'.repeat(4),
    CMS_AUTH_ISSUER: identity, CMS_AUTH_CLIENT_ID: editor.clientId, CMS_AUTH_AUDIENCE: resource(editor), CMS_AUTH_CLIENT_SECRET: editor.secret,
    CMS_AUTH_INTROSPECTION_CLIENT_ID: resource(editor), CMS_AUTH_INTROSPECTION_SECRET: 'synthetic-editorial-'.repeat(4),
    MEMBER_AUTH_ISSUER: identity, MEMBER_AUTH_CLIENT_ID: member.clientId, MEMBER_AUTH_AUDIENCE: resource(member), MEMBER_AUTH_INTROSPECTION_CLIENT_ID: resource(member),
    MEMBER_AUTH_INTROSPECTION_SECRET: 'synthetic-community-'.repeat(4), LIFECYCLE_PUBLIC_ORIGIN: 'https://www.terrace.example',
    // The public profile forbids the local bootstrap settings, exactly as on a host.
    CMS_LOCAL_BOOTSTRAP: undefined, CMS_BOOTSTRAP_EMAIL: undefined, CMS_BOOTSTRAP_PASSWORD: undefined, NODE_ENV: undefined,
  }
}

describe.skipIf(!release)('packaged operator tools', () => {
  const root = release!
  const suffix = crypto.randomUUID().slice(0, 8)
  const work = mkdtempSync(join(tmpdir(), 'terrace-release-tools-'))
  const privateDirectory = join(work, 'private'), outbox = join(work, 'outbox'), media = join(work, 'media')
  let sequence = 0
  let payload: Payload
  let admin: { id: number | string; email: string }
  let db: pg.Pool
  const q = (text: string, values: unknown[] = []) => db.query(text, values)
  const users: Array<number | string> = []
  // CI's database is a service host, not local: the importer then needs its explicit flag, as the source fixture test does.
  const nonlocal = isLocalDatabase(process.env.DATABASE_URI) ? [] : ['--allow-nonlocal-database']
  const host = (): Record<string, string | undefined> => ({ ...productionEnv(), DATABASE_URI: process.env.DATABASE_URI, CMS_MEDIA_DIR: media, LIFECYCLE_OUTBOX_DIR: outbox })
  const local = (): Record<string, string | undefined> => ({ CMS_MEDIA_DIR: media })
  const bin = (name: string, args: string[], env: Record<string, string | undefined>) => run([join(root, 'bin', name), ...args], env, work)
  const email = (name: string) => `${name.toLowerCase().replace(/\s+/g, '-')}-${suffix}@terrace.invalid`
  const csv = (...names: string[]) => ['name,affiliation,class_year,contact_email', ...names.map((name) => `Packaged ${name} ${suffix},alumni,2004,${email(name)}`)].join('\n') + '\n'
  const privateFile = (name: string, content: string) => { const file = join(privateDirectory, name); writeFileSync(file, content, { mode: 0o600 }); chmodSync(file, 0o600); return file }
  const report = () => join(privateDirectory, `report-${sequence++}.json`)
  const counts = async () => ({
    applications: Number((await q(`SELECT count(*)::int AS n FROM member_applications WHERE contact_email LIKE $1`, [`%${suffix}%`])).rows[0].n),
    invitations: Number((await q(`SELECT count(*)::int AS n FROM member_invitations WHERE application_id IN (SELECT id FROM member_applications WHERE contact_email LIKE $1)`, [`%${suffix}%`])).rows[0].n),
    outbox: Number((await q(`SELECT count(*)::int AS n FROM message_outbox WHERE recipient_email LIKE $1`, [`%${suffix}%`])).rows[0].n),
    runs: Number((await q(`SELECT count(*)::int AS n FROM roster_runs WHERE operator_id = $1`, [admin.id])).rows[0].n),
    items: Number((await q(`SELECT count(*)::int AS n FROM roster_run_items i JOIN roster_runs r ON r.id = i.run_id WHERE r.operator_id = $1`, [admin.id])).rows[0].n),
    files: readdirSync(outbox).length,
  })
  const dryRun = async (file: string, env = local()) => {
    const result = await bin('roster-invite', ['dry-run', '--file', file, '--operator', String(admin.id), '--report', report()], env)
    expect([result.code, result.err]).toEqual([0, ''])
    return summaryOf(result.out)
  }

  beforeAll(async () => {
    if (process.env.CMS_LOCAL_BOOTSTRAP !== '1') throw new Error('These tests require isolated local data.')
    for (const directory of [privateDirectory, outbox, media]) mkdirSync(directory, { mode: 0o700 })
    db = new pg.Pool({ connectionString: process.env.DATABASE_URI, max: 3 })
    payload = await getPayload({ config, key: 'release-tools-tests' })
    const created = await payload.create({ collection: 'users', overrideAccess: true, data: { email: `admin-packaged-${suffix}@terrace.invalid`, password: `local-${crypto.randomUUID()}`, displayName: 'Packaged admin', role: 'admin' } })
    users.push(created.id)
    admin = { id: created.id, email: created.email }
  })

  afterAll(async () => {
    await q(`DELETE FROM roster_run_items WHERE run_id IN (SELECT id FROM roster_runs WHERE operator_id = ANY($1))`, [users]).catch(() => {})
    await q(`DELETE FROM roster_runs WHERE operator_id = ANY($1)`, [users]).catch(() => {})
    await q(`DELETE FROM message_outbox WHERE recipient_email LIKE $1`, [`%${suffix}%`]).catch(() => {})
    await q(`DELETE FROM member_invitations WHERE application_id IN (SELECT id FROM member_applications WHERE contact_email LIKE $1)`, [`%${suffix}%`]).catch(() => {})
    await q(`DELETE FROM member_applications WHERE contact_email LIKE $1`, [`%${suffix}%`]).catch(() => {})
    for (const id of users) await payload?.delete({ collection: 'users', id, overrideAccess: true }).catch(() => {})
    await db?.end()
    await payload?.db.destroy?.()
    rmSync(work, { recursive: true, force: true })
  })

  test('the release lists both tools as entry points, and its file hashes cover them', () => {
    const manifest = JSON.parse(readFileSync(join(root, 'release.json'), 'utf8'))
    expect(manifest.entrypoints).toMatchObject({ 'roster-invite': 'bin/roster-invite', 'wp-import': 'bin/wp-import' })
    for (const name of ['bin/roster-invite', 'bin/wp-import', 'roster-invite.mjs', 'wp-import.mjs']) {
      expect(manifest.files[name]).toBe(new Bun.CryptoHasher('sha256').update(readFileSync(join(root, name))).digest('hex'))
    }
    expect(statSync(join(root, 'bin/roster-invite')).mode & 0o111).not.toBe(0)
    // Application code is bundled into each entry; only packages are imported, and those come from the release's own node_modules.
    for (const name of ['roster-invite.mjs', 'wp-import.mjs']) expect(readFileSync(join(root, name), 'utf8')).not.toMatch(/(from|import\()\s*["']\.{1,2}\//)
  })

  test('an unknown argument is refused exactly as the source tool refuses it, before any configuration or database', async () => {
    const cases: Array<[string, string[]]> = [['roster-invite', ['--surprise']], ['roster-invite', ['apply', '--file']], ['roster-invite', ['dry-run', '--file', '/x.csv', '--operator', '1', '--report', '/r.json', '--confirm-production']],
      ['wp-import', ['--surprise']], ['wp-import', ['dry-run', '--plan', '/x.json', '--confirm-production']], ['wp-import', ['import', '--plan', '/x.json']]]
    // No database and no secret: a usage refusal must not need either.
    const bare = { DATABASE_URI: undefined, PAYLOAD_SECRET: undefined, CMS_MEDIA_DIR: media }
    for (const [tool, args] of cases) {
      const packaged = await bin(tool, args, bare)
      const source = await run(['bun', `tools/${tool}.ts`, ...args], bare)
      expect(packaged.code).toBe(1)
      expect(packaged.out).toBe('')
      expect(packaged.err).toStartWith('Usage: ')
      expect({ code: packaged.code, out: packaged.out, err: packaged.err }).toEqual({ code: source.code, out: source.out, err: source.err })
    }
  }, 60_000)

  test('roster: a dry run is the default and writes nothing; it prints counts and hashes only', async () => {
    const file = privateFile('dry.csv', csv('Dry One', 'Dry Two'))
    const before = await counts()
    const explicit = await dryRun(file)
    const implicit = await bin('roster-invite', ['--file', file, '--operator', String(admin.id), '--report', report()], local())
    expect(implicit.code).toBe(0)
    expect(summaryOf(implicit.out).planSha256).toBe(explicit.planSha256)
    expect(explicit.mode).toBe('dry-run')
    expect(explicit.counts).toEqual({ rows: 2, create: 2, reject: 0, skip: 0, deferred: 0 })
    expect(await counts()).toEqual(before)
    for (const output of [JSON.stringify(explicit), implicit.out, implicit.err]) for (const needle of [suffix, '@terrace.invalid', 'Dry One']) expect(output).not.toContain(needle)
  }, 60_000)

  test('roster: apply writes the journal, applications, invitations and link files; a re-run is idempotent; rollback undoes it', async () => {
    const file = privateFile('apply.csv', csv('Apply One', 'Apply Two'))
    const plan = await dryRun(file)
    const before = await counts()
    // A public deployment is a production target: refused without the confirmation, before anything is written.
    const unconfirmed = await bin('roster-invite', ['apply', '--file', file, '--operator', String(admin.id), '--plan-sha256', plan.planSha256], host())
    expect(unconfirmed.code).toBe(1)
    expect(unconfirmed.err.trim()).toBe('This is a production target. Pass --confirm-production.')
    expect(await counts()).toEqual(before)
    const applied = await bin('roster-invite', ['apply', '--file', file, '--operator', admin.email, '--plan-sha256', plan.planSha256, '--report', report(), '--confirm-production'], host())
    expect([applied.code, applied.err]).toEqual([0, ''])
    const summary = summaryOf(applied.out)
    expect(summary.counts).toMatchObject({ created: 2, failed: 0 })
    expect(await counts()).toEqual({ ...before, applications: before.applications + 2, invitations: before.invitations + 2, outbox: before.outbox + 2, runs: before.runs + 1, items: before.items + 2, files: before.files + 2 })
    const journal = (await q(`SELECT r.status, r.plan_sha256, count(i.id)::int AS items FROM roster_runs r JOIN roster_run_items i ON i.run_id = r.id WHERE r.run_id = $1 GROUP BY r.id`, [summary.runId])).rows
    expect(journal).toEqual([{ status: 'completed', plan_sha256: plan.planSha256, items: 2 }])
    for (const name of readdirSync(outbox)) expect(statSync(join(outbox, name)).mode & 0o777).toBe(0o600)
    // The same hash again is stale (the set to create changed), and a fresh dry run plans nothing; applying that changes nothing and journals nothing.
    const stale = await bin('roster-invite', ['apply', '--file', file, '--operator', admin.email, '--plan-sha256', plan.planSha256, '--confirm-production'], host())
    expect(stale.code).toBe(1)
    expect(stale.err).toContain('Re-run the dry run')
    const again = await dryRun(file)
    expect(again.counts).toMatchObject({ create: 0, skip: 2 })
    const after = await counts()
    const noop = await bin('roster-invite', ['apply', '--file', file, '--operator', admin.email, '--plan-sha256', again.planSha256, '--confirm-production'], host())
    expect(noop.code).toBe(0)
    expect(summaryOf(noop.out)).toMatchObject({ runId: null, counts: { created: 0, skip: 2 } })
    expect(await counts()).toEqual(after)
    const back = await bin('roster-invite', ['rollback', '--run', summary.runId, '--operator', String(admin.id), '--confirm-production'], host())
    expect([back.code, back.err]).toEqual([0, ''])
    expect(summaryOf(back.out)).toMatchObject({ ok: true, revoked: 2, withdrawn: 2 })
    for (const output of [applied, stale, noop, back]) for (const needle of [suffix, '@terrace.invalid', 'join/#']) { expect(output.out).not.toContain(needle); expect(output.err).not.toContain(needle) }
  }, 120_000)

  test('roster: LIFECYCLE_LOCK_TIMEOUT_MS sets how long a row waits for a held address lock (below, at and above the default)', async () => {
    const address = email('Lock Held')
    const file = privateFile('lock.csv', csv('Lock Held'))
    const holder = await db.connect()
    const waits: Record<string, number> = {}
    try {
      await holder.query('BEGIN')
      await holder.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`terrace-application-email:${address}`])
      const holderPid = (await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
      for (const setting of ['300', undefined, '6000']) {
        const plan = await dryRun(file)
        const child = bin('roster-invite', ['apply', '--file', file, '--operator', String(admin.id), '--plan-sha256', plan.planSha256, '--confirm-production'], { ...host(), LIFECYCLE_LOCK_TIMEOUT_MS: setting })
        // Watch the database for this tool's backend waiting on the held key: from the first sample that shows it waiting to the first that does not.
        let finished = false, first = 0, last = 0
        void child.finally(() => { finished = true })
        while (!finished) {
          const waiting = Number((await q(`SELECT count(*)::int AS n FROM pg_locks w JOIN pg_locks h ON h.locktype = 'advisory' AND h.granted AND h.pid = $1 AND w.classid = h.classid AND w.objid = h.objid AND w.objsubid = h.objsubid WHERE w.locktype = 'advisory' AND NOT w.granted`, [holderPid])).rows[0].n)
          const now = performance.now()
          if (waiting && !first) first = now
          if (!waiting && first && !last) last = now
          await new Promise((resolve) => setTimeout(resolve, 20))
        }
        const result = await child
        expect(first).toBeGreaterThan(0)
        waits[setting ?? 'default'] = Math.round((last || performance.now()) - first)
        expect(result.code).toBe(1)
        expect(summaryOf(result.out)).toMatchObject({ failure: 'address-locked', counts: { created: 0, failed: 1 } })
        expect((await q(`SELECT count(*)::int AS n FROM member_applications WHERE lower(contact_email) = $1`, [address])).rows[0].n).toBe(0)
      }
    } finally { await holder.query('ROLLBACK').catch(() => undefined); holder.release() }
    console.log(`packaged roster lock waits (ms): ${JSON.stringify(waits)}`)
    // A failure of these bounds means the measured wait did not follow the setting, unless the database was so slow that sampling pg_locks every ~20 ms lagged.

    expect(waits['300']).toBeGreaterThanOrEqual(200)
    expect(waits['300']).toBeLessThan(1200)
    expect(waits.default).toBeGreaterThanOrEqual(2800)
    expect(waits.default).toBeLessThan(4000)
    expect(waits['6000']).toBeGreaterThanOrEqual(5800)
    expect(waits['6000']).toBeLessThan(7000)
    // With the holder gone, the same row goes through.
    const plan = await dryRun(file)
    const done = await bin('roster-invite', ['apply', '--file', file, '--operator', String(admin.id), '--plan-sha256', plan.planSha256, '--confirm-production'], { ...host(), LIFECYCLE_LOCK_TIMEOUT_MS: '300' })
    expect(summaryOf(done.out).counts).toMatchObject({ created: 1, failed: 0 })
  }, 120_000)

  test('importer: the synthetic fixture plan runs through the packaged entry: dry run, confirmed apply, no-op re-apply, rollback', async () => {
    const plan = join(privateDirectory, 'fixture-plan.json')
    copyFileSync(join(cms, 'test/fixtures/wp-import-plan.synthetic.json'), plan)
    chmodSync(plan, 0o600)
    const id = `wpimport-packaged-${suffix}`
    const runs = async () => Number((await q(`SELECT count(*)::int AS n FROM wp_import_runs WHERE run_id = $1`, [id])).rows[0].n)
    // Row counts of every table, and of the content tables alone (all but the run ledger, which an apply and a rollback both add to by design).
    const tables = (await q(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`)).rows.map((row) => String(row.table_name))
    const snapshot = async (except: string[] = []) => {
      const result: Record<string, number> = {}
      for (const table of tables) if (!except.includes(table)) result[table] = Number((await q(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n)
      return result
    }
    const ledger = ['wp_import_runs', 'wp_import_journal', 'payload_locked_documents', 'payload_locked_documents_rels']
    const beforeDry = await snapshot()
    const dry = await bin('wp-import', ['dry-run', '--plan', plan, '--report', report(), ...nonlocal], host())
    expect([dry.code, dry.err]).toEqual([0, ''])
    const planned = summaryOf(dry.out)
    expect(planned).toMatchObject({ mode: 'dry-run', counts: { failed: 0 } })
    expect(planned.counts.created).toBeGreaterThan(0)
    // The dry run wrote nothing anywhere.
    expect(await snapshot()).toEqual(beforeDry)
    // The host's production environment makes every write need the confirmation; nothing is written without it.
    const unconfirmed = await bin('wp-import', ['apply', '--plan', plan, '--run-id', id, ...nonlocal], host())
    expect(unconfirmed.code).toBe(1)
    expect(unconfirmed.err.trim()).toBe(confirmProductionRefusal)
    expect(await snapshot()).toEqual(beforeDry)
    const beforeApply = await snapshot(ledger)
    const applied = await bin('wp-import', ['apply', '--plan', plan, '--report', report(), '--run-id', id, '--confirm-production', ...nonlocal], host())
    expect([applied.code, applied.err]).toEqual([0, ''])
    const appliedCounts = summaryOf(applied.out).counts
    const created = appliedCounts.created, redirectsCreated = appliedCounts.redirects.created
    expect(created).toBe(planned.counts.created)
    expect(redirectsCreated).toBeGreaterThan(0)
    expect(await runs()).toBe(1)
    const afterApply = await snapshot(ledger)
    const grown = Object.keys(afterApply).filter((table) => afterApply[table] > beforeApply[table])
    expect(grown.length).toBeGreaterThan(0)
    // A second identical apply skips everything and changes no content row.
    const again = await bin('wp-import', ['apply', '--plan', plan, '--report', report(), '--confirm-production', ...nonlocal], host())
    expect([again.code, again.err]).toEqual([0, ''])
    const repeated = summaryOf(again.out).counts
    expect(repeated).toMatchObject({ created: 0, updated: 0, failed: 0 })
    expect(repeated.skipped).toBe(created)
    expect(await snapshot(ledger)).toEqual(afterApply)
    // Rollback removes exactly what the apply created (its documents and its redirect rows): every content table is back to its count before the apply.
    const back = await bin('wp-import', ['rollback', '--run', id, '--report', report(), '--confirm-production', ...nonlocal], host())
    expect([back.code, back.err]).toEqual([0, ''])
    expect(summaryOf(back.out)).toMatchObject({ ok: true, refusals: [], deleted: created + redirectsCreated, restored: 0, alreadyGone: 0 })
    expect(await snapshot(ledger)).toEqual(beforeApply)
    // A relative plan path is refused with fixed text: the packaged command runs from the release directory.
    const relative = await bin('wp-import', ['dry-run', '--plan', 'fixture-plan.json', ...nonlocal], host())
    expect(relative.code).toBe(1)
    expect(relative.err.trim()).toBe('Give the plan file as an absolute path.')
    for (const output of [dry, applied, again, back]) expect(output.out + output.err).not.toContain(privateDirectory)
  }, 120_000)
})
