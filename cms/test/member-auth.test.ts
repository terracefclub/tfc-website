import { afterAll, beforeAll, expect, test } from 'bun:test'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { createMemberVerifier, keycloakConfig, type KeycloakConfig } from '../src/auth/keycloak'
import { isMember, memberId } from '../src/access/members'
import { isStaff } from '../src/access/rules'

const key = await generateKeyPair('RS256')
const jwk = { ...await exportJWK(key.publicKey), kid: 'test-key', alg: 'RS256', use: 'sig' }
let active = true
let calls = 0
const server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
  const url = new URL(request.url)
  if (url.pathname.endsWith('/certs')) return Response.json({ keys: [jwk] })
  if (url.pathname.endsWith('/token/introspect')) {
    calls++
    const form = await request.formData()
    if (form.get('client_id') !== 'test-introspection' || form.get('client_secret') !== 'synthetic-secret') return new Response(null, { status: 401 })
    return Response.json({ active, sub: 'approved-person', exp: Math.floor(Date.now() / 1000) + 60 })
  }
  return new Response(null, { status: 404 })
} })
const settings: KeycloakConfig = { issuer: `http://127.0.0.1:${server.port}/realms/terrace-test`, audience: 'terrace-community', clientId: 'terrace-web', introspectionClientId: 'test-introspection', introspectionSecret: 'synthetic-secret' }
const verify = createMemberVerifier(settings)
let payload: Awaited<ReturnType<typeof getPayload>>
let memberID: number | undefined

async function token(overrides: Record<string, unknown> = {}, signingKey = key.privateKey) {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ iss: settings.issuer, aud: settings.audience, sub: 'approved-person', iat: now, exp: now + 60, jti: crypto.randomUUID(), azp: settings.clientId, typ: 'Bearer', name: 'Synthetic Terran', realm_access: { roles: ['current-member'] }, ...overrides })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).sign(signingKey)
}

beforeAll(async () => {
  process.env.MEMBER_AUTH_ISSUER = settings.issuer
  process.env.MEMBER_AUTH_AUDIENCE = settings.audience
  process.env.MEMBER_AUTH_CLIENT_ID = settings.clientId
  process.env.MEMBER_AUTH_INTROSPECTION_CLIENT_ID = settings.introspectionClientId
  process.env.MEMBER_AUTH_INTROSPECTION_SECRET = settings.introspectionSecret
  payload = await getPayload({ config, key: 'member-auth-tests' })
})
afterAll(async () => {
  if (memberID) {
    await payload.db.pool.query(`DELETE FROM data_requests WHERE member_id = $1`, [memberID])
    await payload.delete({ collection: 'members', id: memberID, overrideAccess: true })
  }
  for (const name of ['MEMBER_AUTH_ISSUER', 'MEMBER_AUTH_AUDIENCE', 'MEMBER_AUTH_CLIENT_ID', 'MEMBER_AUTH_INTROSPECTION_CLIENT_ID', 'MEMBER_AUTH_INTROSPECTION_SECRET']) delete process.env[name]
  await payload?.db.destroy?.()
  server.stop(true)
})

test('only an approved, signed, active resource token maps to membership', async () => {
  expect(await verify(await token())).toEqual({ issuer: settings.issuer, subject: 'approved-person', displayName: 'Synthetic Terran', roles: ['current-member'] })
  expect((await verify(await token({ realm_access: { roles: ['alumni'] } }))).roles).toEqual(['alumni'])
})

for (const [label, changes] of Object.entries({
  issuer: { iss: 'https://attacker.invalid/realms/terrace' },
  audience: { aud: 'another-resource' },
  client: { azp: 'another-client' },
  idToken: { typ: 'ID' },
  expired: { exp: 1 },
  old: { iat: Math.floor(Date.now() / 1000) - 120 },
  unapproved: { realm_access: { roles: ['registered'] } },
  missingRoles: { realm_access: null },
  numericSubject: { sub: 42 },
  arraySubject: { sub: ['approved-person'] },
  emptySubject: { sub: '' },
})) test(`rejects ${label} before member provisioning`, async () => {
  const before = calls
  await expect(verify(await token(changes))).rejects.toThrow()
  expect(calls).toBe(before)
})

test('rejects a forged signature and an inactive session', async () => {
  const wrong = await generateKeyPair('RS256')
  await expect(verify(await token({}, wrong.privateKey))).rejects.toThrow()
  active = false
  try { await expect(verify(await token())).rejects.toThrow() } finally { active = true }
})

