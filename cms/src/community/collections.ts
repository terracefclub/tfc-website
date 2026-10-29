import type { CollectionConfig, Field, Where } from 'payload'
import { memberId } from '../access/members'
import { joinedGroups, keepOwner, memberName, membersOnly, never, own, privateOperation, readableStories, relationId, storyAudience } from './access'

const text = (name: string, maxLength: number, required = false, type: 'text' | 'textarea' = 'text'): Field => {
  const options = { name, required, maxLength, validate: (value: unknown) => value == null && !required || typeof value === 'string' && value.length <= maxLength && (!required || value.trim().length > 0) || `Enter ${required ? 'some text, ' : ''}up to ${maxLength} characters.` }
  return type === 'text' ? { ...options, type: 'text' } : { ...options, type: 'textarea' }
}
const member = (name: string, unique = false): Field => ({ name, type: 'relationship', relationTo: 'members', required: true, unique, admin: { readOnly: true } })
const hiddenAdmin = { hidden: true }

export const MemberProfiles: CollectionConfig = {
  slug: 'member-profiles', admin: hiddenAdmin,
  access: {
    create: membersOnly,
    read: ({ req }): boolean | Where => {
      const id = memberId(req)
      return id ? { or: [{ member: { equals: id } }, { directoryVisible: { equals: true } }] } : false
    },
    update: own('member'), delete: own('member'),
  },
  hooks: { beforeValidate: [keepOwner('member')] },
  fields: [
    member('member', true), text('displayName', 100, true),
    { name: 'classYear', type: 'number', min: 1904, max: 2200, validate: (value: unknown) => value == null || typeof value === 'number' && Number.isInteger(value) && value >= 1904 && value <= 2200 || 'Enter a valid class year.' },
    text('bio', 2000, false, 'textarea'), text('interests', 300),
    { name: 'directoryVisible', type: 'checkbox', required: true, defaultValue: false },
  ],
}

export const MemberStories: CollectionConfig = {
  slug: 'member-stories', admin: hiddenAdmin,
  access: { create: membersOnly, read: readableStories, update: own('author'), delete: own('author') },
  hooks: { beforeValidate: [keepOwner('author'), ({ data, req, operation, originalDoc }) => ({ ...data, authorName: operation === 'create' ? memberName(req) : originalDoc?.authorName })], beforeChange: [storyAudience] },
  fields: [
    member('author'), text('authorName', 100, true), text('title', 140, true), text('body', 10000, true, 'textarea'),
    { name: 'audience', type: 'select', required: true, defaultValue: 'community', options: ['community', 'group'] },
    { name: 'group', type: 'relationship', relationTo: 'member-groups' },
  ],
}

export const MemberGroups: CollectionConfig = {
  slug: 'member-groups', admin: hiddenAdmin,
  access: { create: membersOnly, read: membersOnly, update: own('owner'), delete: never },
  hooks: {
    beforeValidate: [keepOwner('owner'), ({ data, req, operation, originalDoc }) => ({ ...data, ownerName: operation === 'create' ? memberName(req) : originalDoc?.ownerName })],
    afterChange: [async ({ doc, req, operation }) => {
      if (operation === 'create') await req.payload.create({
        collection: 'group-memberships', data: { member: doc.owner, group: doc.id, membershipKey: `${doc.owner}:${doc.id}` },
        req, overrideAccess: true,
      })
    }],
  },
  fields: [member('owner'), text('ownerName', 100, true), text('name', 100, true), text('description', 2000, true, 'textarea')],
}

