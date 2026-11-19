import { APIError, type Access, type CollectionConfig, type Field, type FieldAccess, type PayloadRequest } from 'payload'
import { isMember as isMemberUser, memberId } from '../access/members'
import { adminOnly, isAdmin, isMember as isStaff } from '../access/rules'
import { enqueueMessage } from './outbox'
import { issueInvitation } from './invitations'
import { eraseMember } from './erasure'
import { graceMs } from './policy'
import { offboardMember, restoreMember } from './offboarding'
import { hideTarget, pool, unhideTarget, type HideCollection } from './visibility'

const staff: Access = ({ req }) => isStaff(req.user)
const never: Access = () => false
const fieldNever: FieldAccess = () => false
const sidebar = { position: 'sidebar' as const }
const readOnly = { readOnly: true }
const group = 'Member lifecycle'
const ownedByMember: Access = ({ req }) => {
  const id = memberId(req)
  return id ? { member: { equals: id } } : false
}
const staffOrOwner: Access = (args) => staff(args) || ownedByMember(args)

function reviewer(req: PayloadRequest): number {
  const user = req.user as { collection?: string; id?: unknown } | null
  if (user?.collection !== 'users' || !isStaff(user) || typeof user.id !== 'number') throw new APIError('Only an editor or administrator can record this decision.', 403)
  return user.id
}

export const MemberApplications: CollectionConfig = {
  slug: 'member-applications',
  admin: { group, useAsTitle: 'name', defaultColumns: ['name', 'affiliation', 'status', 'createdAt'], hidden: ({ user }) => !isStaff(user) },
  // Applications arrive only through the intake endpoint; members read only an application linked to them.
  access: { create: fieldNever, read: staffOrOwner, update: staff, delete: adminOnly },
  hooks: {
    beforeValidate: [({ data, operation, originalDoc }) => {
      if (operation !== 'update') return data
      // A decision is final; afterwards only the (administrator-set) member link may change.
      if (originalDoc.status !== 'pending') return { ...originalDoc, member: data?.member ?? originalDoc.member }
      const status = data?.status ?? 'pending'
      const grantRole = data?.grantRole ?? originalDoc.grantRole
      if (status === 'approved' && grantRole !== 'current-member' && grantRole !== 'alumni') throw new APIError('Choose the role to grant before approving.', 400)
      return { ...originalDoc, status, grantRole, decisionNote: data?.decisionNote ?? originalDoc.decisionNote, member: data?.member ?? originalDoc.member }
    }],
    beforeChange: [async ({ data, operation, originalDoc, req }) => {
      if (operation === 'update' && originalDoc.status === 'pending' && data.status !== 'pending') {
        const by = reviewer(req)
        // Take the row lock and re-check the status. A concurrent decision waits here, then finds the
        // application already decided and is refused, so one application never yields two outcomes.
        const claimed = await pool(req.payload, req).query(`UPDATE member_applications SET updated_at = updated_at WHERE id = $1 AND status = 'pending' RETURNING id`, [originalDoc.id])
        if (!claimed.rows.length) throw new APIError('This application was already decided.', 409)
        return { ...data, reviewer: by, decidedAt: new Date().toISOString() }
      }
      return data
    }],
    afterChange: [async ({ doc, previousDoc, operation, req }) => {
      if (operation !== 'update' || previousDoc?.status !== 'pending') return doc
      if (doc.status === 'approved') await issueInvitation(req.payload, doc, req)
      if (doc.status === 'denied') {
        await enqueueMessage(req.payload, {
          kind: 'denial', recipientEmail: doc.contactEmail, recipientLabel: doc.name, subject: 'About your Terrace application',
          body: 'Thank you for applying. Terrace is not able to approve this application right now. Contact the club if you think this is a mistake.',
        }, req)
      }
      return doc
    }],
  },
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: 120, admin: readOnly },
    { name: 'affiliation', type: 'select', required: true, options: ['current-member', 'alumni'], admin: { ...readOnly, description: 'What the applicant says they are. The reviewer decides the role actually granted.' } },
    { name: 'classYear', type: 'number', min: 1904, max: 2200, admin: readOnly },
    { name: 'contactEmail', type: 'email', required: true, admin: readOnly },
    { name: 'note', type: 'textarea', maxLength: 1000, admin: readOnly },
    { name: 'status', type: 'select', required: true, defaultValue: 'pending', options: ['pending', 'approved', 'denied', 'withdrawn'], admin: { ...sidebar, description: 'Approving issues an invitation; it does not create a sign-in account.' } },
    { name: 'grantRole', type: 'select', options: ['current-member', 'alumni'], admin: { ...sidebar, description: 'Required to approve.' } },
    { name: 'decisionNote', type: 'textarea', maxLength: 500, access: { read: ({ req }) => isStaff(req.user) } },
    { name: 'reviewer', type: 'relationship', relationTo: 'users', admin: { ...readOnly, ...sidebar }, access: { read: ({ req }) => isStaff(req.user) } },
    { name: 'decidedAt', type: 'date', admin: { ...readOnly, ...sidebar } },
    { name: 'member', type: 'relationship', relationTo: 'members', admin: { ...sidebar, description: 'Optional link to the applicant\'s member record after first sign-in. Lets the member read this application.' }, access: { read: ({ req }) => isAdmin(req.user), create: fieldNever, update: ({ req }) => isAdmin(req.user) } },
  ],
}

