// Ordinary-CI coverage for the release proof (tools/release/smoke.ts and cms/tools/test-*.ts), which only runs on a
// Linux builder. These tests fail when the proof goes stale against the code it exercises.
import { expect, test } from 'bun:test'
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import config from '../src/payload.config'
import { productionRealm } from '../../identity/tools/production-realm'
import { appEnvKeys, cmsAuthKeys, lifecycleKeys, memberAuthKeys } from '../../identity/tools/app-env-keys'
import { parseIdentityEnv } from '../../tools/release/identity-env'
import { assertSweepSummary } from '../../tools/release/sweep-summary'

const repo = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const read = (path: string) => readFileSync(join(repo, path), 'utf8')

// --- A. identity settings parser ------------------------------------------------------------------------------------
const sample = (over: Record<string, string | null> = {}) => {
  const values: Record<string, string> = Object.fromEntries(appEnvKeys.map(key => [key, `secret-value-for-${key}`]))
  values.LIFECYCLE_PUBLIC_ORIGIN = 'http://127.0.0.1:4194'
  values.LIFECYCLE_OUTBOX_DIR = '/srv/outbox-dir'
  for (const [key, value] of Object.entries(over)) { if (value === null) delete values[key]; else values[key] = value }
  return Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n'
}
const message = (text: string) => { try { parseIdentityEnv(text) } catch (error) { return (error as Error).message } return '' }

test('the key set matches what the identity bootstrap writes', () => {
  const source = read('identity/tools/local-up.ts')
  const block = source.slice(source.indexOf('const env: AppEnv = {'), source.indexOf('writeFileSync(resolve(state, \'app.env\')'))
  expect(block.length).toBeGreaterThan(100)
  const written = [...block.matchAll(/\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+):/g)].map(match => match[1]).sort()
  expect(written).toEqual([...appEnvKeys].sort())
})

test('identity settings: lifecycle keys are accepted and dropped, authentication keys kept', () => {
  const parsed = parseIdentityEnv(sample())
  expect(Object.keys(parsed).sort()).toEqual([...memberAuthKeys, ...cmsAuthKeys].sort())
  for (const key of lifecycleKeys) expect(parsed).not.toHaveProperty(key)
  expect(parsed.MEMBER_AUTH_CLIENT_SECRET).toBe('secret-value-for-MEMBER_AUTH_CLIENT_SECRET')
  expect(parsed.CMS_AUTH_ISSUER).toBe('secret-value-for-CMS_AUTH_ISSUER')
})

test('identity settings: unknown, duplicate, missing, empty and malformed lines throw without echoing values', () => {
  const secret = 'do-not-leak-this-value'
  const base = sample()
  const bad: string[] = [
    base + `UNKNOWN_KEY=${secret}\n`, base + `LIFECYCLE_EXTRA_KEY=${secret}\n`, base + `MEMBER_AUTH_EXTRA=${secret}\n`, base + `lowercase=${secret}\n`,
    base + `MEMBER_AUTH_ISSUER=${secret}\n`, base + `${secret}\n`, base + `=${secret}\n`, base + 'MEMBER_AUTH_ORIGIN=\n',
    sample({ CMS_AUTH_CLIENT_SECRET: null }), sample({ LIFECYCLE_INTAKE_SECRET: null }),
    sample({ LIFECYCLE_PUBLIC_ORIGIN: secret }), sample({ LIFECYCLE_PUBLIC_ORIGIN: `ftp://${secret}.invalid` }),
    sample({ LIFECYCLE_OUTBOX_DIR: `relative/${secret}` }), '',
  ]
  for (const text of bad) {
    const reported = message(text)
    expect(reported).not.toBe('')
    expect(reported).not.toContain(secret)
    expect(reported).not.toContain('secret-value-for-')
  }
})

// --- B. references from the proof to the Payload configuration -------------------------------------------------------
const legacy = new Set(['story-reports'])
const scanned = ['tools/release/smoke.ts', ...readdirSync(join(repo, 'cms/tools')).filter(name => /^test-.*\.ts$/.test(name)).map(name => `cms/tools/${name}`)]

