/**
 * The one definition of a valid application, shared by the public intake endpoint and the operator roster tool
 * (tools/roster-invite.ts), so the two can never drift apart.
 */
export type ValidApplication = { name: string; affiliation: 'current-member' | 'alumni'; classYear?: number; contactEmail: string; note?: string }

const emailShape = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/
export const text = (value: unknown, max: number, required = false): string | null | undefined => {
  if (value == null || value === '') return required ? null : undefined
  return typeof value === 'string' && value.trim().length <= max && value.trim().length > 0 ? value.trim() : null
}

/** Pending applications are refused at this count, and reviewers are warned at the warning level. */
export const MAX_PENDING = 500
export const WARN_PENDING = Math.floor(MAX_PENDING * 0.8)

/** Validate untrusted application fields. Returns the normalised application (email lower-cased), or null when any field is invalid. */
export function parseApplication(data: Record<string, unknown>): ValidApplication | null {
  const name = text(data.name, 120, true)
  const email = text(data.contactEmail, 254, true)?.toLowerCase()
  const affiliation = data.affiliation
  const note = text(data.note, 1000)
  const classYear = data.classYear == null || data.classYear === '' ? undefined : Number(data.classYear)
  if (!name || !email || !emailShape.test(email) || (affiliation !== 'current-member' && affiliation !== 'alumni') || note === null ||
      (classYear !== undefined && (!Number.isInteger(classYear) || classYear < 1904 || classYear > 2200))) return null
  return { name, affiliation, classYear, contactEmail: email, note }
}
