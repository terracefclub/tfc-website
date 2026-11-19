import { createHash } from 'node:crypto'
import { APIError, type CollectionConfig } from 'payload'
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
          let created = false
          if (!user) {
            try {
              user = await payload.create({ collection: 'members', data: { identityKey, ...claims }, overrideAccess: true })
              created = true
            } catch {
              user = (await find()).docs[0]
              if (!user) return { user: null }
            }
          }
          // Offboarded and erased members fail closed here, whatever the identity provider still says.
          if ((user.status ?? 'active') !== 'active') return { user: null }
          // Bind the person to their redeemed invitation and application (lifecycle/linking.ts): right after the member row
          // is created, and later only while a quick check finds a redeemed, unlinked invitation for this verified address.
          // Never fatal: a failure only leaves the link for the next call or for an administrator.
          if (contactEmail) await linkMemberToApplications(payload, Number(user.id), contactEmail, { created }).catch(() => undefined)
          return { user: { ...user, ...claims, collection: 'members' as const }, responseHeaders: new Headers({ 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' }) }
        } catch {
          return { user: null }
        }
      },
    }],
  },
  hooks: {
    // Payload does not access-check `sort`, so an administrator could order the list by a hidden field and learn from the order. Only these are allowed.
    beforeOperation: [({ args, operation }) => {
      const sort = operation === 'read' ? (args as { sort?: string | string[] }).sort : undefined
      if (sort === undefined) return args
      const allowed = ['displayName', 'createdAt']
      if (!(Array.isArray(sort) ? sort : [sort]).every((entry) => typeof entry === 'string' && allowed.includes(entry.replace(/^-/, '')))) throw new APIError('Sort by display name or created date only.', 400)
      return args
    }],
    afterMe: [({ req, response }) => isMember(req) ? { user: { id: req.user!.id, collection: 'members', subject: req.user!.subject, displayName: req.user!.displayName, roles: req.user!.roles } } : response] },
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
