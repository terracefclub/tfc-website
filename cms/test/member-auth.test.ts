import { afterAll, beforeAll, expect, test } from 'bun:test'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { createMemberVerifier, keycloakConfig, type KeycloakConfig } from '../src/auth/keycloak'
import { isMember, memberId } from '../src/access/members'

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
  if (memberID) await payload.delete({ collection: 'members', id: memberID, overrideAccess: true })
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
