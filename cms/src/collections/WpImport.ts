import type { CollectionConfig } from 'payload'
import { adminOnly } from '@/access/rules'
import { never } from '../community/access'

// Ledger for the WordPress import job: one run row per apply and one journal row per write,
// holding the pre-image needed to roll the run back. Admin-readable, written only by the
// import tool through the local API.
const ledgerAccess = { read: adminOnly, create: never, update: never, delete: never }

export const WpImportRuns: CollectionConfig = {
  slug: 'wp-import-runs', admin: { useAsTitle: 'runId', group: 'WordPress import' }, access: ledgerAccess,
  fields: [
    { name: 'runId', type: 'text', required: true, unique: true },
    { name: 'status', type: 'select', required: true, options: ['running', 'completed', 'failed', 'rolled-back'] },
    { name: 'publish', type: 'checkbox', defaultValue: false },
    { name: 'startedAt', type: 'date', required: true },
    { name: 'finishedAt', type: 'date' },
    { name: 'rolledBackAt', type: 'date' },
    { name: 'sourceSha256', type: 'text' },
    { name: 'planSha256', type: 'text' },
    { name: 'counts', type: 'json' },
  ],
}

export const WpImportJournal: CollectionConfig = {
  slug: 'wp-import-journal', admin: { group: 'WordPress import', defaultColumns: ['runId', 'sequence', 'collection', 'action'] }, access: ledgerAccess,
  fields: [
    { name: 'runId', type: 'text', required: true, index: true },
    { name: 'sequence', type: 'number', required: true },
    { name: 'collection', type: 'text', required: true },
    { name: 'docId', type: 'text', required: true },
    { name: 'wpId', type: 'number', required: true },
    { name: 'action', type: 'select', required: true, options: ['created', 'updated'] },
    { name: 'preImage', type: 'json', admin: { description: 'Updates: importer-managed fields before the write. Creations: { createdStatus }.' } },
    { name: 'postHash', type: 'text', required: true },
  ],
}
