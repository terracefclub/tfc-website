import { createHash } from 'node:crypto'
import type { AuthStrategy, Endpoint, Payload, PayloadRequest } from 'payload'
import { editorialCallbackURL, editorialEnabled, editorialSettings, type EditorialClaims } from './editorial-policy'
import { editorialSession } from './editorial-session'

export async function provisionEditor(payload: Payload, claims: EditorialClaims) {
  const identityKey = createHash('sha256').update(`${claims.issuer}\0${claims.subject}`).digest('hex')
  const find = async () => (await payload.find({ collection: 'users', where: { identityKey: { equals: identityKey } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
  let user = await find()
  if (!user) {
    try {
      user = await payload.create({ collection: 'users', data: {
        identityKey, email: `oidc-${identityKey}@identity.terrace.invalid`, displayName: claims.displayName, role: claims.role,
      }, overrideAccess: true })
    } catch {
      user = await find()
      if (!user) throw new Error('Editorial account unavailable.')
    }
  }
  return { ...user, displayName: claims.displayName, role: claims.role, collection: 'users' as const, _strategy: 'terrace-editorial' }
}

export const editorialStrategy: AuthStrategy = {
  name: 'terrace-editorial',
  async authenticate({ headers, payload, req }) {
    if (!editorialEnabled()) return { user: null }
    try {
      const session = await editorialSession().resolve(headers, req?.method)
      if (!session) return { user: null, responseHeaders: editorialSession().headers() }
      return { user: await provisionEditor(payload, session.claims), responseHeaders: editorialSession().headers() }
    } catch { return { user: null } }
  },
}

async function endpoint(req: PayloadRequest, action: 'login' | 'callback' | 'logout') {
  try {
    const session = editorialSession()
    if (action !== 'callback' && !session.csrf(req.headers, 'POST')) return new Response(null, { status: 403, headers: session.headers() })
    if (action === 'login') return await session.begin(req.headers)
    if (action === 'logout') return await session.logout(req.headers)
    return await session.callback(req.headers, editorialCallbackURL(req, editorialSettings().origin), (claims) => provisionEditor(req.payload, claims))
  } catch {
    return new Response('Editorial sign-in is unavailable. Try again shortly.', { status: 503, headers: { 'Cache-Control': 'private, no-store', 'Content-Type': 'text/plain', 'Referrer-Policy': 'no-referrer' } })
  }
}

export const editorialEndpoints: Endpoint[] = [
  { path: '/editorial/login', method: 'post', handler: (req) => endpoint(req, 'login') },
  { path: '/editorial/callback', method: 'get', handler: (req) => endpoint(req, 'callback') },
  { path: '/editorial/logout', method: 'post', handler: (req) => endpoint(req, 'logout') },
]
