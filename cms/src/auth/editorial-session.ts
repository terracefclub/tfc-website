import { createHash, randomBytes } from 'node:crypto'
import * as oidc from 'openid-client'
import { createKeycloakVerifier } from './keycloak'
import { editorialClaims, editorialSettings, type EditorialClaims, type EditorialSettings } from './editorial-policy'

class Store<T> {
  private entries = new Map<string, { value: T; expires: number }>()
  constructor(private ttl: number, private now: () => number, private limit = 1000) {}
  put(value: T) {
    for (const [id, entry] of this.entries) if (entry.expires <= this.now()) this.entries.delete(id)
    if (this.entries.size >= this.limit) throw new Error('Sign-in is busy.')
    const id = randomBytes(32).toString('base64url')
    this.entries.set(id, { value, expires: this.now() + this.ttl })
    return id
  }
  get(id?: string) {
    if (!id || !/^[A-Za-z0-9_-]{43}$/.test(id)) return undefined
    const entry = this.entries.get(id)
    if (entry && entry.expires > this.now()) return entry.value
    this.entries.delete(id)
  }
  take(id?: string) { const value = this.get(id); if (id) this.entries.delete(id); return value }
}

export type Tokens = { access_token: string; refresh_token?: string; expires_in?: number; subject?: string }
type Transaction = { verifier: string; state: string; nonce: string }
export type EditorialProvider = {
  authorize(transaction: Transaction): Promise<string>
  exchange(url: URL, transaction: Transaction): Promise<Tokens>
  refresh(token: string): Promise<Tokens>
  verify(token: string): Promise<EditorialClaims>
  revoke(token: string): Promise<unknown>
  logout(): Promise<string>
}
type Session = { subject: string; token: string; refreshToken: string; expires: number; ends: number; refreshing?: Promise<void> }
const lifetime = 8 * 60 * 60_000

export function createProvider(settings: EditorialSettings): EditorialProvider {
  let discovery: Promise<oidc.Configuration> | undefined
  const client = () => discovery ??= oidc.discovery(new URL(settings.issuer), settings.clientId,
    { client_secret: settings.secret, id_token_signed_response_alg: 'RS256' }, oidc.ClientSecretPost(settings.secret), {
      timeout: 5, execute: [...(settings.secure || settings.issuer.startsWith('https:') ? [] : [oidc.allowInsecureRequests]), oidc.enableNonRepudiationChecks],
    }).catch(() => { discovery = undefined; throw new Error('Sign-in unavailable.') })
  return {
    async authorize(transaction) {
      return oidc.buildAuthorizationUrl(await client(), { redirect_uri: `${settings.origin}/api/editorial/callback`, scope: 'openid profile',
        code_challenge: await oidc.calculatePKCECodeChallenge(transaction.verifier), code_challenge_method: 'S256', state: transaction.state, nonce: transaction.nonce, prompt: 'login' }).href
    },
    async exchange(url, transaction) {
      const tokens = await oidc.authorizationCodeGrant(await client(), url, { pkceCodeVerifier: transaction.verifier, expectedState: transaction.state, expectedNonce: transaction.nonce, idTokenExpected: true })
      return { ...tokens, subject: tokens.claims()?.sub }
    },
    async refresh(token) { return oidc.refreshTokenGrant(await client(), token) },
    verify: createKeycloakVerifier(settings, editorialClaims),
    async revoke(token) { await oidc.tokenRevocation(await client(), token, { token_type_hint: 'refresh_token' }) },
    async logout() { return oidc.buildEndSessionUrl(await client(), { client_id: settings.clientId, post_logout_redirect_uri: `${settings.origin}/admin/login` }).href },
  }
}