export const MemberInvitations: CollectionConfig = {
  slug: 'member-invitations',
  admin: { group, useAsTitle: 'status', defaultColumns: ['application', 'role', 'status', 'expiresAt'], hidden: ({ user }) => !isStaff(user) },
  access: { create: fieldNever, read: staffOrOwner, update: staff, delete: adminOnly },
  hooks: {
    beforeValidate: [({ data, operation, originalDoc }) => {
      if (operation !== 'update') return data
      // Staff may only revoke a pending invitation (or link the member); everything else is fixed.
      const revoke = originalDoc.status === 'pending' && data?.status === 'revoked'
      return { ...originalDoc, status: revoke ? 'revoked' : originalDoc.status, member: data?.member ?? originalDoc.member }
    }],
  },
  fields: [
    { name: 'application', type: 'relationship', relationTo: 'member-applications', required: true, admin: readOnly },
    { name: 'tokenHash', type: 'text', required: true, unique: true, index: true, admin: { hidden: true }, access: { read: fieldNever, create: fieldNever, update: fieldNever } },
    { name: 'role', type: 'select', required: true, options: ['current-member', 'alumni'], admin: readOnly },
    { name: 'status', type: 'select', required: true, defaultValue: 'pending', options: ['pending', 'redeemed', 'expired', 'revoked'] },
    { name: 'expiresAt', type: 'date', required: true, admin: readOnly },
    { name: 'redeemedAt', type: 'date', admin: readOnly },
    { name: 'member', type: 'relationship', relationTo: 'members', admin: sidebar, access: { read: ({ req }) => isAdmin(req.user), create: fieldNever, update: ({ req }) => isAdmin(req.user) } },
  ],
}

/** Append-only: nothing deletes an outbox row, and the body is stored without links or tokens. */
export const MessageOutbox: CollectionConfig = {
  slug: 'message-outbox',
  admin: { group, useAsTitle: 'subject', defaultColumns: ['kind', 'recipientLabel', 'subject', 'status', 'createdAt'], hidden: ({ user }) => !isAdmin(user), description: 'Messages are recorded here and never sent by this system. There is no mail transport.' },
  access: { create: fieldNever, read: adminOnly, update: adminOnly, delete: fieldNever },
  hooks: { beforeValidate: [({ data, operation, originalDoc }) => operation === 'update' ? { ...originalDoc, status: data?.status ?? originalDoc.status } : data] },
  fields: [
    { name: 'kind', type: 'select', required: true, options: ['invitation', 'denial', 'offboarding', 'erasure-confirmation', 'staff-notice'], admin: readOnly },
    { name: 'recipientLabel', type: 'text', required: true, admin: readOnly },
    { name: 'recipientEmail', type: 'email', admin: readOnly },
    { name: 'subject', type: 'text', required: true, admin: readOnly },
    { name: 'body', type: 'textarea', required: true, admin: readOnly },
    { name: 'status', type: 'select', required: true, defaultValue: 'queued', options: ['queued', 'delivered-by-operator'] },
    { name: 'dedupeKey', type: 'text', unique: true, admin: { hidden: true }, access: { read: fieldNever, create: fieldNever, update: fieldNever } },
  ],
}

