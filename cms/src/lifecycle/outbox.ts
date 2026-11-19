import { randomBytes } from 'node:crypto'
import { chmodSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeSync } from 'node:fs'
import { resolve } from 'node:path'
import { APIError, type Payload, type PayloadRequest } from 'payload'
import { publicOrigin } from '../auth/production-input'
import { invitationTtlMs } from './policy'
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

/**
 * Write a file all at once: a private temporary file in the same directory (mode 0600), synced to disk,
 * then renamed over the target. A reader or a crash sees the old file or the complete new one, never a partial one.
 * Temporary names end in `.tmp`, so mirror listings (`*.json`) never pick them up.
 */
export function writeFileAtomic(file: string, content: string): void {
  const temporary = `${file}.${randomBytes(6).toString('hex')}.tmp`
  const handle = openSync(temporary, 'wx', 0o600)
  try {
    try { writeSync(handle, content); fsyncSync(handle) } finally { closeSync(handle) }
    renameSync(temporary, file)
  } catch (error) { rmSync(temporary, { force: true }); throw error }
  try { const directory = openSync(resolve(file, '..'), 'r'); try { fsyncSync(directory) } finally { closeSync(directory) } } catch { /* directory sync is best effort */ }
}

/** Insert the outbox row only. Inside a transaction nothing outside the database changes. */
export async function recordMessage(payload: Payload, message: OutboxMessage, req?: PayloadRequest): Promise<Recorded> {
  const record = await payload.create({
    collection: 'message-outbox', overrideAccess: true, req,
    data: { kind: message.kind, recipientEmail: message.recipientEmail ?? undefined, recipientLabel: message.recipientLabel, subject: message.subject, body: message.body, status: 'queued', dedupeKey: message.dedupeKey },
  })
  return { id: Number(record.id), createdAt: record.createdAt, message }
}

/**
 * Write the file copy of a recorded message with owner-only permissions. Throws if the file cannot be
 * written. Returns true only when the complete file is in place (atomic rename); false (a no-op) without LIFECYCLE_OUTBOX_DIR.
 */
export function writeMirror(recorded: Recorded): boolean {
  const directory = process.env.LIFECYCLE_OUTBOX_DIR
  if (!directory) return false
  const { id, createdAt, message } = recorded
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  chmodSync(directory, 0o700)
  const file = resolve(directory, `${prefix(id)}${message.kind}.json`)
  writeFileAtomic(file, JSON.stringify({ id, kind: message.kind, to: message.recipientEmail ?? message.recipientLabel, subject: message.subject, body: message.mirrorBody ?? message.body, createdAt }, null, 2))
  return true
}

/**
 * Append a message to the outbox. There is no mail transport: the database record is the audit
 * trail, and when LIFECYCLE_OUTBOX_DIR is set a file copy, including any mirror-only text, is written
 * there. `bestEffortMirror` records the row and carries on if the file cannot be written.
 */
export async function enqueueMessage(payload: Payload, message: OutboxMessage, req?: PayloadRequest, options: { bestEffortMirror?: boolean } = {}): Promise<number> {
  const recorded = await recordMessage(payload, message, req)
  try { if (writeMirror(recorded)) await markMirrored(payload, recorded.id, req) } catch (error) { if (!options.bestEffortMirror) throw error }
  return recorded.id
}

// Loopback, unspecified, trailing-dot and IPv6-literal hosts are never a valid public origin.
const LOOPBACK = /^(localhost|.*\.localhost|0\.0\.0\.0|127(\.\d{1,3}){3}|\[.*\]|.*\.)$/i
const localDevelopment = (env: NodeJS.ProcessEnv) => env.CMS_LOCAL_BOOTSTRAP === '1' && env.NODE_ENV !== 'production'

/**
 * Delivery settings. Invitation links exist only in the file mirror, so an invitation cannot be
 * issued without a directory an operator can read. Only the explicit local-development profile
 * (CMS_LOCAL_BOOTSTRAP=1, never with NODE_ENV=production) may use the loopback default origin; every
 * other deployment must name a bare public https origin, or approval fails closed.
 */
