import { APIError, type Access, type CollectionBeforeChangeHook, type CollectionBeforeOperationHook, type CollectionBeforeValidateHook, type PayloadRequest, type Where } from 'payload'
import { isMember, memberId } from '../access/members'

export const membersOnly: Access = ({ req }) => isMember(req)
export const never: Access = () => false

export function memberName(req: PayloadRequest): string {
  return req.user && 'displayName' in req.user && typeof req.user.displayName === 'string'
    ? req.user.displayName.slice(0, 100) : 'Terrace member'
}

const writes = new Map<number, { count: number; expires: number }>()
export const privateOperation: CollectionBeforeOperationHook = ({ args, req, operation }) => {
  req.responseHeaders ??= new Headers()
  req.responseHeaders.set('Cache-Control', 'private, no-store')
  req.responseHeaders.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  req.responseHeaders.set('Vary', 'Authorization, Cookie')
  if ('depth' in args) args.depth = 0
  if ('limit' in args && args.overrideAccess !== true) args.limit = Math.min(Math.max(Number(args.limit) || 20, 1), 100)
  if ('pagination' in args && args.overrideAccess !== true) args.pagination = true
  const id = memberId(req)
  if (!id || !['create', 'update', 'delete'].includes(operation)) return args
  const now = Date.now()
  for (const [key, value] of writes) if (value.expires <= now) writes.delete(key)
  const window = writes.get(id) ?? { count: 0, expires: now + 60_000 }
  if (window.count >= 30) throw new APIError('Please wait a minute before making more changes.', 429)
  if (!writes.has(id) && writes.size >= 2000) throw new APIError('Please try again shortly.', 503)
  window.count += 1
  writes.set(id, window)
  return args
}

export function relationId(value: unknown): number | null {
  const id = typeof value === 'object' && value !== null && 'id' in value ? value.id : value
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? id : null
}

export const own = (field: string): Access => ({ req }) => {
  const id = memberId(req)
  return id ? { [field]: { equals: id } } : false
}

export const keepOwner = (field: string): CollectionBeforeValidateHook => ({ data, req, operation, originalDoc }) => {
  const id = memberId(req)
  if (!id) throw new Error('An approved member account is required.')
  return { ...data, [field]: operation === 'create' ? id : relationId(originalDoc?.[field]) }
}

export async function joinedGroups(req: PayloadRequest): Promise<number[]> {
  const id = memberId(req)
  if (!id) return []
  const result = await req.payload.find({
    collection: 'group-memberships', req, overrideAccess: true, depth: 0,
    where: { member: { equals: id } }, limit: 101,
  })
  if (result.totalDocs > 100) throw new Error('Group membership limit exceeded.')
  return result.docs.map((doc) => relationId(doc.group)).filter((value): value is number => value !== null)
}

export const readableStories: Access = async ({ req }) => {
  const id = memberId(req)
  if (!id) return false
  const groups = await joinedGroups(req)
  const or: Where[] = [{ audience: { equals: 'community' } }, { author: { equals: id } }]
  if (groups.length) or.push({ group: { in: groups } })
  return { or }
}

export const storyAudience: CollectionBeforeChangeHook = async ({ data, req, originalDoc }) => {
  const audience = data?.audience ?? originalDoc?.audience
  if (audience === 'community') return { ...data, group: null }
  const group = relationId(Object.hasOwn(data ?? {}, 'group') ? data?.group : originalDoc?.group)
  if (!group || !(await joinedGroups(req)).includes(group)) throw new Error('Join this group before sharing a story with it.')
  return { ...data, group }
}