export const MemberOffboardings: CollectionConfig = {
  slug: 'member-offboardings',
  admin: { group, useAsTitle: 'state', defaultColumns: ['member', 'state', 'offboardedAt', 'graceEndsAt'], hidden: ({ user }) => !isAdmin(user), description: 'Create a record to offboard a member. Set the state to restored within the grace period to reverse it.' },
  access: { create: adminOnly, read: adminOnly, update: adminOnly, delete: fieldNever },
  hooks: {
    beforeValidate: [async ({ data, operation, originalDoc, req }) => {
      if (operation === 'create') {
        const member = await req.payload.findByID({ collection: 'members', id: data?.member, depth: 0, overrideAccess: true }).catch(() => null)
        if (!member) throw new APIError('Choose a member.', 400)
        if (member.status !== 'active' && member.status != null) throw new APIError('This member is not active.', 409)
        const now = Date.now()
        return { member: member.id, reason: data?.reason, noticeEmail: data?.noticeEmail, actor: reviewer(req), state: 'offboarded', offboardedAt: new Date(now).toISOString(), graceEndsAt: new Date(now + graceMs()).toISOString() }
      }
      const next = data?.state ?? originalDoc.state
      if (originalDoc.state === 'erased' || originalDoc.state === 'restored' && next !== 'restored') throw new APIError('This offboarding can no longer change.', 409)
      if (originalDoc.state === 'offboarded' && next === 'restored') {
        if (Date.now() > new Date(originalDoc.graceEndsAt).getTime()) throw new APIError('The grace period has ended; this member can no longer be restored.', 409)
        return { ...originalDoc, state: 'restored', restoredAt: new Date().toISOString() }
      }
      return { ...originalDoc }
    }],
    afterChange: [async ({ doc, previousDoc, operation, req }) => {
      const id = typeof doc.member === 'object' ? doc.member.id : doc.member
      if (operation === 'create') await offboardMember(req.payload, id, { email: doc.noticeEmail, reason: doc.reason, graceEndsAt: doc.graceEndsAt }, req)
      else if (previousDoc?.state === 'offboarded' && doc.state === 'restored') await restoreMember(req.payload, id, req)
      return doc
    }],
  },
  fields: [
    { name: 'member', type: 'relationship', relationTo: 'members', required: true, admin: { readOnly: true } },
    { name: 'state', type: 'select', required: true, defaultValue: 'offboarded', options: ['offboarded', 'restored', 'erased'] },
    { name: 'reason', type: 'textarea', maxLength: 500 },
    { name: 'noticeEmail', type: 'email', admin: { description: 'Optional. Where the offboarding notice should be delivered by an operator; members do not have an email on file.' } },
    { name: 'actor', type: 'relationship', relationTo: 'users', admin: readOnly },
    { name: 'offboardedAt', type: 'date', admin: readOnly },
    { name: 'graceEndsAt', type: 'date', admin: readOnly },
    { name: 'restoredAt', type: 'date', admin: readOnly },
  ],
}

const targets = {
  story: { collection: 'member-stories', author: 'author', authorName: 'authorName', title: (doc: any) => doc.title, body: (doc: any) => doc.body },
  group: { collection: 'member-groups', author: 'owner', authorName: 'ownerName', title: (doc: any) => doc.name, body: (doc: any) => doc.description },
  'mentorship-request': { collection: 'mentorship-requests', author: 'requester', authorName: 'requesterName', title: (doc: any) => `Mentorship request to ${doc.mentorName}`, body: (doc: any) => doc.message },
} as const
const id = (value: unknown) => typeof value === 'object' && value !== null && 'id' in value ? Number((value as { id: unknown }).id) : Number(value)

