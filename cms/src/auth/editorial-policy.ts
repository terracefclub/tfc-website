import type { JWTPayload } from 'jose'
import { keycloakConfig, type KeycloakConfig } from './keycloak'

export type EditorialClaims = { issuer: string; subject: string; displayName: string; role: 'editor' | 'admin' }
export type EditorialSettings = KeycloakConfig & { secret: string; origin: string; secure: boolean }

export function editorialEnabled(env = process.env) {
  return Object.keys(env).some((name) => name.startsWith('CMS_AUTH_'))
}

export function editorialSettings(env = process.env): EditorialSettings {
  const config = keycloakConfig(env, 'CMS_AUTH')
  if (!config || !env.CMS_AUTH_CLIENT_SECRET || !env.CMS_ORIGIN) throw new Error('Editorial sign-in is not configured.')
  const origin = new URL(env.CMS_ORIGIN)
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/' ||
      (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && origin.hostname === '127.0.0.1'))) throw new Error('Invalid CMS origin.')
  return { ...config, secret: env.CMS_AUTH_CLIENT_SECRET, origin: origin.origin, secure: origin.protocol === 'https:' }
}

export function editorialCallbackURL(request: { headers: Headers; url?: string }, origin: string) {
  if (request.headers.get('host') !== new URL(origin).host || !request.url) throw new Error('Invalid callback host.')
  const incoming = new URL(request.url)
  // Next may use its internal listen address in req.url; the configured origin is canonical.
  return new URL(`${incoming.pathname}${incoming.search}`, origin)
}

export function editorialClaims(token: JWTPayload, config: KeycloakConfig): EditorialClaims {
  const roles = (token.realm_access as { roles?: unknown } | undefined)?.roles
  const role = Array.isArray(roles) && roles.includes('editorial-admin') ? 'admin'
    : Array.isArray(roles) && roles.includes('editorial-editor') ? 'editor' : null
  if (!role || typeof token.sub !== 'string' || !token.sub || token.sub.length > 255 || token.azp !== config.clientId || token.typ !== 'Bearer') throw new Error('Editorial access denied.')
  const name = typeof token.name === 'string' ? token.name : typeof token.preferred_username === 'string' ? token.preferred_username : 'Terrace editor'
  return { issuer: config.issuer, subject: token.sub, role, displayName: name.trim().slice(0, 120) || 'Terrace editor' }
}