test('configuration is fail closed and never permits remote plaintext issuers', () => {
  expect(keycloakConfig({})).toBeNull()
  expect(() => keycloakConfig({ MEMBER_AUTH_ISSUER: 'http://example.org/realms/terrace' })).toThrow()
  expect(() => keycloakConfig({ MEMBER_AUTH_ISSUER: settings.issuer })).toThrow()
  expect(isMember({ user: { id: 1, collection: 'users', role: 'admin' } as any })).toBe(false)
  expect(memberId({ user: { id: 1, collection: 'members', roles: [] } as any })).toBeNull()
})

test('isStaff (editorial users) and isMember (community members) are different, non-overlapping checks', () => {
  for (const role of ['admin', 'editor']) expect(isStaff({ collection: 'users', role })).toBe(true)
  expect(isStaff({ collection: 'users', role: 'viewer' })).toBe(false)
  expect(isStaff({ id: 1, collection: 'members', roles: ['alumni'], role: 'admin' })).toBe(false)
  expect(isStaff(null)).toBe(false)
  expect(isMember({ user: { id: 1, collection: 'users', role: 'editor' } as any })).toBe(false)
})

test('Payload provisions the same immutable identity once and keeps it out of editorial access', async () => {
  const signed = await token()
  const first = await payload.auth({ headers: new Headers({ authorization: `Bearer ${signed}` }) })
  expect(first.user?.collection).toBe('members')
  memberID = Number(first.user!.id)
  expect(isMember({ user: first.user })).toBe(true)
  const again = await payload.auth({ headers: new Headers({ authorization: `Bearer ${signed}` }) })
  expect(again.user?.id).toBe(first.user!.id)
  await expect(payload.find({ collection: 'users', user: first.user, overrideAccess: false })).rejects.toThrow()
  await expect(payload.findVersions({ collection: 'events', user: first.user, overrideAccess: false })).rejects.toThrow()
  await expect(payload.create({ collection: 'members', data: { displayName: 'Fake' }, user: first.user, overrideAccess: false })).rejects.toThrow()
  const visible = await payload.findByID({ collection: 'members', id: memberID, user: first.user, overrideAccess: false })
  expect(visible.displayName).toBe('Synthetic Terran')
  expect(visible).not.toHaveProperty('issuer')
  expect(visible).not.toHaveProperty('subject')
  expect(visible).not.toHaveProperty('identityKey')
  const other = await payload.create({ collection: 'members', overrideAccess: true, data: { identityKey: crypto.randomUUID(), issuer: settings.issuer, subject: 'another-person', displayName: 'Hidden identity', roles: ['alumni'] } })
  try {
    const list = await payload.find({ collection: 'members', user: first.user, overrideAccess: false })
    expect(list.docs.map((entry) => entry.id)).toEqual([first.user!.id])
    await expect(payload.findByID({ collection: 'members', id: other.id, user: first.user, overrideAccess: false })).rejects.toThrow()
  } finally { await payload.delete({ collection: 'members', id: other.id, overrideAccess: true }) }
  active = false
  try { expect((await payload.auth({ headers: new Headers({ authorization: `Bearer ${signed}` }) })).user).toBeNull() } finally { active = true }
})

test('an offboarded or erased member fails closed even with a valid token, and restoring reopens access', async () => {
  const signed = await token()
  const headers = new Headers({ authorization: `Bearer ${signed}` })
  expect((await payload.auth({ headers })).user?.id).toBe(memberID)
  for (const status of ['offboarded', 'erased'] as const) {
    await payload.update({ collection: 'members', id: memberID!, data: { status }, overrideAccess: true })
    expect((await payload.auth({ headers })).user).toBeNull()
  }
  await payload.update({ collection: 'members', id: memberID!, data: { status: 'active' }, overrideAccess: true })
  expect((await payload.auth({ headers })).user?.id).toBe(memberID)
})

// ---- the lifecycle endpoints through the real REST route and its authentication ----------------------------
import { handleEndpoints } from 'payload'
const rest = (path: string, init: RequestInit = {}) => handleEndpoints({ config, payloadInstanceCacheKey: 'member-auth-tests', request: new Request(`http://127.0.0.1:3010/api${path}`, init) })
const lifecycleSecret = `synthetic-intake-secret-${crypto.randomUUID()}`

