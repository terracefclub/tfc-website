import { expect, test } from 'bun:test'
import { approvedApplicationEmail, approvedEmailQuery, connectionEnv, erasedEmail, lookupWithPsql, assertLoopbackOrigin, offboardRealmUser, provisionMember, type Api } from '../tools/member-provision'

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

test('the operator CLI never follows redirects when it authenticates or calls the admin API', async () => {
  const source = await Bun.file(new URL('../tools/provision-member.ts', import.meta.url)).text()
  expect(source.match(/redirect: 'error'/g)?.length).toBe(2)
})

test('the realm user email comes from an approved application, never free typing', async () => {
  const lookup = async (id: number) => id === 7 ? 'Applicant@Terrace.Invalid' : null
  expect(await approvedApplicationEmail('7', lookup)).toBe('Applicant@Terrace.Invalid')
  expect(await approvedApplicationEmail('7', lookup, 'applicant@terrace.invalid')).toBe('Applicant@Terrace.Invalid')
  await expect(approvedApplicationEmail('7', lookup, 'applicant+x@terrace.invalid')).rejects.toThrow('does not match')
  await expect(approvedApplicationEmail('8', lookup)).rejects.toThrow('No approved application')
  for (const bad of ['', '0', '7; drop table x', '-1', 'abc']) await expect(approvedApplicationEmail(bad, lookup)).rejects.toThrow('numeric id')
})

test('an erased application can never get a realm user, and the psql lookup keeps the connection string out of argv and errors', async () => {
  await expect(approvedApplicationEmail('9', async () => erasedEmail)).rejects.toThrow('No approved application')
  await expect(provisionMember(fakeKeycloak().api, { ...input, email: erasedEmail.toUpperCase() })).rejects.toThrow('valid email')
  expect(approvedEmailQuery).toContain("<> 'erased@terrace.invalid'")
  expect(approvedEmailQuery).toContain("<> 'Erased applicant'")
  expect(approvedEmailQuery).toContain("('pending', 'redeemed')")
  const uri = 'postgresql://cms_user:s3cret-pw@127.0.0.1:5999/terrace_cms'
  expect(connectionEnv(uri)).toEqual({ PGHOST: '127.0.0.1', PGPORT: '5999', PGDATABASE: 'terrace_cms', PGUSER: 'cms_user', PGPASSWORD: 's3cret-pw' })
  expect(connectionEnv('postgresql:///terrace_cms?host=/tmp/sock&port=55432')).toEqual({ PGHOST: '/tmp/sock', PGPORT: '55432', PGDATABASE: 'terrace_cms' })
  let seen: { args: string[]; env: Record<string, string> } | undefined
  const found = await lookupWithPsql(uri, (args, env) => { seen = { args, env }; return 'a@terrace.invalid\n' })(4)
  expect(found).toBe('a@terrace.invalid')
  expect(JSON.stringify(seen!.args)).not.toMatch(/s3cret|127\.0\.0\.1|postgresql/)
  const failure = await lookupWithPsql(uri, () => { throw new Error(`Command failed: psql ${uri}`) })(4).catch((error: Error) => error)
  expect((failure as Error).message).toBe('Could not read the application from the local database; nothing was changed.')
  expect((failure as Error).message).not.toContain('s3cret')
  expect(await lookupWithPsql(uri, () => '')(4)).toBeNull()
  await expect(lookupWithPsql(undefined, () => '')(4)).rejects.toThrow('DATABASE_URI')
})
