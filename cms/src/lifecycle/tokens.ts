import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/** A 256-bit single-use token. The plaintext is returned once and never stored. */
export function newToken(): string { return randomBytes(32).toString('base64url') }
export const tokenShape = /^[A-Za-z0-9_-]{43}$/
export function hashToken(token: string): string { return createHash('sha256').update(token).digest('hex') }

export function constantTimeEqual(a: string, b: string): boolean {
  const left = createHash('sha256').update(a).digest()
  const right = createHash('sha256').update(b).digest()
  return timingSafeEqual(left, right)
}
