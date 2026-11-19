/**
 * Lifecycle timings. Every value is a PLACEHOLDER pending owner decision (see
 * docs/member-lifecycle.md, "Decisions the owner still owes"). They can be
 * overridden by environment variable without a code change.
 */
function days(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback)
  return Number.isInteger(value) && value >= 1 && value <= 3650 ? value : fallback
}

const DAY = 86_400_000
export const invitationTtlMs = () => days('LIFECYCLE_INVITATION_DAYS', 7) * DAY
/** Pending applications older than this are withdrawn automatically so the queue cannot be filled and left full. */
export const applicationTtlMs = () => days('LIFECYCLE_APPLICATION_DAYS', 60) * DAY
export const graceMs = () => days('LIFECYCLE_GRACE_DAYS', 30) * DAY
/** The in-session erasure confirmation window. A security timeout, not a retention period. */
export const erasureConfirmMs = 15 * 60_000
export const memberRoles = ['current-member', 'alumni'] as const
export type GrantRole = typeof memberRoles[number]
