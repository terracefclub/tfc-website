import { afterAll, expect, test } from 'bun:test'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { createKeycloakVerifier, type KeycloakConfig } from '../src/auth/keycloak'
import { editorialClaims } from '../src/auth/editorial-policy'

const key = await generateKeyPair('RS256')
const jwk = { ...await exportJWK(key.publicKey), kid: 'editorial-test', alg: 'RS256', use: 'sig' }
let active = true, unavailable = false, subject = 'editor-1'
const server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
  if (request.url.endsWith('/certs')) return Response.json({ keys: [jwk] })
  if (request.url.endsWith('/token/introspect')) {
    if (unavailable) return new Response(null, { status: 503 })
    const form = await request.formData()
    if (form.get('client_id') !== 'terrace-editorial' || form.get('client_secret') !== 'test-only') return new Response(null, { status: 401 })
    return Response.json({ active, sub: subject, exp: Math.floor(Date.now() / 1000) + 60 })
  }
  return new Response(null, { status: 404 })
} })
const settings: KeycloakConfig = { issuer: `http://127.0.0.1:${server.port}/realms/editorial-test`, clientId: 'terrace-cms', audience: 'terrace-editorial', introspectionClientId: 'terrace-editorial', introspectionSecret: 'test-only' }
const verify = createKeycloakVerifier(settings, editorialClaims)
async function token(changes: Record<string, unknown> = {}, signingKey = key.privateKey) {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ iss: settings.issuer, aud: settings.audience, sub: 'editor-1', azp: settings.clientId, typ: 'Bearer', iat: now, exp: now + 60, jti: crypto.randomUUID(), name: 'Test editor', realm_access: { roles: ['editorial-editor'] }, ...changes })
    .setProtectedHeader({ alg: 'RS256', kid: jwk.kid }).sign(signingKey)
}
afterAll(() => server.stop(true))

test('only explicit editorial roles authenticate, using the editorial resource and client', async () => {
  expect((await verify(await token())).role).toBe('editor')
  expect((await verify(await token({ realm_access: { roles: ['editorial-admin'] } }))).role).toBe('admin')
})
for (const [label, changes] of Object.entries({
  current: { realm_access: { roles: ['current-member'] } }, alumni: { realm_access: { roles: ['alumni'] } },
  unapproved: { realm_access: { roles: [] } }, genericAdmin: { realm_access: { roles: ['admin'] } },
  wrongIssuer: { iss: 'https://other.example/realms/terrace' }, memberAudience: { aud: 'terrace-community' },
  memberClient: { azp: 'terrace-web' }, idToken: { typ: 'ID' }, expired: { exp: 1 },
  old: { iat: Math.floor(Date.now() / 1000) - 120 }, missingSubject: { sub: undefined }, arraySubject: { sub: ['editor-1'] },
})) test(`editorial verifier rejects ${label}`, async () => { await expect(verify(await token(changes))).rejects.toThrow() })

test('forged, disabled, subject-mismatched and unavailable identity sessions fail closed', async () => {
  const wrong = await generateKeyPair('RS256')
  await expect(verify(await token({}, wrong.privateKey))).rejects.toThrow()
  active = false
  await expect(verify(await token())).rejects.toThrow()
  active = true; subject = 'other-editor'
  await expect(verify(await token())).rejects.toThrow()
  subject = 'editor-1'; unavailable = true
  await expect(verify(await token())).rejects.toThrow()
})
