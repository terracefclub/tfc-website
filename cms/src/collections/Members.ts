import { createHash } from 'node:crypto'
import type { CollectionConfig } from 'payload'
import { isMember, memberId } from '../access/members'
import { isAdmin } from '../access/rules'
import { verifyMemberToken } from '../auth/keycloak'
import { linkMemberToApplications } from '../lifecycle/linking'

export const Members: CollectionConfig = {
  slug: 'members',
  // Hidden from the navigation. Administrators read it only to pick a member in a relationship field (display name
  // and status; see the access rules below). Nothing here can be created, changed or deleted through the API.
  admin: { hidden: true, useAsTitle: 'displayName', listSearchableFields: ['displayName'], defaultColumns: ['displayName', 'status'] },
  auth: {
    disableLocalStrategy: true,
    removeTokenFromResponses: true,
    strategies: [{
      name: 'terrace-keycloak',
      authenticate: async ({ headers, payload }) => {
        const authorization = headers.get('authorization')
        if (!authorization?.startsWith('Bearer ')) return { user: null }
        try {
          const { contactEmail, ...claims } = await verifyMemberToken(authorization.slice(7))
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
          // Offboarded and erased members fail closed here, whatever the identity provider still says.
          if ((user.status ?? 'active') !== 'active') return { user: null }
          // First sign-in binds the person to their redeemed invitation and application (lifecycle/linking.ts).
          // Never fatal: a failure here only leaves the link for the next call or the sweep's backfill.
          if (contactEmail) await linkMemberToApplications(payload, Number(user.id), contactEmail).catch(() => undefined)
          return { user: { ...user, ...claims, collection: 'members' as const }, responseHeaders: new Headers({ 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' }) }
        } catch {
          return { user: null }
        }
      },
    }],
  },
  hooks: { afterMe: [({ req, response }) => isMember(req) ? { user: { id: req.user!.id, collection: 'members', subject: req.user!.subject, displayName: req.user!.displayName, roles: req.user!.roles } } : response] },
  // A member reads only their own row. An administrator (not an editor) may list and search members so the admin UI
  // can link an application or invitation and offboard someone; identity fields, roles and the status timestamp are
  // field-protected below. Anonymous, unapproved, editor and offboarded callers read nothing.
  access: { admin: () => false, create: () => false, read: ({ req }) => isAdmin(req.user) ? true : isMember(req) ? { id: { equals: memberId(req) } } : false, update: () => false, delete: () => false },
  fields: [
    { name: 'identityKey', type: 'text', required: true, unique: true, access: { read: () => false } },
    { name: 'issuer', type: 'text', required: true, access: { read: () => false } },
    { name: 'subject', type: 'text', required: true, access: { read: () => false } },
    { name: 'displayName', type: 'text', required: true, maxLength: 120 },
    { name: 'roles', type: 'select', hasMany: true, options: ['current-member', 'alumni'], access: { read: ({ req }) => isMember(req) } },
    { name: 'status', type: 'select', required: true, defaultValue: 'active', options: ['active', 'offboarded', 'erased'], access: { create: () => false, update: () => false } },
    { name: 'statusChangedAt', type: 'date', access: { create: () => false, update: () => false, read: () => false } },
  ],
}