/** Reports are created by approved members, and read and resolved by editors and administrators. */
export const ModerationReports: CollectionConfig = {
  slug: 'moderation-reports',
  admin: { group: 'Community moderation', useAsTitle: 'snapshotTitle', defaultColumns: ['snapshotTitle', 'targetType', 'reason', 'status', 'createdAt'], hidden: ({ user }) => !isStaff(user) },
  access: { create: ({ req }) => isMemberUser(req), read: staff, update: staff, delete: adminOnly },
  hooks: {
    beforeValidate: [async ({ data, operation, req, originalDoc }) => {
      if (operation === 'update') {
        const from = originalDoc.status
        const to = data?.status ?? from
        // open -> hidden | resolved | dismissed. hidden -> dismissed (restores) only. Other states are final.
        const allowed = from === to || from === 'open' && ['hidden', 'resolved', 'dismissed'].includes(to) || from === 'hidden' && to === 'dismissed'
        if (!allowed) throw new APIError('That resolution is not available from the current state.', 409)
        return { ...originalDoc, status: to, resolutionNote: data?.resolutionNote ?? originalDoc.resolutionNote }
      }
      const reporter = memberId(req)
      if (reporter) {
        const recent = await req.payload.count({ collection: 'moderation-reports', where: { and: [{ reporter: { equals: reporter } }, { createdAt: { greater_than: new Date(Date.now() - 3_600_000).toISOString() } }] }, overrideAccess: true })
        if (recent.totalDocs >= 20) throw new APIError('Please wait before sending more reports.', 429)
      }
      const type = data?.targetType as keyof typeof targets
      const target = targets[type]
      const targetId = Number(data?.targetId)
      if (!reporter || !target || !Number.isSafeInteger(targetId) || targetId < 1) throw new APIError('Choose something you can read.', 400)
      const { docs } = await req.payload.find({ collection: target.collection, where: { id: { equals: targetId } }, req, overrideAccess: false, depth: 0, limit: 1 })
      const doc = docs[0] as any
      if (!doc) throw new APIError('Choose something you can read.', 404)
      const author = id(doc[target.author])
      if (author === reporter) throw new APIError('You cannot report your own content.', 400)
      return {
        targetType: type, targetId, reason: data?.reason, detail: data?.detail, status: 'open', reporter, targetAuthor: author,
        reportKey: `${type}:${targetId}:${reporter}`, authorName: doc[target.authorName], snapshotTitle: String(target.title(doc)).slice(0, 140), snapshotBody: String(target.body(doc)).slice(0, 10000),
      }
    }],
    beforeChange: [({ data, operation, originalDoc, req }) => operation === 'update' && data.status !== originalDoc.status ? { ...data, resolver: reviewer(req), resolvedAt: new Date().toISOString() } : data],
    afterChange: [async ({ doc, previousDoc, operation, req }) => {
      if (operation !== 'update') return doc
      const target = targets[doc.targetType as keyof typeof targets]
      if (previousDoc?.status === 'open' && doc.status === 'hidden') await hideTarget(req.payload, target.collection as HideCollection, doc.targetId, req)
      if (previousDoc?.status === 'hidden' && doc.status === 'dismissed') await unhideTarget(req.payload, target.collection as HideCollection, doc.targetId, req)
      return doc
    }],
  },
  fields: [
    { name: 'targetType', type: 'select', required: true, options: ['story', 'group', 'mentorship-request'], admin: readOnly },
    { name: 'targetId', type: 'number', required: true, admin: readOnly },
    { name: 'reason', type: 'select', required: true, options: ['privacy', 'harassment', 'other'], admin: readOnly },
    { name: 'detail', type: 'textarea', maxLength: 500, admin: readOnly },
    { name: 'status', type: 'select', required: true, defaultValue: 'open', options: ['open', 'hidden', 'resolved', 'dismissed'], admin: { description: 'hidden removes the content from member views but keeps it for the grace period; dismissed restores it; resolved records review with no change.' } },
    { name: 'resolutionNote', type: 'textarea', maxLength: 500 },
    { name: 'snapshotTitle', type: 'text', required: true, maxLength: 140, admin: readOnly },
    { name: 'snapshotBody', type: 'textarea', required: true, maxLength: 10000, admin: readOnly },
    { name: 'authorName', type: 'text', required: true, maxLength: 100, admin: readOnly },
    { name: 'reporter', type: 'relationship', relationTo: 'members', admin: { ...readOnly, hidden: true }, access: { read: fieldNever, create: fieldNever, update: fieldNever } },
    { name: 'targetAuthor', type: 'relationship', relationTo: 'members', admin: { hidden: true }, access: { read: fieldNever, create: fieldNever, update: fieldNever } },
    { name: 'resolver', type: 'relationship', relationTo: 'users', admin: readOnly },
    { name: 'resolvedAt', type: 'date', admin: readOnly },
    { name: 'reportKey', type: 'text', required: true, unique: true, admin: { hidden: true }, access: { read: fieldNever } },
  ],
}

