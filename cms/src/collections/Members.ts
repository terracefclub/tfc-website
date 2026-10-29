import { createHash } from 'node:crypto'
import type { CollectionConfig } from 'payload'
import { isMember, memberId } from '../access/members'
import { verifyMemberToken } from '../auth/keycloak'

export const Members: CollectionConfig = {
  slug: 'members',
  admin: { hidden: true },
  auth: {
    disableLocalStrategy: true,
    removeTokenFromResponses: true,
    strategies: [{
      name: 'terrace-keycloak',
      authenticate: async ({ headers, payload }) => {
        const authorization = headers.get('authorization')
        if (!authorization?.startsWith('Bearer ')) return { user: null }
        try {
          const claims = await verifyMemberToken(authorization.slice(7))
          const identityKey = createHash('sha256').update(`${claims.issuer}\0${claims.subject}`).digest('hex')
          const find = () => payload.find({ collection: 'members', where: { identityKey: { equals: identityKey } }, limit: 1, depth: 0, overrideAccess: true })
          let user = (await find()).docs[0]
          if (!user) {
            try {
              user = await payload.create({ collection: 'members', data: { identityKey, ...claims }, overrideAccess: true })
            } catch {
              user = (await find()).docs[0]
              if (!user) return { user: null }
            }
          }
          return { user: { ...user, ...claims, collection: 'members' as const }, responseHeaders: new Headers({ 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' }) }
        } catch {
          return { user: null }
        }
      },
    }],
  },
  hooks: { afterMe: [({ req, response }) => isMember(req) ? { user: { id: req.user!.id, collection: 'members', subject: req.user!.subject, displayName: req.user!.displayName, roles: req.user!.roles } } : response] },
  access: { admin: () => false, create: () => false, read: ({ req }) => isMember(req) ? { id: { equals: memberId(req) } } : false, update: () => false, delete: () => false },
  fields: [
    { name: 'identityKey', type: 'text', required: true, unique: true, access: { read: () => false } },
    { name: 'issuer', type: 'text', required: true, access: { read: () => false } },
    { name: 'subject', type: 'text', required: true, access: { read: () => false } },
    { name: 'displayName', type: 'text', required: true, maxLength: 120 },
    { name: 'roles', type: 'select', required: true, hasMany: true, options: ['current-member', 'alumni'] },
  ],
}
