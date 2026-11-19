import { memberRoleNames, realm } from './realm-config'

export type Api = (path: string, method?: string, data?: unknown) => Promise<Response>
export type MemberRole = typeof memberRoleNames[number]

export const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,63}$/
export const isMemberRole = (value: unknown): value is MemberRole => memberRoleNames.includes(value as MemberRole)

export function assertLoopbackOrigin(value: string): string {
  const url = new URL(value)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Member provisioning here is for the loopback local realm only. Use the Keycloak admin console for any other realm.')
  }
  return url.origin
}

async function ok(response: Response): Promise<Response> {
  if (!response.ok) throw new Error(`Keycloak request failed (${response.status}).`)
  return response
}

async function findUser(api: Api, username: string): Promise<Record<string, unknown> | undefined> {
  const found = await (await ok(await api(`realms/${realm}/users?username=${encodeURIComponent(username)}&exact=true`))).json() as Array<Record<string, unknown>>
  return found[0]
}

async function realmRole(api: Api, name: string) {
  return await (await ok(await api(`realms/${realm}/roles/${name}`))).json()
}

async function currentMemberRoles(api: Api, id: string): Promise<MemberRole[]> {
  const mapped = await (await ok(await api(`realms/${realm}/users/${id}/role-mappings/realm`))).json() as Array<{ name: string }>
  return mapped.map((role) => role.name).filter(isMemberRole)
}

/**
 * Idempotently create (or re-enable) a realm user and give them exactly the one granted member
 * role. An existing user keeps their credentials. A new user gets a temporary password supplied by
 * the caller, who is responsible for delivering it privately; it is never returned in logs.
 */
export async function provisionMember(api: Api, input: { username: string; email: string; name: string; role: MemberRole; temporaryPassword: () => string }) {
  if (!usernamePattern.test(input.username)) throw new Error('Username must be 3-64 lowercase letters, digits, dot, dash or underscore.')
  if (!isMemberRole(input.role)) throw new Error('Role must be current-member or alumni.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error('A valid email address is required.')
  const words = input.name.trim().split(/\s+/).filter(Boolean)
  if (!words.length || input.name.length > 120) throw new Error('A name of up to 120 characters is required.')
  let user = await findUser(api, input.username)
  let password: string | undefined
  if (!user) {
    password = input.temporaryPassword()
    await ok(await api(`realms/${realm}/users`, 'POST', {
      username: input.username, email: input.email, firstName: words[0], lastName: words.slice(1).join(' ') || 'Terran',
      enabled: true, emailVerified: true, requiredActions: [], credentials: [{ type: 'password', value: password, temporary: true }],
    }))
    user = await findUser(api, input.username)
    if (!user) throw new Error('Keycloak did not return the created user.')
  } else if (user.enabled !== true) {
    await ok(await api(`realms/${realm}/users/${user.id}`, 'PUT', { ...user, enabled: true }))
  }
  const id = String(user.id)
  const have = await currentMemberRoles(api, id)
  const stale = have.filter((name) => name !== input.role)
  if (stale.length) await ok(await api(`realms/${realm}/users/${id}/role-mappings/realm`, 'DELETE', await Promise.all(stale.map((name) => realmRole(api, name)))))
  if (!have.includes(input.role)) await ok(await api(`realms/${realm}/users/${id}/role-mappings/realm`, 'POST', [await realmRole(api, input.role)]))
  return { created: password !== undefined, password, role: input.role }
}

/** Offboard: remove member roles, disable the account and end live sessions. Safe to repeat. */
export async function offboardRealmUser(api: Api, username: string) {
  if (!usernamePattern.test(username)) throw new Error('Username must be 3-64 lowercase letters, digits, dot, dash or underscore.')
  const user = await findUser(api, username)
  if (!user) return { found: false, rolesRemoved: 0 }
  const id = String(user.id)
  const have = await currentMemberRoles(api, id)
  if (have.length) await ok(await api(`realms/${realm}/users/${id}/role-mappings/realm`, 'DELETE', await Promise.all(have.map((name) => realmRole(api, name)))))
  if (user.enabled !== false) await ok(await api(`realms/${realm}/users/${id}`, 'PUT', { ...user, enabled: false }))
  await ok(await api(`realms/${realm}/users/${id}/logout`, 'POST'))
  return { found: true, rolesRemoved: have.length }
}
