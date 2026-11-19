import { afterAll, beforeAll, expect, test } from 'bun:test'
import { decodeJwt, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getPayload, type Payload } from 'payload'
import config from '../src/payload.config'
import { resetMemberVerifier, type KeycloakConfig } from '../src/auth/keycloak'
import { intake, own } from '../src/lifecycle/endpoints'
import { MAX_PENDING } from '../src/lifecycle/intake-validation'
import { hashToken } from '../src/lifecycle/tokens'
import { applyRoster, boundPlanHash, ERASED_NOTICE, failStaleRuns, parseRoster, planRoster, resolveOperator, rollbackRoster, ROSTER_HARD_MAX, RosterError, type Operator } from '../src/lifecycle/roster'
import { sweep } from '../src/lifecycle/sweep'
import { reconcileMirror } from '../src/lifecycle/outbox'
import { pool } from '../src/lifecycle/visibility'
import { OutputRefused, readPrivateInput } from '../../web/tools/private-output'
import { emitResult, parseArgs, productionGuard } from '../tools/roster-invite'
import { productionRealm } from '../../identity/tools/production-realm'

// A real signed token verified against a local identity stub, so first sign-in runs through the strategy a member really uses.
const key = await generateKeyPair('RS256')
const jwk = { ...await exportJWK(key.publicKey), kid: 'test-key', alg: 'RS256', use: 'sig' }
const server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
  const url = new URL(request.url)
  if (url.pathname.endsWith('/certs')) return Response.json({ keys: [jwk] })
  if (url.pathname.endsWith('/token/introspect')) {
    const form = await request.formData()
    return Response.json({ active: true, sub: decodeJwt(String(form.get('token'))).sub, exp: Math.floor(Date.now() / 1000) + 60 })
  }
  return new Response(null, { status: 404 })
} })
const settings: KeycloakConfig = { issuer: `http://127.0.0.1:${server.port}/realms/terrace-test`, audience: 'terrace-community', clientId: 'terrace-web', introspectionClientId: 'test-introspection', introspectionSecret: 'synthetic-secret' }

