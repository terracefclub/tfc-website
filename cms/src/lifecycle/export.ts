import type { CollectionSlug, Payload } from 'payload'

const CAP = 2000

async function mine(payload: Payload, collection: CollectionSlug, where: Record<string, unknown>) {
  const result = await payload.find({ collection, where: { and: [where, { hiddenReason: { exists: false } }] } as never, limit: CAP, depth: 0, pagination: false, overrideAccess: true })
  return result.docs as Array<Record<string, unknown>>
}
const pick = (doc: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.filter((key) => key in doc).map((key) => [key, doc[key]]))

/**
 * Own records only. Every query is filtered by the member's id here, not by relying on access
 * control. Other people's text (for example a mentorship request someone sent to this member) is
 * omitted; identity fields (identity key, issuer, subject) never leave the server.
 */
export async function buildExport(payload: Payload, memberId: number) {
  const member = await payload.findByID({ collection: 'members', id: memberId, depth: 0, overrideAccess: true })
  const linked = async (collection: CollectionSlug, keys: string[]) => (await payload.find({ collection, where: { member: { equals: memberId } }, limit: CAP, depth: 0, overrideAccess: true })).docs.map((doc) => pick(doc as never, keys))
  return {
    format: 'terrace-member-export/1',
    generatedAt: new Date().toISOString(),
    member: { id: member.id, displayName: member.displayName, roles: member.roles ?? [], createdAt: member.createdAt },
    profile: (await mine(payload, 'member-profiles', { member: { equals: memberId } })).map((doc) => pick(doc, ['displayName', 'classYear', 'bio', 'interests', 'directoryVisible', 'createdAt', 'updatedAt'])),
    mentorshipOffer: (await mine(payload, 'mentorship-offers', { member: { equals: memberId } })).map((doc) => pick(doc, ['displayName', 'optIn', 'topics', 'about', 'createdAt', 'updatedAt'])),
    stories: (await mine(payload, 'member-stories', { author: { equals: memberId } })).map((doc) => pick(doc, ['id', 'title', 'body', 'audience', 'group', 'createdAt', 'updatedAt'])),
    groupsFounded: (await mine(payload, 'member-groups', { owner: { equals: memberId } })).map((doc) => pick(doc, ['id', 'name', 'description', 'createdAt'])),
    groupMemberships: (await payload.find({ collection: 'group-memberships', where: { member: { equals: memberId } }, limit: CAP, depth: 0, overrideAccess: true })).docs.map((doc) => pick(doc as never, ['group', 'createdAt'])),
    mentorshipRequestsSent: (await mine(payload, 'mentorship-requests', { requester: { equals: memberId } })).map((doc) => pick(doc, ['mentorName', 'message', 'status', 'createdAt'])),
    mentorshipRepliesGiven: (await mine(payload, 'mentorship-requests', { mentor: { equals: memberId } })).map((doc) => pick(doc, ['status', 'reply', 'createdAt'])),
    applications: await linked('member-applications', ['name', 'affiliation', 'classYear', 'contactEmail', 'note', 'status', 'decidedAt', 'createdAt']),
    invitations: await linked('member-invitations', ['role', 'status', 'expiresAt', 'redeemedAt', 'createdAt']),
  }
}
