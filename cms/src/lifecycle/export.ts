import type { CollectionSlug, Payload } from 'payload'

const CAP = 2000

const pick = (doc: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.filter((key) => key in doc).map((key) => [key, doc[key]]))

/**
 * Own records only. Every query is filtered by the member's id here, not by relying on access
 * control. Identity fields never leave the server, nor does other people's text (for example a
 * mentorship request someone sent to this member). Content a moderator hid is the member's own and
 * is included, flagged `hiddenByModeration`. Each list holds at most 2000 records; a longer list is
 * cut and named in `truncated` rather than silently shortened.
 */
export async function buildExport(payload: Payload, memberId: number) {
  const truncated: string[] = []
  const fetch = async (name: string, collection: CollectionSlug, where: Record<string, unknown>, keys: string[]) => {
    const result = await payload.find({ collection, where: where as never, limit: CAP + 1, depth: 0, pagination: false, overrideAccess: true })
    if (result.docs.length > CAP) truncated.push(name)
    return result.docs.slice(0, CAP).map((doc) => {
      const record = doc as unknown as Record<string, unknown>
      return { ...pick(record, keys), ...('moderationHiddenAt' in record ? { hiddenByModeration: Boolean(record.moderationHiddenAt) } : {}) }
    })
  }
  const member = await payload.findByID({ collection: 'members', id: memberId, depth: 0, overrideAccess: true })
  const own = { member: { equals: memberId } }
  return {
    format: 'terrace-member-export/1',
    generatedAt: new Date().toISOString(),
    member: { id: member.id, displayName: member.displayName, roles: member.roles ?? [], createdAt: member.createdAt },
    profile: await fetch('profile', 'member-profiles', own, ['displayName', 'classYear', 'bio', 'interests', 'directoryVisible', 'createdAt', 'updatedAt']),
    mentorshipOffer: await fetch('mentorshipOffer', 'mentorship-offers', own, ['displayName', 'optIn', 'topics', 'about', 'createdAt', 'updatedAt']),
    stories: await fetch('stories', 'member-stories', { author: { equals: memberId } }, ['id', 'title', 'body', 'audience', 'group', 'createdAt', 'updatedAt']),
    groupsFounded: await fetch('groupsFounded', 'member-groups', { owner: { equals: memberId } }, ['id', 'name', 'description', 'createdAt']),
    groupMemberships: await fetch('groupMemberships', 'group-memberships', own, ['group', 'createdAt']),
    mentorshipRequestsSent: await fetch('mentorshipRequestsSent', 'mentorship-requests', { requester: { equals: memberId } }, ['mentorName', 'message', 'status', 'createdAt']),
    mentorshipRepliesGiven: await fetch('mentorshipRepliesGiven', 'mentorship-requests', { mentor: { equals: memberId } }, ['status', 'reply', 'createdAt']),
    applications: await fetch('applications', 'member-applications', own, ['name', 'affiliation', 'classYear', 'contactEmail', 'note', 'status', 'decidedAt', 'createdAt']),
    invitations: await fetch('invitations', 'member-invitations', own, ['role', 'status', 'expiresAt', 'redeemedAt', 'createdAt']),
    truncated,
  }
}
