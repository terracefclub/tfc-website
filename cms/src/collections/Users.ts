import { AuthenticationError, type CollectionConfig } from 'payload'
import { adminField, adminOnly, isAdmin, isMember } from '@/access/rules'
import { editorialEnabled, editorialSettings } from '@/auth/editorial-policy'
import { editorialSession } from '@/auth/editorial-session'
import { editorialStrategy } from '@/auth/editorial'

const sso = editorialEnabled()
if (sso) editorialSettings()

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    tokenExpiration: 60 * 60 * 8, maxLoginAttempts: 5, lockTime: 15 * 60 * 1000,
    ...(sso ? { disableLocalStrategy: { enableFields: true }, removeTokenFromResponses: true, useSessions: false, strategies: [editorialStrategy] } : {}),
  },
  admin: { useAsTitle: 'displayName' },
  hooks: sso ? {
    me: [async ({ args, user }) => {
      const session = await editorialSession().resolve(args.req.headers, args.req.method)
      if (!session) throw new Error('Editorial session expired.')
      return { user: { ...user, role: session.claims.role, displayName: session.claims.displayName }, exp: session.expires }
    }],
    refresh: [async ({ args, user }) => {
      const session = await editorialSession().resolve(args.req.headers, args.req.method)
      if (!session) throw new Error('Editorial session expired.')
      return { user: { ...user, role: session.claims.role, displayName: session.claims.displayName }, exp: session.expires, refreshedToken: '', setCookie: false }
    }],
    afterLogout: [async ({ req }) => { await editorialSession().remove(req.headers) }],
  } : {
    beforeLogin: [({ user }) => {
      if (user.identityKey) throw new AuthenticationError()
    }],
  },
  access: {
    admin: ({ req }) => isMember(req.user),
    create: sso ? () => false : adminOnly,
    read: ({ req }) => isAdmin(req.user) || (isMember(req.user) ? { id: { equals: req.user!.id } } : false),
    update: sso ? () => false : ({ req, id }) => isAdmin(req.user) || (isMember(req.user) && String(req.user!.id) === String(id)),
    delete: sso ? () => false : adminOnly,
  },
  fields: [
    { name: 'identityKey', type: 'text', unique: true, admin: { hidden: true }, access: { read: () => false, create: () => false, update: () => false } },
    { name: 'displayName', type: 'text', required: true },
    { name: 'role', type: 'select', required: true, defaultValue: 'editor', options: ['editor', 'admin'], access: { update: sso ? () => false : adminField }, admin: { readOnly: sso, description: sso ? 'Editorial permissions are managed in Terrace Keycloak.' : 'Only administrators can grant the administrator role.' } },
  ],
}