function productionEnv(): NodeJS.ProcessEnv {
  const realm = productionRealm('https://www.terrace.example', 'https://editor.terrace.example', { webSecret: 'synthetic-web-'.repeat(4), introspectionSecret: 'synthetic-community-'.repeat(4), cmsSecret: 'synthetic-editor-'.repeat(4), editorialSecret: 'synthetic-editorial-'.repeat(4) })
  const editorClient = realm.clients.find((client) => client.redirectUris.some((uri) => uri.endsWith('/api/editorial/callback')))!
  const memberClient = realm.clients.find((client) => client.redirectUris.some((uri) => uri.endsWith('/auth/callback')))!
  const resource = (client: typeof editorClient) => client.protocolMappers![0].config['included.custom.audience']
  const identity = 'https://identity.terrace.example/realms/terrace'
  return {
    NODE_ENV: 'test', CMS_PUBLIC_DEPLOYMENT: '1', CMS_ORIGIN: 'https://editor.terrace.example', CMS_MEDIA_DIR: '/var/lib/terrace-media', PAYLOAD_SECRET: 'synthetic-payload-'.repeat(4),
    CMS_AUTH_ISSUER: identity, CMS_AUTH_CLIENT_ID: editorClient.clientId, CMS_AUTH_AUDIENCE: resource(editorClient), CMS_AUTH_CLIENT_SECRET: editorClient.secret,
    CMS_AUTH_INTROSPECTION_CLIENT_ID: resource(editorClient), CMS_AUTH_INTROSPECTION_SECRET: 'synthetic-editorial-'.repeat(4),
    MEMBER_AUTH_ISSUER: identity, MEMBER_AUTH_CLIENT_ID: memberClient.clientId, MEMBER_AUTH_AUDIENCE: resource(memberClient), MEMBER_AUTH_INTROSPECTION_CLIENT_ID: resource(memberClient), MEMBER_AUTH_INTROSPECTION_SECRET: 'synthetic-community-'.repeat(4),
    LIFECYCLE_OUTBOX_DIR: '/var/lib/terrace-outbox', LIFECYCLE_PUBLIC_ORIGIN: 'https://www.terrace.example',
    DATABASE_URI: 'postgresql:///terrace_cms?host=/var/run/postgresql',
  }
}
const cmsDirectory = join(import.meta.dir, '..')
const suffix = crypto.randomUUID().slice(0, 8)
const secret = `synthetic-intake-secret-${crypto.randomUUID()}`
const outbox = mkdtempSync(join(tmpdir(), 'terrace-roster-outbox-'))
const privateDirectory = mkdtempSync(join(tmpdir(), 'terrace-roster-private-'))
let payload: Payload
let admin: any
let editor: any
const users: Array<number | string> = []
const members: number[] = []
const q = (text: string, values: unknown[] = []) => pool(payload).query(text, values)
let sequence = 0
const email = (name: string) => `${name.toLowerCase().replace(/\s+/g, '-')}-${suffix}@terrace.invalid`
const header = 'name,affiliation,class_year,contact_email'
const csv = (...lines: string[]) => [header, ...lines].join('\n') + '\n'
const person = (name: string, affiliation = 'alumni', year = '2004') => `Roster ${name} ${suffix},${affiliation},${year},${email(name)}`
const parsed = (...lines: string[]) => parseRoster(Buffer.from(csv(...lines)))
function csvFile(content: string, mode = 0o600): string {
  const file = join(privateDirectory, `roster-${sequence++}.csv`)
  writeFileSync(file, content, { mode })
  chmodSync(file, mode)
  return file
}
const reportPath = () => join(privateDirectory, `report-${sequence++}.json`)
const mirror = () => readdirSync(outbox).filter((file) => file.endsWith('.json')).sort().map((file) => ({ file, text: readFileSync(join(outbox, file), 'utf8') }))
const counts = async () => ({
  applications: Number((await q(`SELECT count(*)::int AS n FROM member_applications WHERE contact_email LIKE $1`, [`%${suffix}%`])).rows[0].n),
  invitations: Number((await q(`SELECT count(*)::int AS n FROM member_invitations WHERE application_id IN (SELECT id FROM member_applications WHERE contact_email LIKE $1)`, [`%${suffix}%`])).rows[0].n),
  outbox: Number((await q(`SELECT count(*)::int AS n FROM message_outbox WHERE recipient_email LIKE $1`, [`%${suffix}%`])).rows[0].n),
  runs: Number((await q(`SELECT count(*)::int AS n FROM roster_runs`)).rows[0].n),
  files: readdirSync(outbox).length,
})
const request = (user: any, body?: unknown, headers: Record<string, string> = {}) => ({ user, payload, headers: new Headers(headers), json: async () => body }) as any
const run = (args: string[], env: Record<string, string | undefined> = {}) => {
  const merged = Object.fromEntries(Object.entries({ ...process.env, ...env }).filter(([, value]) => value !== undefined)) as Record<string, string>
  const result = Bun.spawnSync(['bun', 'tools/roster-invite.ts', ...args], { cwd: cmsDirectory, env: merged, stdout: 'pipe', stderr: 'pipe' })
  return { code: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() }
}
// Payload's own start-up log lines come first; the tool's summary is the JSON object that follows them.
const summaryOf = (out: string) => JSON.parse(out.slice(out.indexOf('\n{\n') + 1))
async function makeUser(role: 'admin' | 'editor') {
  const created = await payload.create({ collection: 'users', overrideAccess: true, data: { email: `${role}-r-${suffix}-${users.length}@terrace.invalid`, password: `local-${crypto.randomUUID()}`, displayName: `Roster ${role}`, role } })
  users.push(created.id)
  return { ...created, collection: 'users' }
}
async function signed(subject: string, claims: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ iss: settings.issuer, aud: settings.audience, sub: subject, iat: now, exp: now + 60, jti: crypto.randomUUID(), azp: settings.clientId, typ: 'Bearer', name: 'Someone', realm_access: { roles: ['alumni'] }, ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).sign(key.privateKey)
}
const signIn = async (subject: string, claims: Record<string, unknown> = {}) => {
  const result = await payload.auth({ headers: new Headers({ authorization: `Bearer ${await signed(subject, claims)}` }) })
  if (result.user) members.push(Number(result.user.id))
  return result.user as any
}
async function everyTable(needles: string[]) {
  const tables = (await q(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT LIKE 'payload_migrations%'`)).rows.map((row) => String(row.table_name))
  const hits: string[] = []
  for (const table of tables) if (Number((await q(`SELECT count(*)::int AS n FROM "${table}" x WHERE x::text ILIKE ANY($1)`, [needles.map((needle) => `%${needle}%`)])).rows[0].n)) hits.push(table)
  return hits
}
// Writes through the command line go the production way (public-deployment configuration plus --confirm-production), whatever the database is: CI's
// database is a service host, and this also exercises the production confirmation end to end.
const writer = () => ({ ...productionEnv(), DATABASE_URI: process.env.DATABASE_URI, LIFECYCLE_OUTBOX_DIR: outbox, CMS_LOCAL_BOOTSTRAP: undefined, CMS_BOOTSTRAP_EMAIL: undefined, CMS_BOOTSTRAP_PASSWORD: undefined })
type Extra = { operator?: Operator; reinviteLapsed?: boolean; seams?: any; runId?: string }
const operatorOf = (user: any): Operator => ({ id: Number(user.id), label: String(user.displayName), sso: false })
const planFor = (roster: ReturnType<typeof parsed>, limit?: number, extra: Extra = {}) => planRoster(payload, roster, { operatorId: (extra.operator ?? operatorOf(admin)).id, limit, reinviteLapsed: extra.reinviteLapsed })
/** Plan as a reviewer would, then apply with exactly that plan's hash. */
const apply = async (roster: ReturnType<typeof parsed>, limit?: number, extra: Extra = {}) => {
  const operator = extra.operator ?? operatorOf(admin)
  const plan = await planFor(roster, limit, extra)
  return applyRoster(payload, roster, { operator, operatorId: operator.id, limit, planSha256: plan.planSha256, reinviteLapsed: extra.reinviteLapsed, seams: extra.seams, runId: extra.runId })
}

beforeAll(async () => {
  if (process.env.CMS_LOCAL_BOOTSTRAP !== '1') throw new Error('Roster tests require isolated local data.')
  process.env.LIFECYCLE_INTAKE_SECRET = secret
  process.env.LIFECYCLE_OUTBOX_DIR = outbox
  process.env.LIFECYCLE_PUBLIC_ORIGIN = 'http://127.0.0.1:4194'
  process.env.MEMBER_AUTH_ISSUER = settings.issuer
  process.env.MEMBER_AUTH_AUDIENCE = settings.audience
  process.env.MEMBER_AUTH_CLIENT_ID = settings.clientId
  process.env.MEMBER_AUTH_INTROSPECTION_CLIENT_ID = settings.introspectionClientId
  process.env.MEMBER_AUTH_INTROSPECTION_SECRET = settings.introspectionSecret
  resetMemberVerifier()
  payload = await getPayload({ config, key: 'roster-tests' })
  admin = await makeUser('admin')
  editor = await makeUser('editor')
})

afterAll(async () => {
  await q(`DELETE FROM roster_run_items WHERE application_id IN (SELECT id FROM member_applications WHERE contact_email LIKE $1 OR name LIKE $1)`, [`%${suffix}%`]).catch(() => {})
  await q(`DELETE FROM roster_run_items WHERE run_id IN (SELECT id FROM roster_runs WHERE operator_id = ANY($1))`, [users]).catch(() => {})
  await q(`DELETE FROM roster_runs WHERE operator_id = ANY($1)`, [users]).catch(() => {})
  await q(`DELETE FROM message_outbox WHERE recipient_email LIKE $1 OR dedupe_key LIKE 'staff-notice:roster:%'`, [`%${suffix}%`]).catch(() => {})
  await q(`DELETE FROM member_invitations WHERE application_id IN (SELECT id FROM member_applications WHERE contact_email LIKE $1 OR contact_email LIKE 'filler-%')`, [`%${suffix}%`]).catch(() => {})
  await q(`DELETE FROM member_applications WHERE contact_email LIKE $1 OR name LIKE $1 OR contact_email LIKE 'filler-%@terrace.invalid'`, [`%${suffix}%`]).catch(() => {})
  for (const id of members) await payload.delete({ collection: 'members', id, overrideAccess: true }).catch(() => {})
  for (const id of users) await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => {})
  rmSync(outbox, { recursive: true, force: true })
  rmSync(privateDirectory, { recursive: true, force: true })
  for (const name of ['MEMBER_AUTH_ISSUER', 'MEMBER_AUTH_AUDIENCE', 'MEMBER_AUTH_CLIENT_ID', 'MEMBER_AUTH_INTROSPECTION_CLIENT_ID', 'MEMBER_AUTH_INTROSPECTION_SECRET']) delete process.env[name]
  resetMemberVerifier()
  server.stop(true)
  await payload.db.destroy?.()
})

test('a roster row is valid exactly when the apply form accepts it', async () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ['valid alumnus', { name: 'Ada Example', affiliation: 'alumni', classYear: '1999', contactEmail: 'ada@example.invalid' }],
    ['valid without a class year', { name: 'Bo Example', affiliation: 'current-member', classYear: '', contactEmail: 'Bo@Example.Invalid' }],
    ['class year too early', { name: 'Cy', affiliation: 'alumni', classYear: '1903', contactEmail: 'cy@example.invalid' }],
    ['class year too late', { name: 'Di', affiliation: 'alumni', classYear: '2201', contactEmail: 'di@example.invalid' }],
    ['class year not a year', { name: 'Ed', affiliation: 'alumni', classYear: '20x4', contactEmail: 'ed@example.invalid' }],
    ['name too long', { name: 'N'.repeat(121), affiliation: 'alumni', classYear: '2004', contactEmail: 'fy@example.invalid' }],
    ['name at the limit', { name: 'N'.repeat(120), affiliation: 'alumni', classYear: '2004', contactEmail: 'gus@example.invalid' }],
    ['name missing', { name: '', affiliation: 'alumni', classYear: '2004', contactEmail: 'hal@example.invalid' }],
    ['affiliation unknown', { name: 'Ida', affiliation: 'friend', classYear: '2004', contactEmail: 'ida@example.invalid' }],
    ['email without a domain', { name: 'Jo', affiliation: 'alumni', classYear: '2004', contactEmail: 'jo@' }],
    ['email with a space', { name: 'Kit', affiliation: 'alumni', classYear: '2004', contactEmail: 'kit @example.invalid' }],
    ['email missing', { name: 'Lee', affiliation: 'alumni', classYear: '2004', contactEmail: '' }],
    ['email too long', { name: 'Mo', affiliation: 'alumni', classYear: '2004', contactEmail: `${'a'.repeat(65)}@example.invalid` }],
  ]
  for (const [label, row] of cases) {
    const line = `${row.name},${row.affiliation},${row.classYear},${row.contactEmail}`
    const roster = parseRoster(Buffer.from(`${header}\n${line}\n`))
    const form = await intake.apply(request(null, { ...row, classYear: row.classYear === '' ? undefined : Number(row.classYear) }, { 'x-terrace-intake': secret }))
    const accepted = form.status === 202
    // Do not leave the form's own applications behind.
    if (accepted) await q(`DELETE FROM member_applications WHERE lower(contact_email) = lower($1) AND status = 'pending'`, [String(row.contactEmail)])
    expect([label, roster.rows[0].reject === undefined]).toEqual([label, accepted])
  }
  // The roster applies the same trimming and lower-casing to what it stores.
  expect(parseRoster(Buffer.from(`${header}\n  Ann Example , alumni , 2001 , ANN@Example.Invalid \n`)).rows[0].application).toEqual({ name: 'Ann Example', affiliation: 'alumni', classYear: 2001, contactEmail: 'ann@example.invalid', note: undefined })
})

test('file-level rules: header, columns, encoding, quoting, duplicates and bounds', () => {
  expect(() => parseRoster(Buffer.from('Ann,alumni,2001,ann@example.invalid\n'))).toThrow(RosterError)
  expect(() => parseRoster(Buffer.from('name,affiliation\nAnn,alumni\n'))).toThrow(RosterError) // contact_email required
  expect(() => parseRoster(Buffer.from('name,affiliation,contact_email,note\nA,alumni,a@example.invalid,x\n'))).toThrow(RosterError) // no note column
  expect(() => parseRoster(Buffer.from('name,name,affiliation,contact_email\nA,A,alumni,a@example.invalid\n'))).toThrow(RosterError)
  expect(() => parseRoster(Buffer.from([0xff, 0xfe, 0x41]))).toThrow(RosterError) // not UTF-8
  expect(() => parseRoster(Buffer.from('name,affiliation,contact_email\n"A,alumni,a@example.invalid\n'))).toThrow(RosterError)
  expect(() => parseRoster(Buffer.alloc(1024 * 1024 + 1, 0x61))).toThrow(RosterError)
  // A header with only the required columns, a BOM, CRLF line ends, quoted commas and doubled quotes.
  const odd = parseRoster(Buffer.from('﻿Name,Affiliation,Contact_Email\r\n"Example, Ann ""AJ""",alumni,aj@example.invalid\r\n\r\nBo,current-member,bo@example.invalid'))
  expect(odd.rows.map((row) => row.application?.name)).toEqual(['Example, Ann "AJ"', 'Bo'])
  expect(odd.rows.map((row) => row.row)).toEqual([2, 4])
  // Wrong column count, a control character, a hex-looking year; and duplicates reject every row that uses the address.
  const bad = parseRoster(Buffer.from([header, 'A,alumni,2004', 'B\tC,alumni,2004,b@example.invalid', 'D,alumni,0x7d0,d@example.invalid', 'E,alumni,2004,dup@example.invalid', 'F,alumni,2005,DUP@example.invalid', 'G,alumni,,g@example.invalid'].join('\n')))
  expect(bad.rows.map((row) => row.reject)).toEqual(['wrong-column-count', 'invalid-fields', 'invalid-fields', 'duplicate-email-in-file', 'duplicate-email-in-file', undefined])
})

test('a dry run writes nothing, prints only counts, and reports row numbers with reasons in a private file', async () => {
  const lines = [person('Dry One'), person('Dry Two', 'current-member', ''), `Roster Bad ${suffix},stranger,2004,${email('dry-bad')}`]
  const file = csvFile(csv(...lines))
  const before = await counts()
  const report = reportPath()
  const result = run(['dry-run', '--file', file, '--operator', String(admin.id), '--report', report, '--limit', '10'])
  expect(result.code).toBe(0)
  expect(await counts()).toEqual(before)
  const summary = summaryOf(result.out)
  expect(summary.counts).toEqual({ rows: 3, create: 2, reject: 1, skip: 0, deferred: 0 })
  expect(summary.reasons).toEqual({ 'invalid-fields': 1 })
  expect(summary.planSha256).toMatch(/^[0-9a-f]{64}$/)
  expect(summary.notice).toBe(ERASED_NOTICE)
  expect(typeof summary.clusterBound).toBe('boolean')
  expect(summary.databaseIdentity).toMatch(/^[a-z0-9_]+:(\d+|unavailable)$/)
  expect(summary.clusterBound).toBe(!summary.databaseIdentity.endsWith(':unavailable'))
  expect(typeof summary.operatorSsoManaged).toBe('boolean')
  for (const needle of [suffix, 'Roster', '@terrace.invalid', 'Dry One']) { expect(result.out).not.toContain(needle); expect(result.err).not.toContain(needle) }
  expect(statSync(report).mode & 0o777).toBe(0o600)
  const written = JSON.parse(readFileSync(report, 'utf8'))
  expect(written.outcomes).toEqual([{ row: 2, outcome: 'create' }, { row: 3, outcome: 'create' }, { row: 4, outcome: 'reject', reason: 'invalid-fields' }])
  expect(readFileSync(report, 'utf8')).not.toContain(suffix)
  // The default command is a dry run, and a second report to the same path is refused rather than overwritten.
  expect(run(['--file', file, '--operator', String(admin.id), '--report', report]).code).toBe(1)
  expect(run(['--file', file, '--operator', String(admin.id), '--report', reportPath()]).code).toBe(0)
}, 60_000)

test('apply creates exactly the expected applications, invitations, outbox messages, mirror files and journal', async () => {
  const roster = parsed(person('Apply One'), person('Apply Two', 'current-member', ''))
  const result = await apply(roster)
  expect(result.counts).toMatchObject({ created: 2, failed: 0, reject: 0 })
  const rows = (await q(`SELECT a.id, a.name, a.affiliation, a.status, a.grant_role, a.reviewer_id, a.decided_at, a.note, i.id AS invitation_id, i.status AS invitation_status, i.role, i.token_hash, i.expires_at, i.member_id FROM member_applications a JOIN member_invitations i ON i.application_id = a.id WHERE a.contact_email LIKE $1 AND a.name LIKE 'Roster Apply%' ORDER BY a.id`, [`%${suffix}%`])).rows
  expect(rows).toHaveLength(2)
  expect(rows.map((row) => [row.affiliation, row.status, row.grant_role, row.invitation_status, row.role])).toEqual([['alumni', 'approved', 'alumni', 'pending', 'alumni'], ['current-member', 'approved', 'current-member', 'pending', 'current-member']])
  for (const row of rows) {
    expect(Number(row.reviewer_id)).toBe(Number(admin.id))
    expect(row.decided_at).toBeTruthy()
    expect(row.member_id).toBeNull()
    expect(row.note).toBeNull()
    // The invitation lifetime setting applies: seven days by default.
    expect(Math.abs(new Date(row.expires_at).getTime() - Date.now() - 7 * 86_400_000)).toBeLessThan(120_000)
    const outboxRow = (await q(`SELECT kind, status, invitation_id, mirrored_at, body FROM message_outbox WHERE invitation_id = $1`, [row.invitation_id])).rows
    expect(outboxRow).toHaveLength(1)
    expect(outboxRow[0]).toMatchObject({ kind: 'invitation', status: 'queued' })
    expect(outboxRow[0].mirrored_at).toBeTruthy()
    expect(outboxRow[0].body).not.toContain('/join/#') // the link is never stored in the database
  }
  // Exactly one mirror file per invitation, with a link whose token hashes to the stored hash.
  const links = mirror().map((entry) => JSON.parse(entry.text)).filter((message) => message.to?.includes(suffix))
  expect(links).toHaveLength(2)
  for (const message of links) {
    const token = /#([A-Za-z0-9_-]{43})/.exec(message.body)![1]
    expect(rows.map((row) => row.token_hash)).toContain(hashToken(token))
    expect(message.body).toContain('http://127.0.0.1:4194/join/#')
  }
  // Journal: the run, its operator and counts, and one item per row with a keyed hash and no content.
  const journal = (await q(`SELECT r.run_id, r.operator_id, r.status, r.plan_sha256, r.counts FROM roster_runs r WHERE r.run_id = $1`, [result.runId])).rows[0]
  const plan = await planFor(roster)
  expect(journal).toMatchObject({ status: 'completed', plan_sha256: (await q(`SELECT plan_sha256 FROM roster_runs WHERE run_id = $1`, [result.runId])).rows[0].plan_sha256 })
  expect(result.planSha256).toBe((await q(`SELECT plan_sha256 FROM roster_runs WHERE run_id = $1`, [result.runId])).rows[0].plan_sha256)
  const stored = (await q(`SELECT run_limit, reinvite_lapsed, database_identity, operator_label FROM roster_runs WHERE run_id = $1`, [result.runId])).rows[0]
  expect(stored).toMatchObject({ reinvite_lapsed: false, database_identity: plan.databaseIdentity, operator_label: String(admin.displayName) })
  expect(Number(stored.run_limit)).toBe(50)
  expect(Number(journal.operator_id)).toBe(Number(admin.id))
  const items = (await q(`SELECT row_number, state FROM roster_run_items i JOIN roster_runs r ON r.id = i.run_id WHERE r.run_id = $1 ORDER BY row_number`, [result.runId])).rows
  expect(items.map((item) => [Number(item.row_number), item.state])).toEqual([[2, 'applied'], [3, 'applied']])
  const journalText = JSON.stringify((await q(`SELECT x::text FROM roster_runs x`)).rows) + JSON.stringify((await q(`SELECT x::text FROM roster_run_items x`)).rows)
  expect(journalText).not.toContain(suffix)
})

test('re-running the same file is a no-op, and existing applications and live or redeemed invitations are skipped with a reason', async () => {
  const roster = parsed(person('Again One'), person('Again Two'))
  expect((await apply(roster)).counts.created).toBe(2)
  const before = await counts()
  const again = await apply(roster)
  expect(again.counts).toMatchObject({ created: 0, skip: 2, failed: 0 })
  expect(again.reasons).toEqual({ 'invitation-live': 2 })
  expect(await counts()).toEqual(before)
  // A pending application from the public form, and a denied one, are skipped as well.
  await q(`INSERT INTO member_applications (name, affiliation, contact_email, status, updated_at, created_at) VALUES ($1, 'alumni', $2, 'pending', now(), now()), ($3, 'alumni', $4, 'denied', now(), now())`, [`Roster Pending ${suffix}`, email('Pending'), `Roster Denied ${suffix}`, email('Denied')])
  const second = await planFor(parsed(person('Pending'), person('Denied')))
  expect(second.outcomes).toEqual([{ row: 2, outcome: 'skip', reason: 'application-pending' }, { row: 3, outcome: 'skip', reason: 'previously-denied' }])
  // A redeemed invitation counts, and so does an approved application, whatever the invitation says.
  const one = parsed(person('Redeemed One'))
  await apply(one)
  await q(`UPDATE member_invitations SET status = 'redeemed', redeemed_at = now() WHERE application_id IN (SELECT id FROM member_applications WHERE contact_email = $1)`, [email('Redeemed One')])
  expect((await planFor(one)).outcomes).toEqual([{ row: 2, outcome: 'skip', reason: 'invitation-redeemed' }])
  await q(`UPDATE member_invitations SET status = 'expired' WHERE application_id IN (SELECT id FROM member_applications WHERE contact_email = $1)`, [email('Redeemed One')])
  await q(`UPDATE member_applications SET status = 'withdrawn' WHERE contact_email = $1`, [email('Redeemed One')])
  expect((await planFor(one)).outcomes).toEqual([{ row: 2, outcome: 'skip', reason: 'application-withdrawn' }]) // lapsed history is not re-invited by default
  expect((await planFor(one, undefined, { reinviteLapsed: true })).outcomes).toEqual([{ row: 2, outcome: 'create' }])
})

test('the limit bounds a run and is never above the hard maximum', async () => {
  const roster = parsed(person('Limit One'), person('Limit Two'), person('Limit Three'))
  const first = await apply(roster, 1)
  expect(first.counts).toMatchObject({ created: 1, deferred: 2 })
  const second = await apply(roster, 5)
  expect(second.counts).toMatchObject({ created: 2, skip: 1, deferred: 0 })
  expect(ROSTER_HARD_MAX).toBeLessThanOrEqual(MAX_PENDING)
  const plan = await planFor(parsed(person('Limit Four')), 100000)
  expect(plan.counts.create).toBe(1)
  for (const bad of ['0', '-1', 'x', '10000']) expect(() => parseArgs(['apply', '--file', '/a.csv', '--operator', '1', '--plan-sha256', 'a'.repeat(64), '--limit', bad])).toThrow(RosterError)
  expect(parseArgs(['apply', '--file', '/a.csv', '--operator', '1', '--plan-sha256', 'a'.repeat(64), '--limit', '5']).values['--limit']).toBe('5')
})

test('apply refuses a different file, missing delivery configuration and a non-administrator operator, creating nothing', async () => {
  const roster = parsed(person('Guard One'))
  const before = await counts()
  await expect(applyRoster(payload, roster, { operator: operatorOf(admin), operatorId: Number(admin.id), planSha256: 'a'.repeat(64) })).rejects.toThrow('plan-mismatch')
  const directory = process.env.LIFECYCLE_OUTBOX_DIR, origin = process.env.LIFECYCLE_PUBLIC_ORIGIN
  try {
    delete process.env.LIFECYCLE_OUTBOX_DIR
    await expect(apply(roster)).rejects.toThrow(/LIFECYCLE_OUTBOX_DIR/)
    process.env.LIFECYCLE_OUTBOX_DIR = directory
    process.env.LIFECYCLE_PUBLIC_ORIGIN = 'http://not-public.invalid/path'
    await expect(apply(roster)).rejects.toThrow(/LIFECYCLE_PUBLIC_ORIGIN/)
  } finally { process.env.LIFECYCLE_OUTBOX_DIR = directory; process.env.LIFECYCLE_PUBLIC_ORIGIN = origin }
  expect(await counts()).toEqual(before)
  await expect(resolveOperator(payload, String(editor.id))).rejects.toThrow('operator-not-administrator')
  await expect(resolveOperator(payload, editor.email)).rejects.toThrow('operator-not-administrator')
  await expect(resolveOperator(payload, 'nobody@terrace.invalid')).rejects.toThrow('operator-not-found')
  await expect(resolveOperator(payload, '999999999')).rejects.toThrow('operator-not-found')
  expect((await resolveOperator(payload, String(admin.id))).id).toBe(Number(admin.id))
  expect(await resolveOperator(payload, admin.email.toUpperCase())).toEqual({ id: Number(admin.id), label: String(admin.displayName), sso: false })
})

test('the production guard needs the production configuration and an explicit confirmation', () => {
  const production = productionEnv()
  // Local database, no public deployment: no confirmation needed.
  expect(productionGuard({ DATABASE_URI: 'postgresql:///terrace_cms?host=/tmp/socket&port=55432' }, false)).toEqual({ production: false })
  // Public deployment: valid configuration and the flag, even though the database is a local socket.
  expect(() => productionGuard(production, false)).toThrow('confirm-production-required')
  expect(productionGuard(production, true)).toEqual({ production: true })
  expect(() => productionGuard({ ...production, LIFECYCLE_PUBLIC_ORIGIN: undefined, CMS_ORIGIN: 'http://127.0.0.1:3010' }, true)).toThrow('production-configuration-invalid')
  expect(() => productionGuard({ ...production, CMS_LOCAL_BOOTSTRAP: '1' }, true)).toThrow('production-configuration-invalid')
  // A remote database without the public-deployment profile is an inconsistent configuration, flag or not.
  expect(() => productionGuard({ DATABASE_URI: 'postgresql://db.example.invalid/terrace_cms', CMS_LOCAL_BOOTSTRAP: '1' }, true)).toThrow('production-configuration-missing')
  expect(() => productionGuard({ ...production, DATABASE_URI: 'postgresql://db.example.invalid/terrace_cms' }, false)).toThrow('confirm-production-required')
  expect(productionGuard({ ...production, DATABASE_URI: 'postgresql://db.example.invalid/terrace_cms' }, true)).toEqual({ production: true })
  // The same refusals through the command line, before any database is opened.
  const file = csvFile(csv(person('Cli Guard')))
  const args = ['apply', '--file', file, '--operator', '1', '--plan-sha256', 'a'.repeat(64)]
  const remote = { DATABASE_URI: 'postgresql://db.example.invalid/terrace_cms' }
  const refused = run(args, { ...remote, CMS_PUBLIC_DEPLOYMENT: undefined })
  expect(refused.code).toBe(1)
  expect(refused.err).toContain('CMS_PUBLIC_DEPLOYMENT')
  const unconfirmed = run(args, { ...production as Record<string, string>, ...remote, CMS_LOCAL_BOOTSTRAP: undefined, CMS_BOOTSTRAP_EMAIL: undefined, CMS_BOOTSTRAP_PASSWORD: undefined })
  expect(unconfirmed.code).toBe(1)
  expect(unconfirmed.err).toContain('--confirm-production')
  const wrongPlan = run(['apply', '--file', file, '--operator', String(admin.id), '--plan-sha256', 'b'.repeat(64), '--confirm-production'], writer())
  expect(wrongPlan.code).toBe(1)
  expect(wrongPlan.err).toContain('plan hash')
  for (const output of [refused, unconfirmed, wrongPlan]) { expect(output.out).not.toContain('{'); expect(output.err).not.toContain(suffix); expect(output.err).not.toContain('db.example.invalid') }
}, 60_000)

test('the command line applies a reviewed dry run end to end, prints no personal data and rolls back', async () => {
  const file = csvFile(csv(person('Cli One'), person('Cli Two', 'current-member', '')))
  const unconfirmed = run(['apply', '--file', file, '--operator', String(admin.id), '--plan-sha256', 'a'.repeat(64)], writer())
  expect(unconfirmed.code).toBe(1)
  expect(unconfirmed.err).toContain('--confirm-production')
  const dry = summaryOf(run(['dry-run', '--file', file, '--operator', String(admin.id), '--report', reportPath()]).out)
  const missing = run(['apply', '--file', file, '--operator', String(admin.id)])
  expect(missing.code).toBe(1)
  expect(missing.err).toContain('Usage')
  const notAdmin = run(['apply', '--file', file, '--operator', String(editor.id), '--plan-sha256', dry.planSha256, '--confirm-production'], writer())
  expect(notAdmin.code).toBe(1)
  expect(notAdmin.err).toContain('administrator')
  const baseline = (await counts()).applications
  expect(baseline).toBeGreaterThanOrEqual(0)
  const applied = run(['apply', '--file', file, '--operator', admin.email, '--plan-sha256', dry.planSha256, '--report', reportPath(), '--confirm-production'], writer())
  expect(applied.code).toBe(0)
  const summary = summaryOf(applied.out)
  expect(summary.counts).toMatchObject({ created: 2, failed: 0 })
  expect((await counts()).applications).toBe(baseline + 2)
  for (const needle of [suffix, 'Roster', '@terrace.invalid', 'join/#']) { expect(applied.out).not.toContain(needle); expect(applied.err).not.toContain(needle) }
  // The old hash no longer matches (the set to create changed), so a repeat is refused and changes nothing; a fresh dry run shows nothing to do.
  const stale = run(['apply', '--file', file, '--operator', admin.email, '--plan-sha256', dry.planSha256, '--confirm-production'], writer())
  expect(stale.code).toBe(1)
  expect(stale.err).toContain('Re-run the dry run')
  const again = summaryOf(run(['dry-run', '--file', file, '--operator', String(admin.id), '--report', reportPath()]).out)
  expect(again.counts).toMatchObject({ create: 0, skip: 2 })
  const noop = run(['apply', '--file', file, '--operator', admin.email, '--plan-sha256', again.planSha256, '--confirm-production'], writer())
  expect(summaryOf(noop.out).counts).toMatchObject({ created: 0, skip: 2 })
  expect((await counts()).applications).toBe(baseline + 2)
  const back = run(['rollback', '--run', summary.runId, '--operator', String(admin.id), '--confirm-production'], writer())
  expect(back.code).toBe(0)
  expect(summaryOf(back.out)).toMatchObject({ ok: true, revoked: 2, withdrawn: 2, operatorSsoManaged: false })
  expect(summary.databaseIdentity).toBeTruthy()
  expect(back.out + back.err).not.toContain(suffix)
  // A file that is readable by others, or a bad file, fails with fixed text that never quotes it.
  const loose = run(['dry-run', '--file', csvFile(csv(person('Loose')), 0o644), '--operator', String(admin.id), '--report', reportPath()])
  expect(loose.code).toBe(1)
  expect(loose.err).toContain('owner-only')
  expect(loose.err + loose.out).not.toContain(privateDirectory)
  const broken = run(['dry-run', '--file', csvFile('name,affiliation\n'), '--operator', String(admin.id), '--report', reportPath()])
  expect(broken.code).toBe(1)
  expect(broken.err).toContain('header')
}, 60_000)

test('rollback revokes and withdraws an untouched run, refuses once anything was redeemed or linked, and is repeatable', async () => {
  const roster = parsed(person('Roll One'), person('Roll Two'))
  const result = await apply(roster)
  const rollback = await rollbackRoster(payload, result.runId!, operatorOf(admin))
  expect(rollback).toMatchObject({ ok: true, items: 2, revoked: 2, withdrawn: 2 })
  const states = (await q(`SELECT a.status AS application, i.status AS invitation FROM member_applications a JOIN member_invitations i ON i.application_id = a.id WHERE a.contact_email LIKE $1 AND a.name LIKE 'Roster Roll%'`, [`%${suffix}%`])).rows
  expect(states).toEqual([{ application: 'withdrawn', invitation: 'revoked' }, { application: 'withdrawn', invitation: 'revoked' }])
  expect((await q(`SELECT status FROM roster_runs WHERE run_id = $1`, [result.runId])).rows[0].status).toBe('rolled-back')
  expect(await rollbackRoster(payload, result.runId!, operatorOf(admin))).toMatchObject({ ok: true, revoked: 0, withdrawn: 0 })
  await expect(rollbackRoster(payload, 'roster-unknown', operatorOf(admin))).rejects.toThrow('run-not-found')
  // After a rollback the same file can be invited again (a new run).
  expect((await apply(roster)).counts.created).toBe(0) // withdrawn and revoked: not re-invited unless asked
  expect((await apply(roster, undefined, { reinviteLapsed: true })).counts.created).toBe(2)

})

test('rollback refuses when any invitation was redeemed or any record linked, changing nothing', async () => {
  const kept = await apply(parsed(person('Keep One'), person('Keep Two'), person('Keep Three')))
  const rows = (await q(`SELECT a.id AS application_id, i.id AS invitation_id FROM member_applications a JOIN member_invitations i ON i.application_id = a.id WHERE a.contact_email LIKE $1 AND a.name LIKE 'Roster Keep%' ORDER BY a.id`, [`%${suffix}%`])).rows
  await q(`UPDATE member_invitations SET status = 'redeemed', redeemed_at = now() WHERE id = $1`, [rows[0].invitation_id])
  const member = await payload.create({ collection: 'members', overrideAccess: true, data: { identityKey: `${suffix}-keep`, issuer: settings.issuer, subject: `${suffix}-keep`, displayName: 'Keeper', roles: ['alumni'] } })
  members.push(member.id)
  await q(`UPDATE member_applications SET member_id = $1 WHERE id = $2`, [member.id, rows[1].application_id])
  const refused = await rollbackRoster(payload, kept.runId!, operatorOf(admin))
  expect(refused).toEqual({ ok: false, runId: kept.runId, status: 'completed', items: 3, revoked: 0, withdrawn: 0, filesRedacted: 0, filesPending: false, refused: { redeemed: 1, linked: 1 } })
  const states = (await q(`SELECT a.status AS application, i.status AS invitation FROM member_applications a JOIN member_invitations i ON i.application_id = a.id WHERE a.id = ANY($1) ORDER BY a.id`, [rows.map((row) => row.application_id)])).rows
  expect(states).toEqual([{ application: 'approved', invitation: 'redeemed' }, { application: 'approved', invitation: 'pending' }, { application: 'approved', invitation: 'pending' }])
  expect((await q(`SELECT status FROM roster_runs WHERE run_id = $1`, [kept.runId])).rows[0].status).toBe('completed')
})

test('the staff notice and the signal when a run would exceed the pending cap', async () => {
  const fill = MAX_PENDING
  await q(`INSERT INTO member_applications (name, affiliation, contact_email, status, updated_at, created_at) SELECT 'Cap ' || g, 'alumni', 'filler-' || g || '@terrace.invalid', 'pending', now(), now() FROM generate_series(1, $1) g`, [fill])
  try {
    const roster = parsed(person('Cap One'))
    const plan = await planFor(roster)
    expect(plan.exceedsPendingCap).toBe(true)
    expect((await apply(roster)).exceedsPendingCap).toBe(true)
    expect((await q(`SELECT count(*)::int AS n FROM message_outbox WHERE kind = 'staff-notice' AND dedupe_key LIKE 'staff-notice:roster:%'`)).rows[0].n).toBe(1)
  } finally { await q(`DELETE FROM member_applications WHERE contact_email LIKE 'filler-%@terrace.invalid'`) }
  expect((await planFor(parsed(person('Cap Two')))).exceedsPendingCap).toBe(false)
})

test('a roster-created application links at first sign-in by verified email, and erasure scrubs it and its journal hash', async () => {
  const name = `Roster Linda Marsh ${suffix}`
  const address = email('linda-marsh')
  const roster = parseRoster(Buffer.from(csv(`${name},alumni,1990,${address}`)))
  const result = await apply(roster)
  expect(result.counts.created).toBe(1)
  const application = (await q(`SELECT id FROM member_applications WHERE contact_email = $1`, [address])).rows[0].id
  const invitation = (await q(`SELECT id FROM member_invitations WHERE application_id = $1`, [application])).rows[0].id
  const token = /#([A-Za-z0-9_-]{43})/.exec(JSON.parse(mirror().map((entry) => entry.text).find((text) => text.includes(address))!).body)![1]
  // Redeem the link, then sign in as the realm user an operator provisioned for that address.
  expect((await intake.redeem(request(null, { token, consume: true }, { 'x-terrace-intake': secret }))).status).toBe(200)
  const unverified = await signIn(`sub-linda-a-${suffix}`, { email: address, email_verified: false })
  expect((await q(`SELECT member_id FROM member_applications WHERE id = $1`, [application])).rows[0].member_id).toBeNull() // an unverified address binds nothing
  void unverified
  const member = await signIn(`sub-linda-${suffix}`, { name, email: address, email_verified: true })
  expect((await q(`SELECT member_id FROM member_applications WHERE id = $1`, [application])).rows[0].member_id).toBe(member.id)
  expect((await q(`SELECT member_id FROM member_invitations WHERE id = $1`, [invitation])).rows[0].member_id).toBe(member.id)
  // Rolling back is now refused: the run's records are linked to a member.
  expect((await rollbackRoster(payload, result.runId!, operatorOf(admin))).refused).toEqual({ redeemed: 1, linked: 2 })

  const needles = [`Linda Marsh ${suffix}`, `linda-marsh-${suffix}`]
  expect((await everyTable(needles)).length).toBeGreaterThan(2)
  const code = ((await (await own.erasure(request(member, { step: 'request' }))).json()) as any).confirmationCode
  expect((await own.erasure(request(member, { step: 'confirm', token: code }))).status).toBe(200)
  await sweep(payload)
  expect(await everyTable(needles)).toEqual([])
  for (const entry of mirror()) expect(entry.text).not.toMatch(new RegExp(`linda-marsh-${suffix}|Linda Marsh`, 'i'))
  expect((await q(`SELECT state FROM roster_run_items WHERE application_id = $1`, [application])).rows[0]).toEqual({ state: 'applied' })
  expect((await q(`SELECT name, contact_email, status FROM member_applications WHERE id = $1`, [application])).rows[0]).toEqual({ name: 'Erased applicant', contact_email: 'erased@terrace.invalid', status: 'withdrawn' })
  expect((await q(`SELECT status FROM member_invitations WHERE id = $1`, [invitation])).rows[0].status).toBe('redeemed')
})

test('the roster file is read only from a private location outside Git, never from anywhere else', () => {
  const good = csvFile(csv(person('Private')))
  expect(readPrivateInput(good, '.csv', 1 << 20).length).toBeGreaterThan(10)
  const refuse = (path: string) => expect(() => readPrivateInput(path, '.csv', 1 << 20)).toThrow(OutputRefused)
  refuse(csvFile(csv(person('Loose')), 0o640)) // group-readable
  refuse(csvFile(csv(person('Loose')), 0o604)) // world-readable
  refuse(good.replace(/^\//, '')) // relative
  refuse(good.replace(/\.csv$/, '.txt')) // wrong suffix
  refuse(join(privateDirectory, 'missing.csv'))
  const link = join(privateDirectory, `link-${sequence++}.csv`)
  symlinkSync(good, link)
  refuse(link)
  const open = mkdtempSync(join(tmpdir(), 'terrace-roster-open-'))
  try {
    chmodSync(open, 0o755)
    writeFileSync(join(open, 'roster.csv'), csv(person('Open')), { mode: 0o600 })
    refuse(join(open, 'roster.csv')) // directory not owner-only
    chmodSync(open, 0o700)
    mkdirSync(join(open, '.git'))
    refuse(join(open, 'roster.csv')) // inside a Git checkout
  } finally { rmSync(open, { recursive: true, force: true }) }
  expect(() => readPrivateInput(good, '.csv', 5)).toThrow(OutputRefused) // over the size bound
})

// ---- the plan hash binds an apply to what was reviewed -------------------------------------------------------------------

test('the plan hash binds file, limit, operator, reinvite flag, database and the exact set of rows to create', async () => {
  const roster = parsed(person('Bind One'), person('Bind Two'), person('Bind Three'))
  const other = await makeUser('admin')
  const base = await planFor(roster)
  expect(base.planSha256).toBe((await planFor(roster)).planSha256) // stable
  expect(base.databaseIdentity).toMatch(/^[a-z0-9_]+:(\d+|unavailable)$/)
  expect((await planFor(roster, 2)).planSha256).not.toBe(base.planSha256) // limit
  expect((await planFor(roster, undefined, { operator: operatorOf(other) })).planSha256).not.toBe(base.planSha256) // operator
  expect((await planFor(roster, undefined, { reinviteLapsed: true })).planSha256).not.toBe(base.planSha256) // flag
  expect((await planFor(parsed(person('Bind One'), person('Bind Two'), person('Bind Four')))).planSha256).not.toBe(base.planSha256) // file
  const parts = { fileSha256: roster.fileSha256, limit: 50, operatorId: 1, reinviteLapsed: false, databaseIdentity: 'terrace_cms:1', create: [2, 3] }
  expect(boundPlanHash({ ...parts, databaseIdentity: 'terrace_cms:2' })).not.toBe(boundPlanHash(parts)) // a staging copy cannot unlock production
  expect(boundPlanHash({ ...parts, databaseIdentity: 'other:1' })).not.toBe(boundPlanHash(parts))
  expect(boundPlanHash({ ...parts, create: [3, 2] })).toBe(boundPlanHash(parts)) // the set is sorted
  expect(boundPlanHash({ ...parts, create: [2] })).not.toBe(boundPlanHash(parts))
  // Each mismatch is refused by apply, with nothing created.
  const before = await counts()
  const give = (planSha256: string, over: Record<string, unknown> = {}) => applyRoster(payload, roster, { operator: operatorOf(admin), operatorId: Number(admin.id), planSha256, ...over })
  await expect(give(base.planSha256, { limit: 2 })).rejects.toThrow('plan-mismatch')
  await expect(give(base.planSha256, { reinviteLapsed: true })).rejects.toThrow('plan-mismatch')
  await expect(give(base.planSha256, { operator: operatorOf(other), operatorId: Number(other.id) })).rejects.toThrow('plan-mismatch')
  expect(await counts()).toEqual(before)
  // The database changed after the dry run: a row became a duplicate. Apply refuses instead of quietly creating a different set.
  await q(`INSERT INTO member_applications (name, affiliation, contact_email, status, updated_at, created_at) VALUES ($1, 'alumni', $2, 'pending', now(), now())`, [`Roster Bind Two ${suffix}`, email('Bind Two')])
  const after = await counts()
  await expect(give(base.planSha256)).rejects.toThrow('plan-mismatch')
  expect(await counts()).toEqual({ ...after })
  // A fresh dry run shows the changed set, and applying it creates exactly that set.
  const fresh = await planFor(roster)
  expect(fresh.outcomes.map((outcome) => outcome.outcome)).toEqual(['create', 'skip', 'create'])
  expect((await give(fresh.planSha256)).counts.created).toBe(2)
})

test('the journal keeps the operator by name when the account is deleted, and records who rolled a run back', async () => {
  const temporary = await makeUser('admin')
  const result = await apply(parsed(person('Journal One')), undefined, { operator: operatorOf(temporary) })
  await payload.delete({ collection: 'users', id: temporary.id, overrideAccess: true })
  const row = (await q(`SELECT operator_id, operator_label FROM roster_runs WHERE run_id = $1`, [result.runId])).rows[0]
  expect(row).toEqual({ operator_id: null, operator_label: String(temporary.displayName) })
  const rolled = await rollbackRoster(payload, result.runId!, operatorOf(admin))
  expect(rolled.ok).toBe(true)
  expect((await q(`SELECT rolled_back_by_id, rolled_back_by_label, rolled_back_at FROM roster_runs WHERE run_id = $1`, [result.runId])).rows[0]).toMatchObject({ rolled_back_by_id: Number(admin.id), rolled_back_by_label: String(admin.displayName) })
  expect((await q(`SELECT rolled_back_at FROM roster_runs WHERE run_id = $1`, [result.runId])).rows[0].rolled_back_at).toBeTruthy()
})

// ---- files: written after commit, removed only when they are this run's ---------------------------------------------------

test('a row that fails before commit leaves no file and no rows, and never touches another writer\'s files', async () => {
  const foreign = join(outbox, '999999-invitation.json')
  const foreignTemporary = join(outbox, '999998-invitation.json.abcdef012345.tmp')
  const roster = parsed(person('Fail One'), person('Fail Two'))
  const before = await counts()
  const filesBefore = readdirSync(outbox).sort()
  const result = await apply(roster, undefined, { seams: { beforeCommit: async () => { writeFileSync(foreign, '{"concurrent":"ui approval"}', { mode: 0o600 }); writeFileSync(foreignTemporary, 'in flight', { mode: 0o600 }); throw new Error('injected') } } })
  expect(result.counts).toMatchObject({ created: 0, failed: 1, mirrorFailed: 0 })
  const after = await counts()
  expect(after.applications).toBe(before.applications)
  expect(after.invitations).toBe(before.invitations)
  expect(after.outbox).toBe(before.outbox)
  // Only the other writer's two files are new; the roster wrote nothing, and removed nothing that was not its own.
  expect(readdirSync(outbox).sort()).toEqual([...filesBefore, '999998-invitation.json.abcdef012345.tmp', '999999-invitation.json'].sort())
  expect(readFileSync(foreign, 'utf8')).toContain('concurrent')
  expect(readFileSync(foreignTemporary, 'utf8')).toBe('in flight')
  expect((await q(`SELECT status FROM roster_runs WHERE run_id = $1`, [result.runId])).rows[0].status).toBe('failed')
  expect((await q(`SELECT count(*)::int AS n FROM roster_run_items i JOIN roster_runs r ON r.id = i.run_id WHERE r.run_id = $1`, [result.runId])).rows[0].n).toBe(0)
  rmSync(foreign); rmSync(foreignTemporary)
  // A failed run does not block the next one, and the same rows can be applied.
  expect((await apply(roster)).counts.created).toBe(2)
})

test('a mirror write that fails after commit stops the run, is journaled, and a failed run can be rolled back', async () => {
  const roster = parsed(person('Mirror One'), person('Mirror Two'), person('Mirror Three'))
  const result = await apply(roster, undefined, { seams: { beforeMirror: (row: number) => { if (row === 3) throw new Error('disk full') } } })
  expect(result.counts).toMatchObject({ created: 2, failed: 1, mirrorFailed: 1 })
  const run = (await q(`SELECT id, status FROM roster_runs WHERE run_id = $1`, [result.runId])).rows[0]
  expect(run.status).toBe('failed')
  // Two rows are fully done; the second has its row and invitation but no file (reported undeliverable by the sweep); the third was not attempted.
  expect((await q(`SELECT count(*)::int AS n FROM roster_run_items WHERE run_id = $1`, [run.id])).rows[0].n).toBe(2)
  expect(mirror().filter((entry) => entry.text.includes(email('Mirror'))).length).toBe(0)
  const mine = mirror().map((entry) => JSON.parse(entry.text)).filter((message) => /mirror-(one|two|three)/.test(message.to ?? ''))
  expect(mine.map((message) => message.to)).toEqual([email('Mirror One')])
  expect((await q(`SELECT count(*)::int AS n FROM member_applications WHERE contact_email = $1`, [email('Mirror Three')])).rows[0].n).toBe(0)
  const rolled = await rollbackRoster(payload, result.runId!, operatorOf(admin))
  expect(rolled).toMatchObject({ ok: true, items: 2, revoked: 2, withdrawn: 2 })
})

test('rollback redacts the run\'s own link files; repeating it repeats only the redaction', async () => {
  const roster = parsed(person('Redact One'), person('Redact Two'))
  const result = await apply(roster)
  const link = () => mirror().filter((entry) => entry.text.includes('redact-') || entry.text.includes('Former member'))
  expect(mirror().filter((entry) => entry.text.includes(email('Redact One'))).length).toBe(1)
  const rolled = await rollbackRoster(payload, result.runId!, operatorOf(admin))
  expect(rolled).toMatchObject({ ok: true, filesRedacted: 2, filesPending: false })
  expect(mirror().filter((entry) => entry.text.includes(email('Redact One')) || entry.text.includes(email('Redact Two')) || entry.text.includes(`Roster Redact`))).toEqual([])
  expect(link().length).toBeGreaterThanOrEqual(2)
  expect(mirror().filter((entry) => /Redacted after erasure|Former member/.test(entry.text)).length).toBeGreaterThanOrEqual(2)
  expect(await rollbackRoster(payload, result.runId!, operatorOf(admin))).toMatchObject({ ok: true, revoked: 0, withdrawn: 0, filesRedacted: 0 })
})

// ---- re-running: what is skipped and what is not ---------------------------------------------------------------------------

test('lapsed history is skipped by default, re-invited only with the flag; live, redeemed, approved and pending never are; erased people cannot be recognised', async () => {
  const names = ['Hist Denied', 'Hist Withdrawn', 'Hist Expired', 'Hist Revoked', 'Hist Approved', 'Hist Pending', 'Hist Live', 'Hist Redeemed', 'Hist Fresh']
  const insert = (name: string, status: string) => q(`INSERT INTO member_applications (name, affiliation, contact_email, status, grant_role, updated_at, created_at) VALUES ($1, 'alumni', $2, $3, 'alumni', now(), now()) RETURNING id`, [`Roster ${name} ${suffix}`, email(name), status]).then((result) => Number(result.rows[0].id))
  const invite = (id: number, status: string, past = false) => q(`INSERT INTO member_invitations (application_id, token_hash, role, status, expires_at, updated_at, created_at) VALUES ($1, $2, 'alumni', $3, now() + ($4)::interval, now(), now())`, [id, `hash-${suffix}-${id}`, status, past ? '-1 day' : '1 day'])
  await insert('Hist Denied', 'denied')
  await insert('Hist Withdrawn', 'withdrawn')
  await invite(await insert('Hist Expired', 'approved'), 'pending', true) // past its lifetime, not yet swept
  await invite(await insert('Hist Revoked', 'approved'), 'revoked')
  await insert('Hist Approved', 'approved') // approved, no invitation on record
  await insert('Hist Pending', 'pending')
  await invite(await insert('Hist Live', 'approved'), 'pending')
  await invite(await insert('Hist Redeemed', 'approved'), 'redeemed')
  const roster = parsed(...names.map((name) => person(name)))
  const plan = await planFor(roster)
  expect(plan.outcomes.map((outcome) => outcome.reason ?? outcome.outcome)).toEqual(['previously-denied', 'application-withdrawn', 'invitation-expired', 'invitation-revoked', 'application-approved', 'application-pending', 'invitation-live', 'invitation-redeemed', 'create'])
  const flagged = await planFor(roster, undefined, { reinviteLapsed: true })
  expect(flagged.outcomes.map((outcome) => outcome.reason ?? outcome.outcome)).toEqual(['create', 'create', 'create', 'create', 'application-approved', 'application-pending', 'invitation-live', 'invitation-redeemed', 'create'])
  expect(flagged.planSha256).not.toBe(plan.planSha256)
  expect((await apply(roster)).counts.created).toBe(1) // default: only the person never seen before
  expect((await apply(roster, undefined, { reinviteLapsed: true })).counts.created).toBe(4)
  expect((await apply(roster, undefined, { reinviteLapsed: true })).counts.created).toBe(0) // and now everyone has a live invitation
  // Erasure keeps no identifier, so an erased person's address matches nothing: the tool would invite them again. That is why the notice exists.
  const erased = person('Hist Erased')
  const target = await apply(parsed(erased))
  await q(`UPDATE member_applications SET name = 'Erased applicant', contact_email = 'erased@terrace.invalid', status = 'withdrawn' WHERE contact_email = $1`, [email('Hist Erased')])
  expect((await planFor(parsed(erased), undefined, { reinviteLapsed: true })).outcomes).toEqual([{ row: 2, outcome: 'create' }])
  expect((await planFor(parsed(erased))).outcomes).toEqual([{ row: 2, outcome: 'create' }])
  expect(target.counts.created).toBe(1)
  expect(ERASED_NOTICE).toContain('cannot recognise people who asked to be erased')
  const output = run(['dry-run', '--file', csvFile(csv(erased)), '--operator', String(admin.id), '--report', reportPath()])
  expect(summaryOf(output.out).notice).toBe(ERASED_NOTICE)
  expect(parseArgs(['dry-run', '--file', '/a.csv', '--operator', '1', '--report', '/r.json', '--reinvite-lapsed']).reinviteLapsed).toBe(true)
  expect(() => parseArgs(['rollback', '--run', 'x', '--operator', '1', '--reinvite-lapsed'])).toThrow(RosterError)
}, 60_000)

// ---- crashed runs ------------------------------------------------------------------------------------------------------------

test('a crashed run goes stale and is marked failed, a fresh running run blocks, and a failed run can be rolled back', async () => {
  const roster = parsed(person('Stale One'))
  const done = await apply(parsed(person('Stale Seed')))
  const seed = (await q(`SELECT id FROM roster_runs WHERE run_id = $1`, [done.runId])).rows[0].id
  // A fresh running run (another process is working): neither an apply nor a rollback goes ahead.
  await q(`UPDATE roster_runs SET status = 'running', finished_at = NULL, updated_at = now() WHERE id = $1`, [seed])
  const before = await counts()
  await expect(apply(roster)).rejects.toThrow('run-in-progress')
  await expect(rollbackRoster(payload, done.runId!, operatorOf(admin))).rejects.toThrow('run-in-progress')
  expect(await counts()).toEqual(before)
  // The same run, silent for longer than the threshold, is taken to have crashed.
  await q(`UPDATE roster_runs SET updated_at = now() - interval '2 hours' WHERE id = $1`, [seed])
  expect(await failStaleRuns(payload)).toBe(1)
  expect((await q(`SELECT status FROM roster_runs WHERE id = $1`, [seed])).rows[0].status).toBe('failed')
  expect((await apply(roster)).counts.created).toBe(1)
  expect(await rollbackRoster(payload, done.runId!, operatorOf(admin))).toMatchObject({ ok: true, revoked: 1, withdrawn: 1 })
  // Rolling back a stale running run marks it failed first, then undoes it.
  const again = await apply(parsed(person('Stale Two')))
  await q(`UPDATE roster_runs SET status = 'running', updated_at = now() - interval '2 hours' WHERE run_id = $1`, [again.runId])
  expect(await rollbackRoster(payload, again.runId!, operatorOf(admin))).toMatchObject({ ok: true, revoked: 1 })
})

// ---- the report ----------------------------------------------------------------------------------------------------------------

test('a bad report path is refused before any work, and a report that cannot be written afterwards never hides the run', async () => {
  const file = csvFile(csv(person('Report One')))
  const dry = summaryOf(run(['dry-run', '--file', file, '--operator', String(admin.id), '--report', reportPath()]).out)
  const taken = reportPath()
  writeFileSync(taken, '{}', { mode: 0o600 })
  const before = await counts()
  const refused = run(['apply', '--file', file, '--operator', admin.email, '--plan-sha256', dry.planSha256, '--report', taken, '--confirm-production'], writer())
  expect(refused.code).toBe(1)
  expect(refused.err).toContain('already exists')
  expect(await counts()).toEqual(before) // nothing was applied
  expect(run(['apply', '--file', file, '--operator', admin.email, '--plan-sha256', dry.planSha256, '--report', 'relative.json', '--confirm-production'], writer()).code).toBe(1)
  expect(await counts()).toEqual(before)
  // The summary comes first and carries the run id even when the report then fails.
  const lines: string[] = [], errors: string[] = []
  const log = console.log, error = console.error
  console.log = (...args: unknown[]) => { lines.push(args.join(' ')) }
  console.error = (...args: unknown[]) => { errors.push(args.join(' ')) }
  let code: number
  try { code = emitResult({ mode: 'apply', runId: 'roster-abc', counts: { created: 1 } }, { x: 1 }, taken) } finally { console.log = log; console.error = error }
  expect(code).toBe(1)
  expect(JSON.parse(lines[0])).toMatchObject({ runId: 'roster-abc', counts: { created: 1 } })
  expect(errors.join('\n')).toContain('already done')
  expect(errors.join('\n')).not.toContain(privateDirectory)
}, 60_000)

// ---- the per-address lock shared with the apply form ----------------------------------------------------------------------------

test('the public form and the roster tool queue on one lock per address, so neither interleaves with the other\'s check and create', async () => {
  const address = email('Lock One')
  const holder = await (payload.db as any).pool.connect()
  const settled = (promise: Promise<unknown>) => Promise.race([promise.then(() => 'done', () => 'done'), new Promise((resolve) => setTimeout(() => resolve('waiting'), 400))])
  try {
    await holder.query('BEGIN')
    await holder.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`terrace-application-email:${address}`])
    const form = intake.apply(request(null, { name: `Roster Lock Form ${suffix}`, affiliation: 'alumni', contactEmail: address }, { 'x-terrace-intake': secret })) as Promise<Response>
    expect(await settled(form)).toBe('waiting') // the form waits for the holder
    const roster = parsed(person('Lock One'))
    const planned = await planFor(roster)
    const rowApply = applyRoster(payload, roster, { operator: operatorOf(admin), operatorId: Number(admin.id), planSha256: planned.planSha256 })
    expect(await settled(rowApply)).toBe('waiting') // and so does the roster row
    await holder.query('COMMIT')
    expect((await form).status).toBe(202)
    // Whichever ran second saw the first: exactly one of the two outcomes, not two applications for the address in the same state.
    const result = await rowApply
    const rows = (await q(`SELECT status FROM member_applications WHERE lower(contact_email) = $1 ORDER BY id`, [address])).rows.map((row) => row.status)
    expect(rows).toEqual(['pending'])
    expect(result.counts).toMatchObject({ created: 0, skip: 1 }) // the form's pending application was seen under the lock
  } finally { await holder.query('ROLLBACK').catch(() => undefined); holder.release() }
})

// ---- second review ---------------------------------------------------------------------------------------------------------------

test('an address already linked to a member is never invited again, even with the flag', async () => {
  const insert = (name: string, status: string) => q(`INSERT INTO member_applications (name, affiliation, contact_email, status, grant_role, updated_at, created_at) VALUES ($1, 'alumni', $2, $3, 'alumni', now(), now()) RETURNING id`, [`Roster ${name} ${suffix}`, email(name), status]).then((result) => Number(result.rows[0].id))
  const invite = (id: number, status: string, memberId: number | null) => q(`INSERT INTO member_invitations (application_id, token_hash, role, status, expires_at, member_id, updated_at, created_at) VALUES ($1, $2, 'alumni', $3, now() - interval '1 day', $4, now(), now())`, [id, `hash-${suffix}-linked-${id}`, status, memberId])
  const active = await payload.create({ collection: 'members', overrideAccess: true, data: { identityKey: `${suffix}-linked-a`, issuer: settings.issuer, subject: `${suffix}-linked-a`, displayName: 'Linked A', roles: ['alumni'] } })
  const gone = await payload.create({ collection: 'members', overrideAccess: true, data: { identityKey: `${suffix}-linked-b`, issuer: settings.issuer, subject: `${suffix}-linked-b`, displayName: 'Linked B', roles: [], status: 'offboarded' } })
  members.push(active.id, gone.id)
  const onApplication = await insert('Linked App', 'approved')
  await invite(onApplication, 'expired', null)
  await q(`UPDATE member_applications SET member_id = $1 WHERE id = $2`, [active.id, onApplication])
  const onInvitation = await insert('Linked Invite', 'approved')
  await invite(onInvitation, 'revoked', gone.id) // only the invitation is linked, to an offboarded member
  await insert('Linked Plain', 'withdrawn') // lapsed, linked to nobody: the flag may re-invite this one
  const roster = parsed(person('Linked App'), person('Linked Invite'), person('Linked Plain'))
  expect((await planFor(roster)).outcomes.map((outcome) => outcome.reason ?? outcome.outcome)).toEqual(['member-linked', 'member-linked', 'application-withdrawn'])
  const flagged = await planFor(roster, undefined, { reinviteLapsed: true })
  expect(flagged.outcomes.map((outcome) => outcome.reason ?? outcome.outcome)).toEqual(['member-linked', 'member-linked', 'create'])
  const before = await counts()
  expect((await apply(roster, undefined, { reinviteLapsed: true })).counts).toMatchObject({ created: 1, skip: 2 })
  expect((await counts()).applications).toBe(before.applications + 1)
})

test('a stuck holder of an address lock fails the form closed with the generic answer and the roster row with a fixed reason; nothing is stored', async () => {
  const address = email('Timeout One')
  const holder = await (payload.db as any).pool.connect()
  const saved = process.env.LIFECYCLE_LOCK_TIMEOUT_MS
  process.env.LIFECYCLE_LOCK_TIMEOUT_MS = '300'
  try {
    await holder.query('BEGIN')
    await holder.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`terrace-application-email:${address}`])
    const started = Date.now()
    const form = await intake.apply(request(null, { name: `Roster Timeout ${suffix}`, affiliation: 'alumni', contactEmail: address }, { 'x-terrace-intake': secret }))
    expect(Date.now() - started).toBeLessThan(5000)
    expect(form.status).toBe(503)
    expect(await form.json()).toEqual({ error: 'Unavailable.' }) // the same answer as a full queue
    expect((await q(`SELECT count(*)::int AS n FROM member_applications WHERE lower(contact_email) = $1`, [address])).rows[0].n).toBe(0)
    const roster = parsed(person('Timeout One'))
    const result = await apply(roster)
    expect(result).toMatchObject({ failure: 'address-locked', counts: { created: 0, failed: 1 } })
    expect((await q(`SELECT count(*)::int AS n FROM member_applications WHERE lower(contact_email) = $1`, [address])).rows[0].n).toBe(0)
  } finally { await holder.query('ROLLBACK').catch(() => undefined); holder.release(); if (saved === undefined) delete process.env.LIFECYCLE_LOCK_TIMEOUT_MS; else process.env.LIFECYCLE_LOCK_TIMEOUT_MS = saved }
  // With the holder gone the same submission goes through.
  expect((await intake.apply(request(null, { name: `Roster Timeout ${suffix}`, affiliation: 'alumni', contactEmail: address }, { 'x-terrace-intake': secret }))).status).toBe(202)
})

test('a link file that cannot be written is retried; success on a retry delivers, and failing every try surfaces that one invitation as undeliverable', async () => {
  const attempts: Array<[number, number]> = []
  const ok = await apply(parsed(person('Retry One'), person('Retry Two')), undefined, { seams: { beforeMirror: (row: number, attempt: number) => { attempts.push([row, attempt]); if (row === 2 && attempt < 2) throw new Error('transient') } } })
  expect(ok.counts).toMatchObject({ created: 2, failed: 0, mirrorFailed: 0 })
  expect(attempts).toEqual([[2, 0], [2, 1], [2, 2], [3, 0]])
  expect(mirror().filter((entry) => entry.text.includes(email('Retry One')) || entry.text.includes(email('Retry Two'))).length).toBe(2)
  // Every attempt fails for the second row: the first is delivered and untouched, the second is committed without a file and reported.
  const failing = await apply(parsed(person('Retry Three'), person('Retry Four')), undefined, { seams: { beforeMirror: (row: number) => { if (row === 3) throw new Error('disk full') } } })
  expect(failing).toMatchObject({ failure: 'mirror-failed', counts: { created: 2, failed: 1, mirrorFailed: 1 } })
  expect(failing.undeliverable).toHaveLength(1)
  const report = await reconcileMirror(payload)
  expect(report.undeliverable).toContain(failing.undeliverable![0])
  expect((await q(`SELECT i.status FROM message_outbox o JOIN member_invitations i ON i.id = o.invitation_id WHERE o.id = $1`, [failing.undeliverable![0]])).rows[0].status).toBe('pending')
  // The link was never written anywhere once the attempt ended.
  expect(mirror().map((entry) => entry.text).join('\n')).not.toContain(email('Retry Four'))
  expect(JSON.stringify(failing)).not.toMatch(/#[A-Za-z0-9_-]{43}/)
  // Recovery for that one: revoke it in the admin (status revoked), leaving the delivered link alone, then a one-row file reissues it.
  const target = (await q(`SELECT i.id FROM message_outbox o JOIN member_invitations i ON i.id = o.invitation_id WHERE o.id = $1`, [failing.undeliverable![0]])).rows[0].id
  await payload.update({ collection: 'member-invitations', id: target, data: { status: 'revoked' }, user: admin, overrideAccess: false })
  expect((await q(`SELECT i.status FROM member_invitations i JOIN member_applications a ON a.id = i.application_id WHERE a.contact_email = $1`, [email('Retry Three')])).rows[0].status).toBe('pending')
})

test('two overlapping applies cannot both start: the second is refused while the first holds the running slot', async () => {
  const first = parsed(person('Overlap One'))
  const second = parsed(person('Overlap Two'))
  let release!: () => void
  const paused = new Promise<void>((resolve) => { release = resolve })
  let reached!: () => void
  const claimed = new Promise<void>((resolve) => { reached = resolve })
  const running = apply(first, undefined, { seams: { afterClaim: async () => { reached(); await paused } } })
  await claimed
  await expect(apply(second)).rejects.toThrow('run-in-progress')
  release()
  expect((await running).counts.created).toBe(1)
  expect((await apply(second)).counts.created).toBe(1) // the slot is free again
  // Simultaneous claims: at most one wins.
  const a = parsed(person('Overlap Three')), b = parsed(person('Overlap Four'))
  const settled = await Promise.allSettled([apply(a), apply(b)])
  expect(settled.filter((outcome) => outcome.status === 'fulfilled').length).toBeGreaterThanOrEqual(1)
  for (const outcome of settled) if (outcome.status === 'rejected') expect(String(outcome.reason)).toContain('run-in-progress')
})
