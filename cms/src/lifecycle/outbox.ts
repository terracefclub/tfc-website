import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { APIError, type Payload, type PayloadRequest } from 'payload'

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
}

/**
 * Append a message to the outbox. There is no mail transport: the database record is the
 * audit trail, and when LIFECYCLE_OUTBOX_DIR is set (local preview) a file copy, including any
 * mirror-only text, is written there with owner-only permissions.
 */
export async function enqueueMessage(payload: Payload, message: OutboxMessage, req?: PayloadRequest): Promise<number> {
  const record = await payload.create({
    collection: 'message-outbox', overrideAccess: true, req,
    data: { kind: message.kind, recipientEmail: message.recipientEmail ?? undefined, recipientLabel: message.recipientLabel, subject: message.subject, body: message.body, status: 'queued' },
  })
  const directory = process.env.LIFECYCLE_OUTBOX_DIR
  if (directory) {
    mkdirSync(directory, { recursive: true, mode: 0o700 })
    chmodSync(directory, 0o700)
    const file = resolve(directory, `${String(record.id).padStart(6, '0')}-${message.kind}.json`)
    writeFileSync(file, JSON.stringify({ id: record.id, kind: message.kind, to: message.recipientEmail ?? message.recipientLabel, subject: message.subject, body: message.mirrorBody ?? message.body, createdAt: record.createdAt }, null, 2), { mode: 0o600 })
    chmodSync(file, 0o600)
  }
  return Number(record.id)
}

/**
 * Delivery settings. Invitation links exist only in the file mirror, so an invitation cannot be
 * issued without a directory an operator can read, and in production the link origin must be an
 * explicit public https origin rather than the loopback default.
 */
export function deliveryConfig(): { directory: string; origin: string } {
  const directory = process.env.LIFECYCLE_OUTBOX_DIR
  const origin = process.env.LIFECYCLE_PUBLIC_ORIGIN
  const production = process.env.NODE_ENV === 'production'
  if (!directory) throw new APIError('Invitation delivery is not configured: set LIFECYCLE_OUTBOX_DIR.', 503)
  if (production) {
    let valid = false
    try { const url = new URL(origin ?? ''); valid = url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) } catch { /* invalid */ }
    if (!valid) throw new APIError('Invitation delivery is not configured: set LIFECYCLE_PUBLIC_ORIGIN to the public https origin.', 503)
  }
  return { directory, origin: (origin || 'http://127.0.0.1:4194').replace(/\/$/, '') }
}

export const publicOrigin = () => deliveryConfig().origin

/** Redact local mirror files addressed to an erased person. */
export function scrubMirror(emails: string[]): number {
  const directory = process.env.LIFECYCLE_OUTBOX_DIR
  if (!directory || !existsSync(directory) || !emails.length) return 0
  let count = 0
  for (const name of readdirSync(directory)) {
    if (!name.endsWith('.json')) continue
    const file = resolve(directory, name)
    try {
      const message = JSON.parse(readFileSync(file, 'utf8'))
      if (typeof message.to === 'string' && emails.includes(message.to.toLowerCase())) {
        writeFileSync(file, JSON.stringify({ ...message, to: 'Former member', body: 'Redacted after erasure.' }, null, 2), { mode: 0o600 })
        count++
      }
    } catch { /* not a mirror file */ }
  }
  return count
}
