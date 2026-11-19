import type { CollectionConfig } from 'payload'
import { adminOnly } from '../access/rules'

// Journal of bulk roster runs (tools/roster-invite.ts; docs/member-lifecycle.md, "Bulk roster onboarding"). Administrator-readable
// and written only by the tool through the local API. It holds ids, counts and keyed row hashes, never a name or an address.
const journalAccess = { read: adminOnly, create: () => false, update: () => false, delete: () => false }
const readOnly = { readOnly: true }
const group = 'Member lifecycle'

export const RosterRuns: CollectionConfig = {
  slug: 'roster-runs',
  admin: { group, useAsTitle: 'runId', defaultColumns: ['runId', 'status', 'operator', 'startedAt'], hidden: ({ user }) => (user as { role?: string } | null)?.role !== 'admin' },
  access: journalAccess,
  fields: [
    { name: 'runId', type: 'text', required: true, unique: true, admin: readOnly },
    { name: 'operator', type: 'relationship', relationTo: 'users', required: true, admin: readOnly },
    { name: 'status', type: 'select', required: true, defaultValue: 'running', options: ['running', 'completed', 'failed', 'rolled-back'], admin: readOnly },
    { name: 'fileSha256', type: 'text', admin: readOnly },
    { name: 'planSha256', type: 'text', admin: readOnly },
    { name: 'counts', type: 'json', admin: readOnly },
    { name: 'startedAt', type: 'date', required: true, admin: readOnly },
    { name: 'finishedAt', type: 'date', admin: readOnly },
    { name: 'rolledBackAt', type: 'date', admin: readOnly },
  ],
}

export const RosterRunItems: CollectionConfig = {
  slug: 'roster-run-items',
  admin: { group, useAsTitle: 'rowNumber', defaultColumns: ['run', 'rowNumber', 'state', 'application'], hidden: ({ user }) => (user as { role?: string } | null)?.role !== 'admin' },
  access: journalAccess,
  fields: [
    { name: 'run', type: 'relationship', relationTo: 'roster-runs', required: true, index: true, admin: readOnly },
    { name: 'rowNumber', type: 'number', required: true, admin: readOnly },
    // A keyed (HMAC) hash of the row, so the journal cannot be used to guess who is on a roster. Erasure clears it.
    { name: 'rowHash', type: 'text', admin: readOnly },
    { name: 'application', type: 'relationship', relationTo: 'member-applications', index: true, admin: readOnly },
    { name: 'invitation', type: 'relationship', relationTo: 'member-invitations', admin: readOnly },
    { name: 'state', type: 'select', required: true, defaultValue: 'applied', options: ['applied', 'rolled-back'], admin: readOnly },
  ],
}

export const rosterCollections = [RosterRuns, RosterRunItems]