test('every collection the proof calls exists in the Payload configuration', async () => {
  const resolved = await config
  const slugs = new Set(resolved.collections.map(collection => collection.slug))
  const endpoints = new Set(resolved.endpoints.map(endpoint => endpoint.path.split('/').filter(Boolean)[0]))
  expect(scanned.length).toBeGreaterThan(3)
  const seen = new Set<string>()
  for (const file of scanned) {
    for (const match of read(file).matchAll(/(?:\/api|\/admin\/collections)\/([a-z][a-z0-9-]*)/g)) seen.add(match[1])
  }
  expect(seen.has('moderation-reports')).toBe(true)
  const unknown = [...seen].filter(slug => !slugs.has(slug) && !endpoints.has(slug))
  expect(unknown).toEqual([])
  // The legacy collection still exists (the proof asserts it is no longer written); nothing else is legacy.
  for (const slug of legacy) expect(slugs.has(slug)).toBe(true)
})

test('the report browser check reads only fields the moderation queue defines', async () => {
  const fields = new Set((await config).collections.find(collection => collection.slug === 'moderation-reports')!.fields.flatMap(field => 'name' in field ? [field.name] : []))
  const source = read('cms/tools/test-reports-browser.ts')
  const named = ['snapshotTitle', 'snapshotBody', 'targetType', 'targetId', 'status', 'reason']
  for (const name of named) expect(fields.has(name)).toBe(true)
  // Properties read from a report body, and keys tested with `in`, so a renamed field cannot make a negative check vacuous.
  const bodies = '(?:snapshot|editorView|resolvedBody\\.doc|resolvedBody)'
  const reads = [...source.matchAll(new RegExp(`\\b${bodies}\\)?\\??\\.([A-Za-z]+)`, 'g')).map(match => match[1]),
    ...source.matchAll(new RegExp(`'([A-Za-z]+)' in ${bodies}`, 'g')).map(match => match[1])]
  const implicit = new Set(['id', 'doc', 'docs', 'createdAt', 'updatedAt', 'totalDocs'])
  expect(reads.length).toBeGreaterThan(8)
  expect(reads.filter(name => !fields.has(name) && !implicit.has(name))).toEqual([])
  for (const name of named) expect(source.includes(name)).toBe(true)
  for (const name of ['reporter', 'targetAuthor', 'reportKey']) expect(fields.has(name)).toBe(true)
})

// --- C. typechecking -------------------------------------------------------------------------------------------------------
test('every TypeScript file under cms/tools and tools/release is in a type-checked project (check:release)', () => {
  const patterns = ['tsconfig.release.json', 'tsconfig.migrate.json', 'tsconfig.import.json', 'tsconfig.roster.json'].flatMap(name => JSON.parse(read(`cms/${name}`)).include as string[])
  const files = [...readdirSync(join(repo, 'cms/tools')).filter(name => name.endsWith('.ts')).map(name => `tools/${name}`),
    ...readdirSync(join(repo, 'tools/release')).filter(name => name.endsWith('.ts')).map(name => `../tools/release/${name}`)]
  expect(files.length).toBeGreaterThan(10)
  expect(files.filter(file => !patterns.some(pattern => new Bun.Glob(pattern).match(file)))).toEqual([])
})

// --- sweep summary shape (unit) ----------------------------------------------------------------------------------------
const clean = { mirror: { redacted: 0, written: 1 }, unlinkedRedeemedApplications: 0, applicationsWithdrawn: 0, invitationsExpired: 0, moderatedPastGrace: {}, moderatedPurged: 0, offboardedPastGrace: 0 }
test('the sweep summary check accepts a clean run and rejects every kind of failure', () => {
  const ok = { written: 1, forbidden: ['a@b.invalid'] }
  expect(() => assertSweepSummary(clean, ok)).not.toThrow()
  expect(() => assertSweepSummary({ ...clean, mirror: { ...clean.mirror, failed: 0 } }, ok)).not.toThrow()
  for (const failed of [true, 1, '0', null, false, undefined]) expect(() => assertSweepSummary({ ...clean, mirror: { ...clean.mirror, failed } }, ok)).toThrow()
  for (const bad of [null, [], 'x', { ...clean, mirror: undefined }, { ...clean, mirror: { redacted: 0, written: 0 } }, { ...clean, mirror: { redacted: 0, written: 0, skipped: 'x' } },
    { ...clean, unlinkedRedeemedApplications: -1 }, { ...clean, invitationsExpired: '0' }, { ...clean, offboardedPastGrace: undefined }, { ...clean, note: 'a@b.invalid' }]) {
    expect(() => assertSweepSummary(bad, ok)).toThrow()
  }
})

