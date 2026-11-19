import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Payload, PayloadRequest } from 'payload'

export type OutboxKind = 'invitation' | 'denial' | 'offboarding' | 'erasure-confirmation'
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
    const file = resolve(directory, `${String(record.id).padStart(6, '0')}-${message.kind}.json`)
    writeFileSync(file, JSON.stringify({ id: record.id, kind: message.kind, to: message.recipientEmail ?? message.recipientLabel, subject: message.subject, body: message.mirrorBody ?? message.body, createdAt: record.createdAt }, null, 2), { mode: 0o600 })
    chmodSync(file, 0o600)
  }
  return Number(record.id)
}

export function publicOrigin(): string {
  return (process.env.LIFECYCLE_PUBLIC_ORIGIN || 'http://127.0.0.1:4194').replace(/\/$/, '')
}
