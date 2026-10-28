import type { Access, FieldAccess } from 'payload'

function roleOf(user: unknown): unknown {
  return user && typeof user === 'object' && 'role' in user ? user.role : undefined
}

export const isMember = (user: unknown): boolean => roleOf(user) === 'admin' || roleOf(user) === 'editor'
export const isAdmin = (user: unknown): boolean => roleOf(user) === 'admin'

export const memberOnly: Access = ({ req }) => isMember(req.user) || false
export const adminOnly: Access = ({ req }) => isAdmin(req.user) || false
export const adminField: FieldAccess = ({ req }) => isAdmin(req.user) || false

export const publishedOrMember: Access = ({ req }) =>
  isMember(req.user) || { _status: { equals: 'published' } }

export const publicMediaOrMember: Access = ({ req }) =>
  isMember(req.user) || { public: { equals: true } }

export const activeRedirectOrMember: Access = ({ req }) =>
  isMember(req.user) || { active: { equals: true } }
