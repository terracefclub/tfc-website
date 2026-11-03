import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { chmodSync, closeSync, existsSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { clientSecuritySettings, clientSettings, cmsOrigins, realmRoleNames, realmSettings, roleScopeMappings, webOrigins } from '../tools/realm-config'
import { productionRealm } from '../tools/production-realm'

// Deliberately readable synthetic fixtures, never credentials from a running realm.
const marker = 'SYNTHETIC_PRIVATE_INPUT_MARKER'
const secrets = {
  webSecret: marker + '_web'.repeat(8), introspectionSecret: marker + '_resource'.repeat(8),
  cmsSecret: marker + '_cms'.repeat(8), editorialSecret: marker + '_editorial'.repeat(8),
}
const web = 'https://www.terrace.example'
const cms = 'https://editor.terrace.example:8443'
const tool = fileURLToPath(new URL('../tools/production-realm.ts', import.meta.url))
const failure = 'Production realm generation failed. Check the documented input, HTTPS origins, and private output destination.\n'

function cli(output: string, input: string | Buffer = JSON.stringify(secrets), origins = [web, cms]) {
  return spawnSync(process.execPath, [tool, '--web-origin', origins[0], '--cms-origin', origins[1], '--output', output], { input, encoding: 'utf8' })
}
function privateDirectory() {
  const path = mkdtempSync(join(tmpdir(), 'terrace-production-realm-'))
  chmodSync(path, 0o700)
  return path
}
function rejected(run: ReturnType<typeof cli>) {
  expect(run.status).toBe(1)
  expect(run.stdout).toBe('')
  expect(run.stderr).toBe(failure)
  expect(run.stderr).not.toContain(marker)
}

test('production artifact derives its clients, audiences and disjoint scope roles from the local contract', () => {
  const artifact = productionRealm(web, cms, secrets)
  expect(artifact).toMatchObject({ realm: 'terrace', enabled: true, registrationAllowed: false, resetPasswordAllowed: false,
    sslRequired: 'all', verifyEmail: true, duplicateEmailsAllowed: false, bruteForceProtected: true,
    accessTokenLifespan: 60, ssoSessionIdleTimeout: 1800, ssoSessionMaxLifespan: 28800, revokeRefreshToken: true, refreshTokenMaxReuse: 0 })
  expect(artifact.roles.realm).toEqual(realmRoleNames.map(name => ({ name })))
  expect(artifact.scopeMappings).toEqual(Object.entries(roleScopeMappings).map(([client, roles]) => ({ client, roles: [...roles] })))
  const expected = clientSettings(secrets, { webOrigins: [web], cmsOrigins: [cms] })
  expect(artifact.clients).toEqual(expected.map(client => ({ ...client, ...clientSecuritySettings,
    clientAuthenticatorType: 'client-secret', serviceAccountsEnabled: false })))
  expect(artifact.clients.map(client => client.clientId)).toEqual(clientSettings(secrets).map(client => client.clientId))
  for (const client of artifact.clients) {
    expect(client).toMatchObject({ publicClient: false, directAccessGrantsEnabled: false, implicitFlowEnabled: false,
      serviceAccountsEnabled: false, fullScopeAllowed: false, protocol: 'openid-connect' })
    if (client.standardFlowEnabled) {
      expect(client.attributes?.['pkce.code.challenge.method']).toBe('S256')
      expect(client.defaultClientScopes).toEqual(['basic', 'profile', 'roles'])
      expect(client.optionalClientScopes).toEqual([])
      expect(client.protocolMappers?.[0].config['id.token.claim']).toBe('false')
      expect(client.protocolMappers?.[0].config['access.token.claim']).toBe('true')
    } else {
      expect(client.redirectUris).toEqual([])
      expect(client.webOrigins).toEqual([])
    }
  }
  expect(artifact.clients[0].redirectUris).toEqual([web + '/auth/callback'])
  expect(artifact.clients[0].attributes?.['post.logout.redirect.uris']).toBe(web + '/')
  expect(artifact.clients[2].redirectUris).toEqual([cms + '/api/editorial/callback'])
  expect(artifact.clients[2].attributes?.['post.logout.redirect.uris']).toBe(cms + '/admin/login')
  const json = JSON.stringify(artifact)
  expect(Buffer.byteLength(json)).toBeLessThan(1024 * 1024)
  for (const forbidden of ['users', 'federatedUsers', 'identityProviders', 'identityProviderMappers', 'userFederationProviders',
    'userFederationMappers', 'components', 'smtpServer', 'admin-cli', 'realm-management', 'local-member', 'local-editorial-admin', '127.0.0.1']) {
    expect(json).not.toContain(forbidden)
  }
})

test('production generation does not mutate local origins, policy or fixture client settings', () => {
  const before = JSON.stringify({ realmSettings, clients: clientSettings(secrets), webOrigins, cmsOrigins })
  productionRealm(web, cms, secrets)
  expect(JSON.stringify({ realmSettings, clients: clientSettings(secrets), webOrigins, cmsOrigins })).toBe(before)
  expect(realmSettings.sslRequired).toBe('none')
  expect(clientSettings(secrets)[0].redirectUris).toEqual(webOrigins.map(value => value + '/auth/callback'))
})

test('rejects noncanonical, credential-bearing, non-HTTPS, wildcard, path and non-DNS origins', () => {
  for (const origin of [null, '', 'http://www.terrace.example', 'https://localhost', 'https://app.localhost',
    'https://127.0.0.1', 'https://[::1]', 'https://*.terrace.example', 'https://www.terrace.example/',
    'https://www.terrace.example/path', 'https://www.terrace.example?token=' + marker,
    'https://www.terrace.example#' + marker, 'https://' + marker + '@www.terrace.example',
    'https://www.terrace.example:443', 'https://www.terrace.example.', 'https://-invalid.example',
    'https://www..example', 'https://www.terrace.example:65536', 'https://www.terrace.example\\path']) {
    expect(() => productionRealm(origin, cms, secrets)).toThrow('Invalid production realm input.')
    expect(() => productionRealm(web, origin, secrets)).toThrow('Invalid production realm input.')
  }
})

test('requires all four distinct bounded client secrets and rejects local credential exports', () => {
  for (const key of Object.keys(secrets)) {
    const missing = { ...secrets } as Record<string, unknown>
    delete missing[key]
    expect(() => productionRealm(web, cms, missing)).toThrow('Invalid production realm input.')
    for (const invalid of [null, 1, '', 'short', ' '.repeat(32), '\n' + marker, 'a'.repeat(4097), marker + '\u0000']) {
      expect(() => productionRealm(web, cms, { ...secrets, [key]: invalid })).toThrow('Invalid production realm input.')
    }
  }
  for (const invalid of [null, [], { ...secrets, adminPassword: marker }, { ...secrets, cmsSecret: secrets.webSecret }]) {
    expect(() => productionRealm(web, cms, invalid)).toThrow('Invalid production realm input.')
  }
})

test('CLI writes one new owner-only file outside the checkout and emits no artifact or secret on either stream', () => {
  const dir = privateDirectory()
  const output = join(dir, 'terrace-realm.json')
  try {
    const run = cli(output)
    expect(run.status).toBe(0)
    expect(run.stdout).toBe('')
    expect(run.stderr).toBe('')
    expect(lstatSync(output).mode & 0o777).toBe(0o600)
    expect(lstatSync(output).uid).toBe(process.getuid!())
    expect(JSON.parse(readFileSync(output, 'utf8'))).toEqual(productionRealm(web, cms, secrets))
    const original = readFileSync(output)
    rejected(cli(output))
    expect(readFileSync(output)).toEqual(original)
    const link = join(dir, 'link.json')
    symlinkSync(output, link)
    rejected(cli(link))
    expect(lstatSync(link).isSymbolicLink()).toBe(true)
    expect(readFileSync(output)).toEqual(original)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('CLI fails without partial output, private contents or raw parser/path diagnostics', () => {
  const dir = privateDirectory()
  const output = join(dir, marker + '.json')
  const innerRoot = fileURLToPath(new URL('../.state', import.meta.url))
  mkdirSync(innerRoot, { recursive: true, mode: 0o700 })
  const checkout = mkdtempSync(join(innerRoot, 'production-test-'))
  try {
    for (const input of ['{"' + marker, JSON.stringify({ ...secrets, webSecret: marker }), Buffer.from([0xff, 0xfe]),
      Buffer.alloc(32 * 1024 + 1, 32), JSON.stringify({ ...secrets, users: [{ name: marker }] })]) {
      rejected(cli(output, input))
      expect(existsSync(output)).toBe(false)
    }
    rejected(cli(output, JSON.stringify(secrets), ['https://' + marker + '@invalid.example', cms]))
    rejected(cli(join(checkout, 'realm.json')))
    expect(existsSync(join(checkout, 'realm.json'))).toBe(false)
    chmodSync(dir, 0o755)
    rejected(cli(output))
    expect(existsSync(output)).toBe(false)
  } finally {
    rmSync(checkout, { recursive: true, force: true })
    rmSync(dir, { recursive: true, force: true })
  }
})

// The hosting policy stays owned by Womb; do not copy it into this repository.
test.skipIf(!process.env.WOMB_REALM_POLICY)('synthetic production artifact passes the configured Womb hosting policy', () => {
  const dir = privateDirectory()
  try {
    const output = join(dir, 'realm.json')
    expect(cli(output).status).toBe(0)
    const run = spawnSync('jq', ['-e', '-f', process.env.WOMB_REALM_POLICY!, output], { stdio: 'ignore' })
    expect(run.status).toBe(0)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

// Opt-in because CI's lightweight policy image has no Java/Keycloak distribution.
test.skipIf(!process.env.KEYCLOAK_ARCHIVE)('pinned Keycloak imports and exports the synthetic production client and role scopes', () => {
  const pin = JSON.parse(readFileSync(new URL('../keycloak-pin.json', import.meta.url), 'utf8'))
  const archive = process.env.KEYCLOAK_ARCHIVE!
  if (createHash('sha256').update(readFileSync(archive)).digest('hex') !== pin.sha256) throw new Error('Keycloak archive hash mismatch.')
  const dir = privateDirectory()
  const log = openSync(join(dir, 'keycloak.log'), 'a', 0o600)
  const nativeEnv = { PATH: process.env.PATH!, JAVA_HOME: process.env.JAVA_HOME!,
    JAVA_OPTS_KC_HEAP: '-Xms128m -Xmx512m', JAVA_OPTS_APPEND: '-XX:MaxMetaspaceSize=256m' }
  let passed = false
  try {
    expect(spawnSync('tar', ['-xzf', archive, '-C', dir], { stdio: 'ignore', timeout: 30000 }).status).toBe(0)
    const input = join(dir, 'terrace-realm.json')
    expect(cli(input).status).toBe(0)
    const keycloak = join(dir, `keycloak-${pin.version}`, 'bin/kc.sh')
    expect(spawnSync(keycloak, ['import', '--file', input, '--override=false', '--db=dev-file'], {
      env: nativeEnv, stdio: ['ignore', log, log], timeout: 90000,
    }).status).toBe(0)
    const output = join(dir, 'export.json')
    expect(spawnSync(keycloak, ['export', '--realm', 'terrace', '--file', output, '--db=dev-file'], {
      env: nativeEnv, stdio: ['ignore', log, log], timeout: 90000,
    }).status).toBe(0)
    const imported = JSON.parse(readFileSync(output, 'utf8'))
    const expected = productionRealm(web, cms, secrets)
    for (const client of expected.clients) {
      const actual = imported.clients.find((entry: { clientId: string }) => entry.clientId === client.clientId)
      expect(actual).toMatchObject({ clientId: client.clientId, secret: client.secret, publicClient: false,
        standardFlowEnabled: client.standardFlowEnabled, directAccessGrantsEnabled: false, implicitFlowEnabled: false,
        serviceAccountsEnabled: false, fullScopeAllowed: false, redirectUris: client.redirectUris, webOrigins: client.webOrigins })
      if (client.standardFlowEnabled) {
        expect(actual.defaultClientScopes.toSorted()).toEqual(client.defaultClientScopes!.toSorted())
        expect(actual.attributes).toMatchObject(client.attributes!)
        const mapper = actual.protocolMappers.find((entry: { name: string }) => entry.name === client.protocolMappers![0].name)
        expect(mapper).toMatchObject(client.protocolMappers![0])
      }
    }
    for (const mapping of expected.scopeMappings) {
      expect(imported.scopeMappings.find((entry: { client: string }) => entry.client === mapping.client)?.roles.toSorted()).toEqual(mapping.roles.toSorted())
    }
    expect(imported.users ?? []).toEqual([])
    expect(imported.verifyEmail).toBe(true)
    expect(imported.sslRequired).toBe('all')
    expect(imported.registrationAllowed).toBe(false)
    passed = true
  } finally {
    closeSync(log)
    if (passed) rmSync(dir, { recursive: true, force: true })
    else console.error('Synthetic Keycloak diagnostics retained in protected directory:', dir)
  }
}, 210000)
