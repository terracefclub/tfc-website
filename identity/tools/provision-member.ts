import { randomBytes } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { approvedApplicationEmail, assertLoopbackOrigin, isMemberRole, offboardRealmUser, provisionMember, type Api } from './member-provision'
import { keycloakOrigin } from './realm-config'

// Operator tool for the LOCAL synthetic realm. See docs/member-lifecycle.md.
//   bun identity/tools/provision-member.ts provision --username u --application ID --name "N" --role alumni
// The email comes from the approved application (read from the local CMS database named by DATABASE_URI with psql), never typed.
//   bun identity/tools/provision-member.ts offboard --username u
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const state = resolve(root, '.state')
const [command, ...rest] = process.argv.slice(2)
const args: Record<string, string> = {}
for (let index = 0; index < rest.length; index += 2) {
  if (!rest[index]?.startsWith('--') || rest[index + 1] === undefined) throw new Error('Usage: provision-member.ts provision|offboard --username ... [--application ID --name ... --role ...]')
  args[rest[index].slice(2)] = rest[index + 1]
}
if (!['provision', 'offboard'].includes(command ?? '')) throw new Error('Usage: provision-member.ts provision|offboard --username ...')

const credentialsPath = resolve(state, 'credentials.json')
if (!existsSync(credentialsPath)) throw new Error('Run the local identity bootstrap first.')
const adminPassword = JSON.parse(readFileSync(credentialsPath, 'utf8')).adminPassword
if (typeof adminPassword !== 'string' || !adminPassword) throw new Error('Local identity credentials are unavailable.')
const port = Number(args.port ?? process.env.KEYCLOAK_HTTP_PORT ?? 8184)
const origin = assertLoopbackOrigin(keycloakOrigin(port))

const login = await fetch(`${origin}/realms/master/protocol/openid-connect/token`, {
  method: 'POST', redirect: 'error', body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: 'terrace-local-admin', password: adminPassword }), signal: AbortSignal.timeout(5000),
})
if (!login.ok) throw new Error('Could not authenticate to the local Keycloak; nothing was changed.')
const { access_token: token } = await login.json() as { access_token: string }
const api: Api = (path, method = 'GET', data) => fetch(`${origin}/admin/${path}`, {
  method, redirect: 'error', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(5000),
})

if (command === 'offboard') {
  const result = await offboardRealmUser(api, args.username ?? '')
  console.log(result.found ? `Disabled ${args.username}; removed ${result.rolesRemoved} member role(s); sessions ended.` : `No realm user named ${args.username}; nothing to do.`)
} else {
  if (!isMemberRole(args.role)) throw new Error('--role must be current-member or alumni.')
  const lookup = async (id: number) => {
    if (!process.env.DATABASE_URI) throw new Error('DATABASE_URI (the local CMS database) is required to read the application; run through cms/tools/with-local.')
    const out = execFileSync('psql', [process.env.DATABASE_URI, '-Atq', '-v', `id=${id}`], { encoding: 'utf8', input: "select contact_email from member_applications where id = :id and status = 'approved'" }).trim()
    return out || null
  }
  const email = await approvedApplicationEmail(args.application ?? '', lookup, args.email)
  const result = await provisionMember(api, { username: args.username ?? '', email, name: args.name ?? '', role: args.role, temporaryPassword: () => randomBytes(18).toString('base64url') })
  if (result.password) {
    // The temporary password is written to a private file for the operator to deliver; it is never printed.
    const directory = resolve(state, 'provisioned')
    mkdirSync(directory, { recursive: true, mode: 0o700 })
    const file = resolve(directory, `${args.username}.txt`)
    writeFileSync(file, `${result.password}\n`, { mode: 0o600 })
    chmodSync(file, 0o600)
    console.log(`Created ${args.username} with role ${result.role}. Temporary password (change required at first sign-in) is in ${file}.`)
  } else console.log(`${args.username} already existed; enabled with role ${result.role}. Credentials unchanged.`)
}
