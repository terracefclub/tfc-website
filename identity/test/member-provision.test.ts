import { expect, test } from 'bun:test'
import { assertLoopbackOrigin, offboardRealmUser, provisionMember, type Api } from '../tools/member-provision'

// A small in-memory Keycloak admin API: users, realm roles and role mappings.
function fakeKeycloak() {
  const users = new Map<string, { id: string; username: string; enabled: boolean; mappings: Set<string>; body: Record<string, unknown> }>()
  const log: string[] = []
  let sessionsEnded = 0
  const api: Api = async (path, method = 'GET', data) => {
    log.push(`${method} ${path}`)
    const json = (value: unknown, status = 200) => Response.json(value, { status })
    const [, , segment, id, sub] = path.split('?')[0].split('/')
    if (segment === 'roles') return ['current-member', 'alumni'].includes(id) ? json({ name: id, id: `role-${id}` }) : json({}, 404)
    if (segment === 'users' && !id) {
      if (method === 'GET') return json([...users.values()].filter((user) => path.includes(`username=${user.username}&`)).map((user) => ({ id: user.id, username: user.username, enabled: user.enabled })))
      const body = data as Record<string, any>
      users.set(body.username, { id: `id-${body.username}`, username: body.username, enabled: body.enabled, mappings: new Set(), body })
      return new Response(null, { status: 201 })
    }
    const user = [...users.values()].find((entry) => entry.id === id)
    if (!user) return json({}, 404)
    if (sub === 'role-mappings') {
      if (method === 'GET') return json([...user.mappings].map((name) => ({ name })))
      for (const role of data as Array<{ name: string }>) method === 'POST' ? user.mappings.add(role.name) : user.mappings.delete(role.name)
      return new Response(null, { status: 204 })
    }
    if (sub === 'logout') { sessionsEnded++; return new Response(null, { status: 204 }) }
    if (method === 'PUT') { user.enabled = (data as any).enabled; return new Response(null, { status: 204 }) }
    return json({}, 404)
  }
  return { api, users, log, sessions: () => sessionsEnded }
}
const input = { username: 'new.terran', email: 'new.terran@terrace.invalid', name: 'New Terran', role: 'alumni' as const, temporaryPassword: () => 'synthetic-temporary' }

test('provisioning creates one user with exactly the granted role and is repeatable', async () => {
  const keycloak = fakeKeycloak()
  const first = await provisionMember(keycloak.api, input)
  expect(first).toMatchObject({ created: true, password: 'synthetic-temporary', role: 'alumni' })
  expect(keycloak.users.get('new.terran')?.body).toMatchObject({ enabled: true, firstName: 'New', lastName: 'Terran', credentials: [{ type: 'password', temporary: true }] })
  expect([...keycloak.users.get('new.terran')!.mappings]).toEqual(['alumni'])
  const again = await provisionMember(keycloak.api, { ...input, temporaryPassword: () => { throw new Error('must not reset an existing credential') } })
  expect(again).toMatchObject({ created: false, password: undefined })
  expect(keycloak.users.size).toBe(1)
  expect(keycloak.log.filter((line) => line === 'POST realms/terrace/users').length).toBe(1)
})

test('changing the granted role replaces the previous member role and re-enables a disabled user', async () => {
  const keycloak = fakeKeycloak()
  await provisionMember(keycloak.api, input)
  await offboardRealmUser(keycloak.api, 'new.terran')
  expect(keycloak.users.get('new.terran')).toMatchObject({ enabled: false })
  await provisionMember(keycloak.api, { ...input, role: 'current-member' })
  const user = keycloak.users.get('new.terran')!
  expect(user.enabled).toBe(true)
  expect([...user.mappings]).toEqual(['current-member'])
})

test('offboarding removes roles, disables, ends sessions, and is safe to repeat or for an unknown user', async () => {
  const keycloak = fakeKeycloak()
  await provisionMember(keycloak.api, input)
  expect(await offboardRealmUser(keycloak.api, 'new.terran')).toEqual({ found: true, rolesRemoved: 1 })
  const user = keycloak.users.get('new.terran')!
  expect(user.enabled).toBe(false)
  expect(user.mappings.size).toBe(0)
  expect(keycloak.sessions()).toBe(1)
  expect(await offboardRealmUser(keycloak.api, 'new.terran')).toEqual({ found: true, rolesRemoved: 0 })
  expect(await offboardRealmUser(keycloak.api, 'nobody.here')).toEqual({ found: false, rolesRemoved: 0 })
})

test('input is validated before Keycloak is called, and only the loopback realm is accepted', async () => {
  const keycloak = fakeKeycloak()
  for (const bad of [{ username: 'A' }, { username: '../etc' }, { username: 'ok name' }, { email: 'nope' }, { name: '   ' }, { role: 'editorial-admin' as any }, { role: 'admin' as any }]) {
    await expect(provisionMember(keycloak.api, { ...input, ...bad })).rejects.toThrow()
  }
  await expect(offboardRealmUser(keycloak.api, 'Bad Name')).rejects.toThrow()
  expect(keycloak.log).toHaveLength(0)
  expect(assertLoopbackOrigin('http://127.0.0.1:8184')).toBe('http://127.0.0.1:8184')
  for (const remote of ['https://keycloak.example.org', 'http://localhost:8184', 'http://10.0.0.5:8184', 'http://u:p@127.0.0.1:8184']) expect(() => assertLoopbackOrigin(remote)).toThrow()
})

test('Keycloak failures surface without request details', async () => {
  const failing: Api = async () => new Response('{"secret":"synthetic-private"}', { status: 500 })
  const failure = await provisionMember(failing, input).catch((error: Error) => error)
  expect(failure).toBeInstanceOf(Error)
  expect((failure as Error).message).toBe('Keycloak request failed (500).')
})