test('REST: export and erasure require a verified, active member token and fail closed otherwise', async () => {
  const signed = await token()
  const bearer = { authorization: `Bearer ${signed}` }
  // No token, a forged token and an unapproved identity are refused by the real authentication.
  expect((await rest('/lifecycle/export')).status).toBe(401)
  expect((await rest('/lifecycle/export', { headers: { authorization: 'Bearer not-a-token' } })).status).toBe(401)
  expect((await rest('/lifecycle/erasure', { method: 'POST', body: JSON.stringify({ step: 'request' }) })).status).toBe(401)
  const unapproved = await token({ realm_access: { roles: ['registered'] } })
  expect((await rest('/lifecycle/export', { headers: { authorization: `Bearer ${unapproved}` } })).status).toBe(401)
  // An approved member gets their export, no-store, as an attachment.
  const ok = await rest('/lifecycle/export', { headers: bearer })
  expect(ok.status).toBe(200)
  expect(ok.headers.get('cache-control')).toContain('no-store')
  expect(ok.headers.get('content-disposition')).toContain('attachment')
  const body = await ok.json() as any
  expect(body.member.displayName).toBe('Synthetic Terran')
  expect(JSON.stringify(body)).not.toContain('approved-person')
  // Step one of erasure issues a code and changes nothing.
  const asked = await rest('/lifecycle/erasure', { method: 'POST', headers: bearer, body: JSON.stringify({ step: 'request' }) })
  expect(asked.status).toBe(201)
  expect(((await asked.json()) as any).confirmationCode).toHaveLength(43)
  // An offboarded member is refused by the same route.
  await payload.update({ collection: 'members', id: memberID!, data: { status: 'offboarded' }, overrideAccess: true })
  try {
    expect((await rest('/lifecycle/export', { headers: bearer })).status).toBe(401)
    expect((await rest('/lifecycle/erasure', { method: 'POST', headers: bearer, body: JSON.stringify({ step: 'request' }) })).status).toBe(401)
  } finally { await payload.update({ collection: 'members', id: memberID!, data: { status: 'active' }, overrideAccess: true }) }
})

test('REST: apply and redeem need the website secret, and members cannot read lifecycle collections', async () => {
  process.env.LIFECYCLE_INTAKE_SECRET = lifecycleSecret
  try {
    const application = { name: 'REST Applicant', affiliation: 'alumni', contactEmail: `rest-${crypto.randomUUID().slice(0, 8)}@terrace.invalid` }
    const post = (path: string, headers: Record<string, string>, data: unknown) => rest(path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(data) })
    expect((await post('/lifecycle/apply', {}, application)).status).toBe(403)
    expect((await post('/lifecycle/apply', { 'x-terrace-intake': 'wrong' }, application)).status).toBe(403)
    expect((await post('/lifecycle/apply', { authorization: `Bearer ${await token()}` }, application)).status).toBe(403) // a member token is not the website secret
    expect((await post('/lifecycle/apply', { 'x-terrace-intake': lifecycleSecret }, application)).status).toBe(202)
    expect((await post('/lifecycle/redeem', {}, { token: 'A'.repeat(43) })).status).toBe(403)
    expect((await post('/lifecycle/redeem', { 'x-terrace-intake': lifecycleSecret }, { token: 'A'.repeat(43), consume: true })).status).toBe(404)
    const bearer = { headers: { authorization: `Bearer ${await token()}` } }
    for (const path of ['/member-applications', '/member-invitations', '/message-outbox', '/member-offboardings', '/moderation-reports', '/data-requests']) expect((await rest(path)).status).toBe(403)
    for (const path of ['/message-outbox', '/member-offboardings']) expect((await rest(path, bearer)).status).toBe(403)
    // Members may list only records tied to them (none here), never anyone else's.
    for (const path of ['/member-applications', '/member-invitations']) expect(((await (await rest(path, bearer)).json()) as any).totalDocs).toBe(0)
    const own = await (await rest('/data-requests?depth=0', bearer)).json() as any
    expect(own.docs.length).toBeGreaterThan(0)
    expect(own.docs.every((doc: any) => doc.member === memberID)).toBe(true)
    expect((await rest('/graphql', { method: 'POST', body: '{"query":"{__typename}"}' })).status).toBe(404)
    await payload.db.pool.query(`DELETE FROM member_applications WHERE contact_email = $1`, [application.contactEmail])
  } finally { delete process.env.LIFECYCLE_INTAKE_SECRET }
})
