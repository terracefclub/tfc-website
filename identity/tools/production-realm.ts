import { constants, closeSync, fstatSync, lstatSync, openSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { clientSecuritySettings, clientSettings, realmRoleNames, realmSettings, roleScopeMappings, type ClientCredentials } from './realm-config'
import { productionOrigin, productionSecret } from '../../cms/src/auth/production-input'

const invalid = (): never => { throw new Error('Invalid production realm input.') }
const credentialKeys = ['webSecret', 'introspectionSecret', 'cmsSecret', 'editorialSecret'] as const
const repositoryRoot = realpathSync(fileURLToPath(new URL('../..', import.meta.url)))
const maxInputBytes = 32 * 1024

function httpsOrigin(value: unknown): string {
  try { return productionOrigin(value) } catch { return invalid() }
}

function credentials(value: unknown): ClientCredentials {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  const source = value as Record<string, unknown>
  if (Object.keys(source).length !== credentialKeys.length || !credentialKeys.every(key => Object.hasOwn(source, key))) return invalid()
  const values = credentialKeys.map(key => source[key])
  try { values.forEach(productionSecret) } catch { return invalid() }
  if (new Set(values).size !== credentialKeys.length) return invalid()
  return source as ClientCredentials
}

export function productionRealm(web: unknown, cms: unknown, secrets: unknown) {
  const origins = { webOrigins: [httpsOrigin(web)], cmsOrigins: [httpsOrigin(cms)] }
  return {
    ...realmSettings, sslRequired: 'all', verifyEmail: true,
    roles: { realm: realmRoleNames.map(name => ({ name })) },
    clients: clientSettings(credentials(secrets), origins).map(client => ({
      ...client, ...clientSecuritySettings, clientAuthenticatorType: 'client-secret', serviceAccountsEnabled: false,
    })),
    scopeMappings: Object.entries(roleScopeMappings).map(([client, roles]) => ({ client, roles: [...roles] })),
  }
}

function writePrivateOutput(output: string, contents: string) {
  const parent = realpathSync(dirname(resolve(output)))
  const directory = lstatSync(parent)
  const uid = process.getuid?.()
  if (uid === undefined || !directory.isDirectory() || directory.uid !== uid || (directory.mode & 0o077) !== 0 ||
      parent === repositoryRoot || parent.startsWith(repositoryRoot + sep)) return invalid()
  const destination = join(parent, resolve(output).split(sep).at(-1)!)
  let fd: number | undefined
  let created = false
  try {
    fd = openSync(destination, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
    created = true
    const file = fstatSync(fd)
    if (!file.isFile() || file.uid !== uid || (file.mode & 0o777) !== 0o600) return invalid()
    writeFileSync(fd, contents)
  } catch {
    if (created) unlinkSync(destination)
    throw new Error('Could not write production realm.')
  } finally { if (fd !== undefined) closeSync(fd) }
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2)
    if (args.length !== 6 || args[0] !== '--web-origin' || args[2] !== '--cms-origin' || args[4] !== '--output' || process.stdin.isTTY) invalid()
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of process.stdin) {
      size += chunk.length
      if (size > maxInputBytes) invalid()
      chunks.push(chunk)
    }
    const input = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))
    const artifact = productionRealm(args[1], args[3], JSON.parse(input))
    writePrivateOutput(args[5], JSON.stringify(artifact, null, 2) + '\n')
  } catch {
    // Parser and filesystem errors may quote credentials or private paths.
    console.error('Production realm generation failed. Check the documented input, HTTPS origins, and private output destination.')
    process.exitCode = 1
  }
}
