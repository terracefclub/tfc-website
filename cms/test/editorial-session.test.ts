import { expect, test } from 'bun:test'
import { createEditorialSession, type EditorialProvider, type Tokens } from '../src/auth/editorial-session'
import { editorialCallbackURL, editorialEnabled, editorialSettings, type EditorialClaims, type EditorialSettings } from '../src/auth/editorial-policy'

const settings: EditorialSettings = {
  issuer: 'https://id.example.test/realms/terrace', clientId: 'terrace-cms', audience: 'terrace-editorial',
  introspectionClientId: 'terrace-editorial', introspectionSecret: 'synthetic', secret: 'synthetic', origin: 'https://cms.example.test', secure: true,
}
const claims: EditorialClaims = { issuer: settings.issuer, subject: 'editor-1', displayName: 'Synthetic editor', role: 'editor' }
const callback = new URL(`${settings.origin}/api/editorial/callback?code=synthetic-code&state=valid`)
const cookies = (response: Response) => response.headers.getSetCookie().map((cookie) => cookie.split(';')[0]).join('; ')

function fixture() {
  let now = Date.now(), refreshes = 0, checks = 0, provisioned = 0
  const revoked: string[] = []
  let live = true, subject = claims.subject, role = claims.role, failExchange = false
  let tokens: Tokens = { access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', expires_in: 60, subject }
  const provider: EditorialProvider = {
    async authorize(transaction) {
      if (transaction.verifier.length < 43 || transaction.state === transaction.nonce) throw new Error('Invalid authorization request')
      return 'https://id.example.test/authorize'
    },
    async exchange() { if (failExchange) throw new Error('OIDC validation failed'); return tokens },
    async refresh() { refreshes++; await new Promise((resolve) => setTimeout(resolve, 10)); return { ...tokens, refresh_token: `rotated-${refreshes}` } },
    async verify() { checks++; if (!live) throw new Error('Inactive'); return { ...claims, subject, role } },
    async revoke(token) { revoked.push(token) },
    async logout() { return 'https://id.example.test/logout' },
  }
  const session = createEditorialSession(settings, provider, () => now)
  const provision = async () => { provisioned++ }
  async function signIn() {
    const begin = await session.begin(new Headers())
    const pending = new Headers({ cookie: cookies(begin) })
    const result = await session.callback(pending, callback, provision)
    return { begin, pending, result, request: new Headers({ cookie: cookies(result), origin: settings.origin }) }
  }
  return { session, signIn, provider, provision, revoked, setActive: (value: boolean) => { live = value }, setSubject: (value: string) => { subject = value }, setRole: (value: 'editor' | 'admin') => { role = value }, setTokens: (value: Tokens) => { tokens = value }, failExchange: () => { failExchange = true }, advance: (ms: number) => { now += ms }, counts: () => ({ refreshes, checks, provisioned }) }
}

test('configuration fails closed, including partial CMS_AUTH configuration', () => {
  expect(editorialEnabled({})).toBe(false)
  expect(editorialEnabled({ CMS_AUTH_ISSUER: '' })).toBe(true)
  expect(editorialEnabled({ CMS_AUTH_AUDIENCE: 'terrace-editorial' })).toBe(true)
  expect(() => editorialSettings({ CMS_AUTH_AUDIENCE: 'terrace-editorial' })).toThrow()
  const env = { CMS_AUTH_ISSUER: settings.issuer, CMS_AUTH_CLIENT_ID: settings.clientId, CMS_AUTH_CLIENT_SECRET: 'test', CMS_AUTH_AUDIENCE: settings.audience,
    CMS_AUTH_INTROSPECTION_CLIENT_ID: settings.introspectionClientId, CMS_AUTH_INTROSPECTION_SECRET: 'test', CMS_ORIGIN: settings.origin }
  expect(editorialSettings(env).origin).toBe(settings.origin)
  for (const CMS_ORIGIN of ['http://cms.example.test', 'https://cms.example.test/path', 'https://u:p@cms.example.test', 'https://cms.example.test/?x=1']) expect(() => editorialSettings({ ...env, CMS_ORIGIN })).toThrow()
})

test('callback uses configured origin only after checking Host, never forwarded input', () => {
  const request = { headers: new Headers({ host: 'cms.example.test', 'x-forwarded-host': 'attacker.test' }), url: 'http://localhost:3040/api/editorial/callback?code=test' }
  expect(editorialCallbackURL(request, settings.origin).href).toBe('https://cms.example.test/api/editorial/callback?code=test')
  expect(() => editorialCallbackURL({ ...request, headers: new Headers({ host: 'attacker.test' }) }, settings.origin)).toThrow()
  expect(() => editorialCallbackURL({ ...request, headers: new Headers() }, settings.origin)).toThrow()
})

test('opaque cookies are HttpOnly, secure, fixed lifetime and no token enters responses', async () => {
  const f = fixture()
  const { begin, result, request } = await f.signIn()
  expect(begin.status).toBe(303)
  for (const response of [begin, result]) {
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    for (const cookie of response.headers.getSetCookie()) {
      expect(cookie).toContain('HttpOnly; SameSite=Lax; Secure')
      expect(cookie).not.toContain('synthetic-access')
      expect(cookie).not.toContain('synthetic-refresh')
    }
  }
  expect(result.headers.get('location')).toBe(`${settings.origin}/admin`)
  expect((await f.session.resolve(request))?.claims.role).toBe('editor')
  f.advance(8 * 60 * 60_000 + 1)
  expect(await f.session.resolve(request)).toBeNull()
})

test('callback is single-use and missing, replayed, expired or mismatched transactions do not provision', async () => {
  const f = fixture()
  expect((await f.session.callback(new Headers(), callback, f.provision)).headers.get('location')).toContain('denied')
  const { pending } = await f.signIn()
  expect((await f.session.callback(pending, callback, f.provision)).headers.get('location')).toContain('denied')
  expect(f.counts().provisioned).toBe(1)
  const begin = await f.session.begin(new Headers())
  f.advance(300_001)
  expect((await f.session.callback(new Headers({ cookie: cookies(begin) }), callback, f.provision)).headers.get('location')).toContain('denied')
  const next = await f.session.begin(new Headers())
  expect((await f.session.callback(new Headers({ cookie: cookies(next) }), new URL('https://attacker.test/api/editorial/callback'), f.provision)).headers.get('location')).toContain('denied')
  expect(f.counts().provisioned).toBe(1)
})

test('OIDC rejection, missing refresh token, long lifetime, mismatched subject and denied role never provision', async () => {
  const failed = fixture(); failed.failExchange(); await failed.signIn(); expect(failed.counts().provisioned).toBe(0)
  for (const change of [ { refresh_token: undefined }, { expires_in: 3600 }, { subject: 'another-editor' } ]) {
    const f = fixture(); f.setTokens({ access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', expires_in: 60, subject: claims.subject, ...change })
    expect((await f.signIn()).result.headers.get('location')).toContain('denied')
    expect(f.counts().provisioned).toBe(0)
  }
  const denied = fixture(); denied.setActive(false); await denied.signIn()
  expect(denied.counts().provisioned).toBe(0)
  expect(denied.revoked).toContain('synthetic-refresh')
})

test('every request checks live access; role downgrade and revocation override stored role', async () => {
  const f = fixture(); f.setRole('admin')
  const { request } = await f.signIn()
  expect((await f.session.resolve(request))?.claims.role).toBe('admin')
  f.setRole('editor')
  expect((await f.session.resolve(request))?.claims.role).toBe('editor')
  f.setActive(false)
  expect(await f.session.resolve(request)).toBeNull()
  f.setActive(true)
  expect(await f.session.resolve(request)).toBeNull()
  expect(f.revoked).toContain('synthetic-refresh')
})

test('refresh rotates once across concurrent requests and refuses subject replacement', async () => {
  const f = fixture()
  const { request } = await f.signIn()
  f.advance(55_000)
  const results = await Promise.all([f.session.resolve(request), f.session.resolve(request)])
  expect(results.every(Boolean)).toBe(true)
  expect(f.counts().refreshes).toBe(1)
  f.setSubject('someone-else')
  expect(await f.session.resolve(request)).toBeNull()
  expect(f.revoked).toContain('rotated-1')
})

test('cookie-authenticated mutations require the exact Origin; logout invalidates the session', async () => {
  const f = fixture()
  const { request } = await f.signIn()
  expect(await f.session.resolve(new Headers({ cookie: request.get('cookie')! }), 'POST')).toBeNull()
  expect(await f.session.resolve(new Headers({ cookie: request.get('cookie')!, origin: 'https://attacker.test' }), 'PATCH')).toBeNull()
  expect(await f.session.resolve(request, 'POST')).not.toBeNull()
  const result = await f.session.logout(request)
  expect(result.headers.get('location')).toBe('https://id.example.test/logout')
  expect(result.headers.getSetCookie().every((value) => value.includes('Max-Age=0'))).toBe(true)
  expect(await f.session.resolve(request)).toBeNull()
  expect(f.revoked).toContain('synthetic-refresh')
})

test('login and session stores are bounded and preview origins use distinct cookies', async () => {
  const f = fixture()
  for (let i = 0; i < 1000; i++) await f.session.begin(new Headers())
  await expect(f.session.begin(new Headers())).rejects.toThrow('busy')
  f.advance(300_001)
  expect((await f.session.begin(new Headers())).status).toBe(303)
  const other = createEditorialSession({ ...settings, origin: 'http://127.0.0.1:3040', secure: false }, f.provider)
  expect(other.name).not.toBe(f.session.name)
})

test('starting a new login invalidates the previous session even if the new identity is denied', async () => {
  const f = fixture()
  const { request } = await f.signIn()
  const next = await f.session.begin(request)
  f.setActive(false)
  const denied = await f.session.callback(new Headers({ cookie: cookies(next) }), callback, f.provision)
  expect(denied.headers.get('location')).toContain('denied')
  f.setActive(true)
  expect(await f.session.resolve(request)).toBeNull()
  expect(f.revoked).toContain('synthetic-refresh')
})

test('unsafe requests require the exact origin including scheme', () => {
  const { session } = fixture()
  for (const origin of ['', 'http://cms.example.test', 'https://other.example.test']) {
    expect(session.csrf(new Headers(origin ? { origin } : {}), 'POST')).toBe(false)
  }
  expect(session.csrf(new Headers({ origin: settings.origin }), 'POST')).toBe(true)
})