export function createEditorialSession(settings: EditorialSettings, provider: EditorialProvider, now = Date.now) {
  const pending = new Store<Transaction>(300_000, now)
  const sessions = new Store<Session>(lifetime, now)
  const name = `terrace_cms_${createHash('sha256').update(settings.origin).digest('hex').slice(0, 10)}`
  const loginName = `${name}_login`
  function read(headers: Headers, cookie: string) { return headers.get('cookie')?.split(';').map((v) => v.trim()).find((v) => v.startsWith(`${cookie}=`))?.slice(cookie.length + 1) }
  function cookie(key: string, value: string, age: number) { return `${key}=${value}; Path=/; Max-Age=${age}; HttpOnly; SameSite=Lax${settings.secure ? '; Secure' : ''}` }
  function csrf(headers: Headers, method = 'GET') {
    return ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) || headers.get('origin') === settings.origin
  }
  const headers = () => new Headers({ 'Cache-Control': 'private, no-store', 'Pragma': 'no-cache', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' })
  function validTokens(tokens: Tokens) {
    if (!tokens.access_token || !tokens.refresh_token || !tokens.expires_in || tokens.expires_in > 65 || tokens.expires_in <= 0) throw new Error('Invalid session.')
    return { token: tokens.access_token, refreshToken: tokens.refresh_token, expires: now() + tokens.expires_in * 1000 }
  }
  async function revoke(token?: string) { if (token) await provider.revoke(token).catch(() => undefined) }
  async function remove(request: Headers) {
    const session = sessions.take(read(request, name))
    if (session?.refreshing) await session.refreshing.catch(() => undefined)
    await revoke(session?.refreshToken)
  }
  return {
    csrf, headers, name, loginName,
    async begin(request: Headers) {
      await remove(request)
      pending.take(read(request, loginName))
      const transaction = { state: oidc.randomState(), nonce: oidc.randomNonce(), verifier: oidc.randomPKCECodeVerifier() }
      const location = await provider.authorize(transaction)
      const response = headers()
      response.set('Location', location)
      response.append('Set-Cookie', cookie(name, '', 0))
      response.append('Set-Cookie', cookie(loginName, pending.put(transaction), 300))
      return new Response(null, { status: 303, headers: response })
    },
    async callback(request: Headers, url: URL, provision: (claims: EditorialClaims) => Promise<unknown>) {
      const transaction = pending.take(read(request, loginName))
      const response = headers()
      response.append('Set-Cookie', cookie(loginName, '', 0))
      let tokens: Tokens | undefined
      let stage = !transaction ? 'missing transaction' : url.origin !== settings.origin ? 'callback origin' : 'callback path'
      try {
        if (!transaction || url.origin !== settings.origin || url.pathname !== '/api/editorial/callback') throw new Error('Invalid callback.')
        stage = 'code exchange'
        tokens = await provider.exchange(url, transaction)
        stage = 'resource token'
        const details = validTokens(tokens)
        const claims = await provider.verify(tokens.access_token)
        if (claims.subject !== tokens.subject) throw new Error('Invalid subject.')
        stage = 'account mapping'
        await provision(claims)
        stage = 'session creation'
        await remove(request)
        const id = sessions.put({ subject: claims.subject, ...details, ends: now() + lifetime })
        response.append('Set-Cookie', cookie(name, id, lifetime / 1000))
        response.set('Location', `${settings.origin}/admin`)
        return new Response(null, { status: 303, headers: response })
      } catch {
        console.warn(`Editorial sign-in denied at ${stage}.`)
        await revoke(tokens?.refresh_token)
        response.set('Location', `${settings.origin}/admin/login?editorial=denied`)
        return new Response(null, { status: 303, headers: response })
      }
    },
    async resolve(request: Headers, method?: string) {
      if (!csrf(request, method)) return null
      const id = read(request, name)
      const session = sessions.get(id)
      if (!session) return null
      try {
        if (session.expires <= now() + 10_000) {
          session.refreshing ??= provider.refresh(session.refreshToken).then((tokens) => {
            Object.assign(session, validTokens(tokens))
          }).finally(() => { session.refreshing = undefined })
          await session.refreshing
        }
        const claims = await provider.verify(session.token)
        if (claims.subject !== session.subject || sessions.get(id) !== session) throw new Error('Invalid session.')
        return { claims, expires: Math.floor(session.ends / 1000) }
      } catch {
        sessions.take(id)
        await revoke(session.refreshToken)
        return null
      }
    },
    async logout(request: Headers) {
      await remove(request)
      pending.take(read(request, loginName))
      const response = headers()
      response.append('Set-Cookie', cookie(name, '', 0))
      response.append('Set-Cookie', cookie(loginName, '', 0))
      response.set('Location', await provider.logout().catch(() => `${settings.origin}/admin/login`))
      return new Response(null, { status: 303, headers: response })
    },
    remove,
  }
}

// Payload endpoints and server components share one bounded store, including during hot reload.
const runtime = globalThis as typeof globalThis & { terraceEditorialSession?: ReturnType<typeof createEditorialSession> }
export function editorialSession() {
  if (!runtime.terraceEditorialSession) {
    const settings = editorialSettings()
    runtime.terraceEditorialSession = createEditorialSession(settings, createProvider(settings))
  }
  return runtime.terraceEditorialSession
}
