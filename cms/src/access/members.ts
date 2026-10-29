import type { PayloadRequest } from 'payload'

export const memberRoles = ['current-member', 'alumni'] as const
export type MemberRole = typeof memberRoles[number]

export function isMember(req: Pick<PayloadRequest, 'user'>): boolean {
  const user = req.user as unknown as { collection?: string; id?: unknown; roles?: unknown } | null
  return user?.collection === 'members' && Number.isSafeInteger(user.id) && Number(user.id) > 0 &&
    Array.isArray(user.roles) && user.roles.some((role) => memberRoles.includes(role))
}

export function memberId(req: Pick<PayloadRequest, 'user'>): number | null {
  return isMember(req) ? Number(req.user!.id) : null
}
