import { createHash, randomBytes } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync, spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { origin, realm, webOrigins, realmSettings, clientSettings } from './realm-config'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const state = resolve(root, '.state')
mkdirSync(state, { recursive: true, mode: 0o700 })
chmodSync(state, 0o700)
const settingsPath = resolve(state, 'credentials.json')
if (!existsSync(settingsPath)) writeFileSync(settingsPath, JSON.stringify({
  adminPassword: randomBytes(32).toString('hex'), webSecret: randomBytes(32).toString('hex'), introspectionSecret: randomBytes(32).toString('hex'),
  memberPassword: randomBytes(24).toString('hex'), alumniPassword: randomBytes(24).toString('hex'), outsiderPassword: randomBytes(24).toString('hex'),
}), { mode: 0o600, flag: 'wx' })
chmodSync(settingsPath, 0o600)
const credentials = JSON.parse(readFileSync(settingsPath, 'utf8'))
const pin = JSON.parse(readFileSync(resolve(root, 'keycloak-pin.json'), 'utf8'))
const home = resolve(state, `keycloak-${pin.version}`)
if (!existsSync(resolve(home, 'bin/kc.sh'))) {
  const response = await fetch(pin.url, { signal: AbortSignal.timeout(180_000) })
  if (!response.ok) throw new Error('Could not download the pinned Keycloak release.')
  const bytes = Buffer.from(await response.arrayBuffer())
  if (createHash('sha256').update(bytes).digest('hex') !== pin.sha256) throw new Error('Keycloak release hash mismatch.')
  const archive = resolve(state, 'keycloak.tar.gz')
  writeFileSync(archive, bytes, { mode: 0o600 })
  execFileSync('tar', ['-xzf', archive, '-C', state], { stdio: 'ignore' })
}

async function isReady() {
  try { return (await fetch(`${origin}/realms/master`, { signal: AbortSignal.timeout(2000) })).ok } catch { return false }
}
if (!await isReady()) {
  const log = openSync(resolve(state, 'keycloak.log'), 'a', 0o600)
  const child = spawn('nohup', [resolve(home, 'bin/kc.sh'), 'start-dev', '--http-host=127.0.0.1', '--http-port=8184', '--hostname=http://127.0.0.1:8184', '--http-management-host=127.0.0.1', '--http-management-port=9184'], {
    cwd: home, detached: true, stdio: ['ignore', log, log],
    env: { ...process.env, KC_BOOTSTRAP_ADMIN_USERNAME: 'terrace-local-admin', KC_BOOTSTRAP_ADMIN_PASSWORD: credentials.adminPassword, JAVA_OPTS_KC_HEAP: '-Xms128m -Xmx512m' },
  })
  child.unref()
  writeFileSync(resolve(state, 'keycloak.pid'), String(child.pid), { mode: 0o600 })
}
let ready = false
for (let attempt = 0; attempt < 120; attempt++) {
  if (await isReady()) { ready = true; break }
  await delay(1000)
}
if (!ready) throw new Error('Local Keycloak did not become ready; inspect the private runtime log.')

const login = await fetch(`${origin}/realms/master/protocol/openid-connect/token`, {
  method: 'POST', body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: 'terrace-local-admin', password: credentials.adminPassword }), signal: AbortSignal.timeout(5000),
})
if (!login.ok) throw new Error('Local Keycloak bootstrap could not authenticate; no realm was changed.')
const { access_token: adminToken } = await login.json() as { access_token: string }
async function api(path: string, method = 'GET', data?: unknown) {
  const response = await fetch(`${origin}/admin/${path}`, { method, redirect: 'error', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(5000) })
  if (!response.ok && !(method === 'GET' && response.status === 404)) throw new Error(`Keycloak bootstrap request failed (${response.status}).`)
  return response
}

if ((await api(`realms/${realm}`)).status === 404) await api('realms', 'POST', realmSettings)
else await api(`realms/${realm}`, 'PUT', realmSettings)
for (const name of ['current-member', 'alumni']) if ((await api(`realms/${realm}/roles/${name}`)).status === 404) await api(`realms/${realm}/roles`, 'POST', { name })
for (const client of clientSettings(credentials)) {
  const matches = await (await api(`realms/${realm}/clients?clientId=${client.clientId}`)).json() as { id: string }[]
  const body = { ...client, enabled: true, publicClient: false, protocol: 'openid-connect', implicitFlowEnabled: false, consentRequired: false, fullScopeAllowed: false }
  if (matches[0]) await api(`realms/${realm}/clients/${matches[0].id}`, 'PUT', body)
  else await api(`realms/${realm}/clients`, 'POST', body)
  const current = await (await api(`realms/${realm}/clients?clientId=${client.clientId}`)).json() as { id: string }[]
  const clientPath = `realms/${realm}/clients/${current[0].id}`
  if (client.clientId === 'terrace-web') {
    const scopes = await (await api(`realms/${realm}/client-scopes`)).json() as { id: string; name: string }[]
    for (const name of ['basic', 'profile', 'roles']) {
      const scope = scopes.find((entry) => entry.name === name)
      if (!scope) throw new Error('Required Keycloak client scope is missing.')
      await api(`${clientPath}/default-client-scopes/${scope.id}`, 'PUT')
    }
    const approvedRoles = await Promise.all(['current-member', 'alumni'].map(async (name) => (await api(`realms/${realm}/roles/${name}`)).json()))
    await api(`${clientPath}/scope-mappings/realm`, 'POST', approvedRoles)
  }
}

// Only synthetic local fixtures are seeded; real enrollment is an approval action.
for (const [username, password, role, firstName] of [
  ['local-member', credentials.memberPassword, 'current-member', 'Current Terran'],
  ['local-alumni', credentials.alumniPassword, 'alumni', 'Alumni Terran'],
  ['local-unapproved', credentials.outsiderPassword, '', 'Unapproved Visitor'],
]) {
  let found = await (await api(`realms/${realm}/users?username=${username}&exact=true`)).json() as { id: string }[]
  if (!found[0]) {
    await api(`realms/${realm}/users`, 'POST', { username, firstName, lastName: 'Local Preview', email: `${username}@terrace.invalid`, emailVerified: true, enabled: true, credentials: [{ type: 'password', value: password, temporary: false }] })
    found = await (await api(`realms/${realm}/users?username=${username}&exact=true`)).json() as { id: string }[]
  }
  if (role) {
    const definition = await (await api(`realms/${realm}/roles/${role}`)).json()
    await api(`realms/${realm}/users/${found[0].id}/role-mappings/realm`, 'POST', [definition])
  }
}
const env = {
  MEMBER_AUTH_ISSUER: `${origin}/realms/${realm}`, MEMBER_AUTH_AUDIENCE: 'terrace-community', MEMBER_AUTH_CLIENT_ID: 'terrace-web', MEMBER_AUTH_CLIENT_SECRET: credentials.webSecret,
  MEMBER_AUTH_INTROSPECTION_CLIENT_ID: 'terrace-community', MEMBER_AUTH_INTROSPECTION_SECRET: credentials.introspectionSecret,
  MEMBER_AUTH_ORIGIN: 'http://127.0.0.1:4194',
}
writeFileSync(resolve(state, 'app.env'), Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600 })
chmodSync(resolve(state, 'app.env'), 0o600)
console.log('Dedicated local Keycloak ready at http://127.0.0.1:8184. Credentials and application settings remain in identity/.state/.')