const memberField = (name: string): Field => ({ name, type: 'relationship', relationTo: 'members', required: true, admin: { readOnly: true } })

/** Export and erasure requests: an audit trail with no exported content. */
export const DataRequests: CollectionConfig = {
  slug: 'data-requests',
  admin: { group, useAsTitle: 'kind', defaultColumns: ['member', 'kind', 'status', 'createdAt'], hidden: ({ user }) => !isAdmin(user), description: 'Create an erasure request here to erase an offboarded member. Then run lifecycle:sweep: this path cannot redact local message files until the sweep. Members create their own through the website.' },
  access: { create: adminOnly, read: ({ req }) => isAdmin(req.user) || ownedByMember({ req } as never), update: never, delete: never },
  hooks: {
    beforeValidate: [async ({ data, req, operation }) => {
      if (operation === 'update' || req.context?.memberFlow === true) return data
      // Only administrators reach here (member requests use the endpoints). Erasure by an administrator requires offboarding first.
      if (data?.kind !== 'erasure') throw new APIError('Administrators can request erasure only.', 400)
      const member = await req.payload.findByID({ collection: 'members', id: data.member, depth: 0, overrideAccess: true }).catch(() => null)
      if (!member || member.status !== 'offboarded') throw new APIError('Offboard the member before erasing them.', 409)
      return { member: member.id, kind: 'erasure', status: 'confirmed', requestedBy: 'administrator', actor: reviewer(req) }
    }],
    afterChange: [async ({ doc, operation, req }) => {
      if (operation !== 'create' || doc.kind !== 'erasure' || doc.requestedBy !== 'administrator') return doc
      await eraseMember(req.payload, id(doc.member), req)
      await req.payload.update({ collection: 'data-requests', id: doc.id, data: { status: 'completed', completedAt: new Date().toISOString() }, overrideAccess: true, req })
      return doc
    }],
  },
  fields: [
    memberField('member'),
    { name: 'kind', type: 'select', required: true, options: ['export', 'erasure'] },
    { name: 'status', type: 'select', required: true, defaultValue: 'awaiting-confirmation', options: ['awaiting-confirmation', 'confirmed', 'completed', 'expired'] },
    { name: 'requestedBy', type: 'select', required: true, defaultValue: 'member', options: ['member', 'administrator'] },
    { name: 'confirmHash', type: 'text', admin: { hidden: true }, access: { read: fieldNever, create: fieldNever, update: fieldNever } },
    { name: 'confirmExpiresAt', type: 'date', admin: readOnly },
    { name: 'completedAt', type: 'date', admin: readOnly },
    { name: 'actor', type: 'relationship', relationTo: 'users', admin: readOnly },
  ],
}

export const lifecycleCollections = [MemberApplications, MemberInvitations, MessageOutbox, MemberOffboardings, ModerationReports, DataRequests]
