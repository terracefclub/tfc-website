import type { CollectionConfig } from 'payload'
import { activeRedirectOrMember } from '@/access/rules'
import { editorialAccess } from './shared'

export const Redirects: CollectionConfig = {
  slug: 'redirects',
  admin: { useAsTitle: 'sourcePath' },
  access: { ...editorialAccess, read: activeRedirectOrMember },
  fields: [
    { name: 'sourcePath', type: 'text', required: true, unique: true, validate: (value: unknown) => typeof value === 'string' && /^\/(?!\/)[a-zA-Z0-9/_-]*$/.test(value) || 'Use a local path beginning with one slash.' },
    { name: 'destinationUrl', type: 'text', required: true, validate: (value: unknown) => typeof value === 'string' && (/^https:\/\/[^\s]+$/.test(value) || /^\/(?!\/)[a-zA-Z0-9/_-]*$/.test(value)) || 'Use HTTPS or a local path.' },
    { name: 'statusCode', type: 'select', required: true, defaultValue: '302', options: ['301', '302'] },
    { name: 'active', type: 'checkbox', defaultValue: false },
  ],
}
