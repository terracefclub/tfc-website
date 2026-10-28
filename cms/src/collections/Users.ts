import type { CollectionConfig } from 'payload'
import { adminField, adminOnly, isAdmin, memberOnly } from '@/access/rules'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: { tokenExpiration: 60 * 60 * 8, maxLoginAttempts: 5, lockTime: 15 * 60 * 1000 },
  admin: { useAsTitle: 'email' },
  access: {
    admin: ({ req }) => !!req.user,
    create: adminOnly,
    read: ({ req }) => isAdmin(req.user) || (req.user ? { id: { equals: req.user.id } } : false),
    update: ({ req, id }) => isAdmin(req.user) || (!!req.user && String(req.user.id) === String(id)),
    delete: adminOnly,
  },
  fields: [
    { name: 'displayName', type: 'text', required: true },
    { name: 'role', type: 'select', required: true, defaultValue: 'editor', options: ['editor', 'admin'], access: { update: adminField }, admin: { description: 'Only administrators can grant the administrator role.' } },
  ],
}
