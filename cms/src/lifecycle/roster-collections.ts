import type { CollectionConfig } from 'payload'
import { adminOnly } from '../access/rules'

// Journal of bulk roster runs (tools/roster-invite.ts; docs/member-lifecycle.md, "Bulk roster onboarding"). Administrator-readable
// and written only by the tool through the local API. It holds ids, counts, hashes of the plan and the staff member's display name, never the name or address of anyone on a roster.
const journalAccess = { read: adminOnly, create: () => false, update: () => false, delete: () => false }
const readOnly = { readOnly: true }
const group = 'Member lifecycle'

export const RosterRuns: CollectionConfig = {
  slug: 'roster-runs',
  admin: { group, useAsTitle: 'runId', defaultColumns: ['runId', 'status', 'operator', 'startedAt'], hidden: ({ user }) => (user as { role?: string } | null)?.role !== 'admin' },
  access: journalAccess,
  fields: [
    { name: 'runId', type: 'text', required: true, unique: true, admin: readOnly },
    // The operator is an attribution claim (see docs/member-lifecycle.md). The label survives deleting the staff account.
    { name: 'operator', type: 'relationship', relationTo: 'users', admin: readOnly },
    { name: 'operatorLabel', type: 'text', admin: readOnly },
    { name: 'status', type: 'select', required: true, defaultValue: 'running', options: ['running', 'completed', 'failed', 'rolled-back'], admin: readOnly },
    { name: 'fileSha256', type: 'text', admin: readOnly },
    { name: 'planSha256', type: 'text', admin: readOnly },
    { name: 'runLimit', type: 'number', admin: readOnly },
    { name: 'reinviteLapsed', type: 'checkbox', defaultValue: false, admin: readOnly },
    { name: 'databaseIdentity', type: 'text', admin: readOnly },
    { name: 'counts', type: 'json', admin: readOnly },
    { name: 'startedAt', type: 'date', required: true, admin: readOnly },
    { name: 'finishedAt', type: 'date', admin: readOnly },
    { name: 'rolledBackAt', type: 'date', admin: readOnly },
    { name: 'rolledBackBy', type: 'relationship', relationTo: 'users', admin: readOnly },
    { name: 'rolledBackByLabel', type: 'text', admin: readOnly },
  ],
}

export const RosterRunItems: CollectionConfig = {
  slug: 'roster-run-items',
  admin: { group, useAsTitle: 'rowNumber', defaultColumns: ['run', 'rowNumber', 'state', 'application'], hidden: ({ user }) => (user as { role?: string } | null)?.role !== 'admin' },
  access: journalAccess,
  fields: [
    { name: 'run', type: 'relationship', relationTo: 'roster-runs', required: true, index: true, admin: readOnly },
    { name: 'rowNumber', type: 'number', required: true, admin: readOnly },
    { name: 'application', type: 'relationship', relationTo: 'member-applications', index: true, admin: readOnly },
    { name: 'invitation', type: 'relationship', relationTo: 'member-invitations', admin: readOnly },
    { name: 'state', type: 'select', required: true, defaultValue: 'applied', options: ['applied', 'rolled-back'], admin: readOnly },
  ],
}

export const rosterCollections = [RosterRuns, RosterRunItems]