export function deliveryConfig(env: NodeJS.ProcessEnv = process.env): { directory: string; origin: string } {
  const directory = env.LIFECYCLE_OUTBOX_DIR
  const origin = env.LIFECYCLE_PUBLIC_ORIGIN
  if (!directory) throw new APIError('Invitation delivery is not configured: set LIFECYCLE_OUTBOX_DIR.', 503)
  if (!localDevelopment(env) || origin) {
    let valid = false
    try {
      const url = new URL(origin ?? '')
      const local = localDevelopment(env) && url.protocol === 'http:' && LOOPBACK.test(url.hostname) && !url.username && !url.password && url.origin === origin
      // Everything else must pass the one shared public-origin validator (also used by the CMS runtime policy).
      valid = local || publicOrigin(origin) === origin
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
    writeFileAtomic(file, JSON.stringify({ ...message, ...REDACTED }, null, 2))
    count++
  }
  return count
}

/**
 * Record that a message's file copy was confirmed in place (`mirrored_at`). With `req` the mark joins that
 * transaction (the row may not be committed yet); without it the mark is a plain statement.
 */
export async function markMirrored(payload: Payload, id: number, req?: PayloadRequest): Promise<void> {
  if (req) await payload.update({ collection: 'message-outbox', id, overrideAccess: true, req, context: { markMirrored: true }, data: { mirroredAt: new Date().toISOString() } })
  else await pool(payload).query(`UPDATE message_outbox SET mirrored_at = now() WHERE id = $1 AND mirrored_at IS NULL`, [id])
}

export type MirrorReport = { redacted: number; written: number; failed?: number; undeliverable?: number[] }

/**
 * Finish what the database already decided, for every outbox row that should have a file copy:
 * redact files of rows that erasure redacted, and write copies that are missing. Safe to repeat; the sweep
 * runs it so a failed file step is retried. A row is marked only after its file is confirmed in place; a failed
 * write leaves it pending and never stops the other rows (`failed` counts them).
 *
 * Rows whose file already exists are just marked. Missing files are rebuilt from the database for every kind
 * except an invitation: its link exists only in the file and the plaintext token cannot be recovered (only its
 * hash is stored), so an invitation without a file is reported as `undeliverable` (reissue the invitation) while
 * it could still be redeemed, and is never re-derived.
 */
export async function reconcileMirror(payload: Payload): Promise<MirrorReport> {
  const directory = process.env.LIFECYCLE_OUTBOX_DIR
  if (!directory) return { redacted: 0, written: 0 }
  const rows = (await pool(payload).query(`SELECT id, kind, recipient_email, recipient_label, subject, body, created_at, mirrored_at FROM message_outbox WHERE recipient_label = 'Former member' OR mirrored_at IS NULL ORDER BY id`)).rows
  const invitationCutoff = Date.now() - invitationTtlMs()
  let redacted = 0
  let written = 0
  let failed = 0
  const undeliverable: number[] = []
  for (const row of rows) {
    const id = Number(row.id)
    try {
      if (row.recipient_label === 'Former member') {
        redacted += redactMirrorFiles([String(id)])
        if (!row.mirrored_at) await markMirrored(payload, id)
      } else if (existsSync(directory) && mirrorFiles(directory, [id]).some((file) => statSync(file).isFile())) {
        await markMirrored(payload, id)
      } else if (row.kind === 'invitation') {
        if (new Date(String(row.created_at)).getTime() > invitationCutoff) undeliverable.push(id)
      } else {
        const to = row.recipient_email ? String(row.recipient_email) : undefined
        // Written once: marking the row means a file the operator later deletes is not recreated.
        const wrote = writeMirror({ id, createdAt: new Date(String(row.created_at)).toISOString(), message: { kind: row.kind as OutboxKind, recipientEmail: to, recipientLabel: String(row.recipient_label), subject: String(row.subject), body: String(row.body) } })
        if (!wrote) { failed++; continue }
        await markMirrored(payload, id)
        written++
      }
    } catch { failed++ }
  }
  return { redacted, written, ...(failed ? { failed } : {}), ...(undeliverable.length ? { undeliverable } : {}) }
}
