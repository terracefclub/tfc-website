import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { APIError, type Payload, type PayloadRequest } from 'payload'
import { pool } from './visibility'

export type OutboxKind = 'invitation' | 'denial' | 'offboarding' | 'erasure-confirmation' | 'staff-notice'
export type OutboxMessage = {
  kind: OutboxKind
  recipientEmail?: string | null
  recipientLabel: string
  subject: string
  /** Text stored in the database. Never include a token or link here. */
  body: string
  /** Optional full text for the local file mirror only (for example the redeem link). */
  mirrorBody?: string
  /** At most one message per key may exist (for example one staff notice a day). */
  dedupeKey?: string
}
export type Recorded = { id: number; createdAt: string; message: OutboxMessage }

const REDACTED = { to: 'Former member', body: 'Redacted after erasure.' }
const prefix = (id: number | string) => `${String(id).padStart(6, '0')}-`

/** Insert the outbox row only. Inside a transaction nothing outside the database changes. */
export async function recordMessage(payload: Payload, message: OutboxMessage, req?: PayloadRequest): Promise<Recorded> {
  const record = await payload.create({
    collection: 'message-outbox', overrideAccess: true, req,
    data: { kind: message.kind, recipientEmail: message.recipientEmail ?? undefined, recipientLabel: message.recipientLabel, subject: message.subject, body: message.body, status: 'queued', dedupeKey: message.dedupeKey },
  })
  return { id: Number(record.id), createdAt: record.createdAt, message }
}

/** Write the file copy of a recorded message with owner-only permissions. A no-op without LIFECYCLE_OUTBOX_DIR. */
export function writeMirror(recorded: Recorded): void {
  const directory = process.env.LIFECYCLE_OUTBOX_DIR
  if (!directory) return
  const { id, createdAt, message } = recorded
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  chmodSync(directory, 0o700)
  const file = resolve(directory, `${prefix(id)}${message.kind}.json`)
  writeFileSync(file, JSON.stringify({ id, kind: message.kind, to: message.recipientEmail ?? message.recipientLabel, subject: message.subject, body: message.mirrorBody ?? message.body, createdAt }, null, 2), { mode: 0o600 })
  chmodSync(file, 0o600)
}

/**
 * Append a message to the outbox. There is no mail transport: the database record is the audit
 * trail, and when LIFECYCLE_OUTBOX_DIR is set a file copy, including any mirror-only text, is written
 * there. `bestEffortMirror` records the row and carries on if the file cannot be written.
 */
export async function enqueueMessage(payload: Payload, message: OutboxMessage, req?: PayloadRequest, options: { bestEffortMirror?: boolean } = {}): Promise<number> {
  const recorded = await recordMessage(payload, message, req)
  try { writeMirror(recorded) } catch (error) { if (!options.bestEffortMirror) throw error }
  return recorded.id
}

// Loopback, unspecified, trailing-dot and IPv6-literal hosts are never a valid public origin.
const LOOPBACK = /^(localhost|.*\.localhost|0\.0\.0\.0|127(\.\d{1,3}){3}|\[.*\]|.*\.)$/i
const localDevelopment = () => process.env.CMS_LOCAL_BOOTSTRAP === '1' && process.env.NODE_ENV !== 'production'

/**
 * Delivery settings. Invitation links exist only in the file mirror, so an invitation cannot be
 * issued without a directory an operator can read. Only the explicit local-development profile
 * (CMS_LOCAL_BOOTSTRAP=1, never with NODE_ENV=production) may use the loopback default origin; every
 * other deployment must name a bare public https origin, or approval fails closed.
 */
export function deliveryConfig(): { directory: string; origin: string } {
  const directory = process.env.LIFECYCLE_OUTBOX_DIR
  const origin = process.env.LIFECYCLE_PUBLIC_ORIGIN
  if (!directory) throw new APIError('Invitation delivery is not configured: set LIFECYCLE_OUTBOX_DIR.', 503)
  if (!localDevelopment() || origin) {
    let valid = false
    try {
      const url = new URL(origin ?? '')
      const local = localDevelopment() && url.protocol === 'http:' && LOOPBACK.test(url.hostname)
      valid = (local || url.protocol === 'https:' && !LOOPBACK.test(url.hostname)) && !url.username && !url.password && url.origin === origin
    } catch { /* invalid */ }
    if (!valid) throw new APIError('Invitation delivery is not configured: set LIFECYCLE_PUBLIC_ORIGIN to a bare public https origin.', 503)
  }
  return { directory, origin: origin || 'http://127.0.0.1:4194' }
}

function mirrorFiles(directory: string, ids: Array<number | string>): string[] {
  const wanted = ids.map(prefix)
  return readdirSync(directory).filter((name) => name.endsWith('.json') && wanted.some((start) => name.startsWith(start))).map((name) => resolve(directory, name))
}

/** Rewrite mirror files of the given outbox ids as redacted. Idempotent; throws if a file cannot be rewritten. */
export function redactMirrorFiles(ids: Array<number | string>): number {
  const directory = process.env.LIFECYCLE_OUTBOX_DIR
  if (!directory || !existsSync(directory) || !ids.length) return 0
  let count = 0
  for (const file of mirrorFiles(directory, ids)) {
    const message = JSON.parse(readFileSync(file, 'utf8'))
    if (message.to === REDACTED.to && message.body === REDACTED.body) continue
    writeFileSync(file, JSON.stringify({ ...message, ...REDACTED }, null, 2), { mode: 0o600 })
    count++
  }
  return count
}

/** Record that a message's file copy was written (reusing the otherwise unused dedupe key), so it is not written again. */
export async function markMirrored(payload: Payload, id: number): Promise<void> {
  await pool(payload).query(`UPDATE message_outbox SET dedupe_key = $2 WHERE id = $1 AND dedupe_key IS NULL`, [id, `mirrored:${id}`])
}

/**
 * Finish what the database already decided: redact files of rows that erasure redacted and write
 * missing erasure confirmation files. Safe to repeat; the sweep runs it so a failed file step is retried.
 */
export async function reconcileMirror(payload: Payload): Promise<{ redacted: number; written: number }> {
  const directory = process.env.LIFECYCLE_OUTBOX_DIR
  if (!directory) return { redacted: 0, written: 0 }
  const rows = (await pool(payload).query(`SELECT id, kind, recipient_label, subject, body, created_at, dedupe_key FROM message_outbox WHERE recipient_label = 'Former member' OR (kind = 'erasure-confirmation' AND dedupe_key IS NULL)`)).rows
  let redacted = 0
  let written = 0
  for (const row of rows) {
    if (row.recipient_label === 'Former member') redacted += redactMirrorFiles([String(row.id)])
    else {
      // Written once: marking the row means a file the operator later deleted is not recreated.
      writeMirror({ id: Number(row.id), createdAt: new Date(String(row.created_at)).toISOString(), message: { kind: 'erasure-confirmation', recipientLabel: String(row.recipient_label), subject: String(row.subject), body: String(row.body) } })
      await markMirrored(payload, row.id as number)
      written++
    }
  }
  return { redacted, written }
}
