import { createRemoteJWKSet, customFetch, jwtVerify, type JWTPayload } from 'jose'
import { memberRoles, type MemberRole } from '../access/members'

export type MemberClaims = { issuer: string; subject: string; displayName: string; roles: MemberRole[] }
export type KeycloakConfig = { issuer: string; audience: string; clientId: string; introspectionClientId: string; introspectionSecret: string }

export function keycloakConfig(env = process.env, prefix = 'MEMBER_AUTH'): KeycloakConfig | null {
  if (!env[`${prefix}_ISSUER`]) return null
  const issuer = new URL(env[`${prefix}_ISSUER`]!)
  if (issuer.username || issuer.password || issuer.search || issuer.hash || !/^\/realms\/[^/]+$/.test(issuer.pathname) ||
      (issuer.protocol !== 'https:' && !(issuer.protocol === 'http:' && issuer.hostname === '127.0.0.1'))) throw new Error('Invalid member identity issuer.')
  const values = ['AUDIENCE', 'CLIENT_ID', 'INTROSPECTION_CLIENT_ID', 'INTROSPECTION_SECRET'].map((key) => env[`${prefix}_${key}`])
  if (values.some((value) => !value)) throw new Error('Member identity configuration is incomplete.')
  return { issuer: issuer.href, audience: values[0]!, clientId: values[1]!, introspectionClientId: values[2]!, introspectionSecret: values[3]! }
}

export function approvedClaims(payload: JWTPayload, config: KeycloakConfig): MemberClaims {
  const realm = payload.realm_access as { roles?: unknown } | undefined
  const suppliedRoles = realm?.roles
  const roles = Array.isArray(suppliedRoles) ? memberRoles.filter((role) => suppliedRoles.includes(role)) : []
  if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 255 || payload.azp !== config.clientId || payload.typ !== 'Bearer' || roles.length === 0) throw new Error('Member access denied.')
  const name = typeof payload.name === 'string' ? payload.name : typeof payload.preferred_username === 'string' ? payload.preferred_username : 'Terran'
  return { issuer: config.issuer, subject: payload.sub, displayName: name.trim().slice(0, 120) || 'Terran', roles }
}

type Fetcher = (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => Promise<Response>

export function createKeycloakVerifier<T extends { subject: string }>(config: KeycloakConfig, claimsFromToken: (payload: JWTPayload, config: KeycloakConfig) => T, request: Fetcher = fetch) {
  const boundedFetch: Fetcher = (input, init) => request(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(4000) })
  const keys = createRemoteJWKSet(new URL(`${config.issuer}/protocol/openid-connect/certs`), { [customFetch]: boundedFetch, timeoutDuration: 4000 })
  return async (token: string): Promise<T> => {
    if (token.length > 16384) throw new Error('Member access denied.')
    const { payload } = await jwtVerify(token, keys, { issuer: config.issuer, audience: config.audience, algorithms: ['RS256'], requiredClaims: ['sub', 'exp', 'iat', 'jti'], maxTokenAge: 65, clockTolerance: 0 })
    const claims = claimsFromToken(payload, config)
    const response = await boundedFetch(`${config.issuer}/protocol/openid-connect/token/introspect`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token, client_id: config.introspectionClientId, client_secret: config.introspectionSecret }),
    })
    if (!response.ok || Number(response.headers.get('content-length') ?? 0) > 65536) throw new Error('Member access denied.')
    const text = await response.text()
    if (text.length > 65536) throw new Error('Member access denied.')
    const active = JSON.parse(text) as { active?: boolean; sub?: string; exp?: number }
    if (active.active !== true || active.sub !== claims.subject || !active.exp || active.exp * 1000 <= Date.now()) throw new Error('Member access denied.')
    return claims
  }
}

export function createMemberVerifier(config: KeycloakConfig, request: Fetcher = fetch) {
  return createKeycloakVerifier(config, approvedClaims, request)
}

let verifier: ReturnType<typeof createMemberVerifier> | undefined
export async function verifyMemberToken(token: string): Promise<MemberClaims> {
  if (!verifier) {
    const config = keycloakConfig()
    if (!config) throw new Error('Member sign-in is unavailable.')
    verifier = createMemberVerifier(config)
  }
  return verifier(token)
}