// --- D. the sweep entry, in source form ----------------------------------------------------------------------------------
const entry = join(repo, 'cms/tools/release-sweep.ts')
async function runEntry(args: string[], env: Record<string, string | undefined>) {
  const child = spawn('bun', [entry, ...args], { cwd: join(repo, 'cms'), env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, ...env } as NodeJS.ProcessEnv, stdio: ['ignore', 'pipe', 'pipe'] })
  let stdout = '', stderr = ''
  child.stdout.on('data', data => { stdout += data }); child.stderr.on('data', data => { stderr += data })
  const code = await new Promise<number | null>(done => child.once('exit', done))
  return { code, stdout, stderr }
}

test('the sweep entry rejects an unknown argument with usage and exit 64', async () => {
  const result = await runEntry(['--surprise'], {})
  expect(result.code).toBe(64)
  expect(result.stderr.trim()).toBe('Usage: bin/sweep [--purge-moderated]')
  expect(result.stdout).toBe('')
})

const productionBaseline = (() => {
  const credentials = { webSecret: 'synthetic-web-'.repeat(4), introspectionSecret: 'synthetic-community-'.repeat(4), cmsSecret: 'synthetic-editor-'.repeat(4), editorialSecret: 'synthetic-editorial-'.repeat(4) }
  const realm = productionRealm('https://www.terrace.example', 'https://editor.terrace.example', credentials)
  const editor = realm.clients.find(client => client.redirectUris.some(uri => uri.endsWith('/api/editorial/callback')))!
  const member = realm.clients.find(client => client.redirectUris.some(uri => uri.endsWith('/auth/callback')))!
  const resource = (client: typeof editor) => client.protocolMappers![0].config['included.custom.audience']
  const identity = 'https://identity.terrace.example/realms/terrace'
  return {
    CMS_PUBLIC_DEPLOYMENT: '1', CMS_ORIGIN: 'https://editor.terrace.example', CMS_MEDIA_DIR: '/var/lib/terrace-media', PAYLOAD_SECRET: 'synthetic-payload-'.repeat(4),
    CMS_AUTH_ISSUER: identity, CMS_AUTH_CLIENT_ID: editor.clientId, CMS_AUTH_AUDIENCE: resource(editor), CMS_AUTH_CLIENT_SECRET: editor.secret,
    CMS_AUTH_INTROSPECTION_CLIENT_ID: resource(editor), CMS_AUTH_INTROSPECTION_SECRET: credentials.editorialSecret,
    MEMBER_AUTH_ISSUER: identity, MEMBER_AUTH_CLIENT_ID: member.clientId, MEMBER_AUTH_AUDIENCE: resource(member),
    MEMBER_AUTH_INTROSPECTION_CLIENT_ID: resource(member), MEMBER_AUTH_INTROSPECTION_SECRET: credentials.introspectionSecret,
    LIFECYCLE_PUBLIC_ORIGIN: 'https://www.terrace.example',
  }
})()

test('a public sweep without LIFECYCLE_OUTBOX_DIR fails before it reaches the database', async () => {
  // A listener that counts connections and hangs up stands in for the database: the control run must reach it, the refused one must not.
  let connections = 0
  const listener = Bun.listen({ hostname: '127.0.0.1', port: 0, socket: { open(socket) { connections++; socket.end() }, data() {}, close() {}, error() {} } })
  const database = `postgresql://postgres@127.0.0.1:${listener.port}/terrace_sweep_probe`
  try {
    const outbox = join(mkdtempSync(join(tmpdir(), 'terrace-sweep-probe-')), 'mirror')
    const refused = await runEntry([], { ...productionBaseline, DATABASE_URI: database })
    expect(refused.code).not.toBe(0)
    expect(refused.stdout).toBe('')
    expect(refused.stderr).toContain('CMS lifecycle sweep failed')
    expect(connections).toBe(0)
    expect(existsSync(outbox)).toBe(false)
    // Control: the same configuration with the directory set gets as far as the database, so the refusal above is the missing directory.
    const control = await runEntry([], { ...productionBaseline, LIFECYCLE_OUTBOX_DIR: outbox, DATABASE_URI: database })
    expect(control.code).not.toBe(0)
    expect(connections).toBeGreaterThan(0)
  } finally { listener.stop(true) }
}, 130_000)