export const GroupMemberships: CollectionConfig = {
  slug: 'group-memberships', admin: hiddenAdmin,
  access: { create: membersOnly, read: own('member'), update: never, delete: own('member') },
  hooks: {
    beforeValidate: [keepOwner('member'), async ({ data, req }) => {
      const id = memberId(req)
      const group = relationId(data?.group)
      if (!id || !group) throw new Error('Choose a group.')
      await req.payload.findByID({ collection: 'member-groups', id: group, req, overrideAccess: false, depth: 0 })
      if ((await joinedGroups(req)).length >= 100) throw new Error('You can join up to 100 groups.')
      return { ...data, membershipKey: `${id}:${group}` }
    }],
    beforeDelete: [async ({ id, req }) => {
      const membership = await req.payload.findByID({ collection: 'group-memberships', id, req, overrideAccess: true, depth: 0 })
      const group = await req.payload.findByID({ collection: 'member-groups', id: relationId(membership.group)!, req, overrideAccess: true, depth: 0 })
      if (relationId(group.owner) === memberId(req)) throw new Error('The group founder remains a member of their group.')
    }],
  },
  fields: [
    member('member'), { name: 'group', type: 'relationship', relationTo: 'member-groups', required: true },
    { name: 'membershipKey', type: 'text', required: true, unique: true, admin: { hidden: true }, access: { read: () => false } },
  ],
}

export const MentorshipOffers: CollectionConfig = {
  slug: 'mentorship-offers', admin: hiddenAdmin,
  access: {
    create: membersOnly,
    read: ({ req }): boolean | Where => {
      const id = memberId(req)
      return id ? { or: [{ member: { equals: id } }, { optIn: { equals: true } }] } : false
    },
    update: own('member'), delete: own('member'),
  },
  hooks: { beforeValidate: [keepOwner('member')] },
  fields: [
    member('member', true), { name: 'optIn', type: 'checkbox', required: true, defaultValue: false },
    text('displayName', 100, true), text('topics', 300), text('about', 1500, false, 'textarea'),
  ],
}

export const MentorshipRequests: CollectionConfig = {
  slug: 'mentorship-requests', admin: hiddenAdmin,
  access: {
    create: membersOnly,
    read: ({ req }): boolean | Where => {
      const id = memberId(req)
      return id ? { or: [{ requester: { equals: id } }, { mentor: { equals: id } }] } : false
    },
    update: own('mentor'), delete: own('requester'),
  },
  hooks: { beforeValidate: [keepOwner('requester'), async ({ data, req, operation, originalDoc }) => {
    if (operation === 'update') {
      if (!['accepted', 'declined'].includes(data?.status)) throw new Error('Accept or decline this request.')
      return { ...data, mentor: relationId(originalDoc?.mentor), message: originalDoc?.message, requestKey: originalDoc?.requestKey, requesterName: originalDoc?.requesterName, mentorName: originalDoc?.mentorName }
    }
    const requester = memberId(req)
    const mentor = relationId(data?.mentor)
    if (!mentor || mentor === requester) throw new Error('Choose another member who has opted into mentorship.')
    const offers = await req.payload.find({ collection: 'mentorship-offers', where: { and: [{ member: { equals: mentor } }, { optIn: { equals: true } }] }, req, overrideAccess: false, limit: 1, depth: 0 })
    if (!offers.totalDocs) throw new Error('This member is not accepting mentorship requests.')
    return { ...data, status: 'pending', reply: null, requestKey: `${requester}:${mentor}`, requesterName: memberName(req), mentorName: offers.docs[0].displayName }
  }] },
  fields: [
    member('requester'), member('mentor'), text('requesterName', 100, true), text('mentorName', 100, true), text('message', 1500, true, 'textarea'),
    text('reply', 1500, false, 'textarea'),
    { name: 'status', type: 'select', required: true, defaultValue: 'pending', options: ['pending', 'accepted', 'declined'] },
    { name: 'requestKey', type: 'text', unique: true, required: true, admin: { hidden: true }, access: { read: () => false } },
  ],
}

export const communityCollections = [MemberProfiles, MemberStories, MemberGroups, GroupMemberships, MentorshipOffers, MentorshipRequests].map((collection) => ({
  ...collection,
  hooks: { ...collection.hooks, beforeOperation: [privateOperation] },
}))
