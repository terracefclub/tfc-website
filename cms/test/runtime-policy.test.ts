import { expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { cmsRuntimeOrigin, runtimeFailure } from '../src/runtime-policy'
import { productionOrigin } from '../src/auth/production-input'
import { productionRealm } from '../../identity/tools/production-realm'

const cms = 'https://editor.terrace.example'
const web = 'https://www.terrace.example'
const identity = 'https://identity.terrace.example/realms/terrace'
const root = '/srv/cms-code'
const credentials = {
  webSecret: 'synthetic-web-'.repeat(4), introspectionSecret: 'synthetic-community-'.repeat(4),
  cmsSecret: 'synthetic-editor-'.repeat(4), editorialSecret: 'synthetic-editorial-'.repeat(4),
}
const generated = productionRealm(web, cms, credentials)
const editor = generated.clients.find(client => client.redirectUris.some(uri => uri.endsWith('/api/editorial/callback')))!
const member = generated.clients.find(client => client.redirectUris.some(uri => uri.endsWith('/auth/callback')))!
const resource = (client: typeof editor) => client.protocolMappers![0].config['included.custom.audience']
const baseline: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  CMS_PUBLIC_DEPLOYMENT: '1', CMS_ORIGIN: cms, CMS_MEDIA_DIR: '/var/lib/terrace-media',
  PAYLOAD_SECRET: 'synthetic-payload-'.repeat(4),
  CMS_AUTH_ISSUER: identity, CMS_AUTH_CLIENT_ID: editor.clientId,
  CMS_AUTH_AUDIENCE: resource(editor), CMS_AUTH_CLIENT_SECRET: editor.secret,
  CMS_AUTH_INTROSPECTION_CLIENT_ID: resource(editor), CMS_AUTH_INTROSPECTION_SECRET: credentials.editorialSecret,
  MEMBER_AUTH_ISSUER: identity, MEMBER_AUTH_CLIENT_ID: member.clientId,
  MEMBER_AUTH_AUDIENCE: resource(member), MEMBER_AUTH_INTROSPECTION_CLIENT_ID: resource(member),
  MEMBER_AUTH_INTROSPECTION_SECRET: credentials.introspectionSecret,
}
const secretKeys = ['PAYLOAD_SECRET', 'CMS_AUTH_CLIENT_SECRET', 'CMS_AUTH_INTROSPECTION_SECRET', 'MEMBER_AUTH_INTROSPECTION_SECRET'] as const
const rejected = (changes: Partial<NodeJS.ProcessEnv>) => expect(() => cmsRuntimeOrigin({ ...baseline, ...changes }, root)).toThrow(runtimeFailure)

test('public CMS consumes the generated four-client contract without changing the realm artifact', () => {
  const before = JSON.stringify(generated)
  expect(cmsRuntimeOrigin(baseline, root)).toBe(cms)
  expect(JSON.stringify(productionRealm(web, cms, credentials))).toBe(before)
  expect(generated.clients.some(client => client.clientId === baseline.CMS_AUTH_INTROSPECTION_CLIENT_ID && !client.standardFlowEnabled)).toBe(true)
  expect(generated.clients.some(client => client.clientId === baseline.MEMBER_AUTH_INTROSPECTION_CLIENT_ID && !client.standardFlowEnabled)).toBe(true)
})

test('the local trial remains loopback-only and public mode requires the exact opt-in', () => {
  expect(cmsRuntimeOrigin({ NODE_ENV: 'test' })).toBe('http://127.0.0.1:3010')
  expect(cmsRuntimeOrigin({ NODE_ENV: 'test', CMS_ORIGIN: 'http://localhost:3040', CMS_LOCAL_BOOTSTRAP: '1' })).toBe('http://localhost:3040')
  for (const value of [undefined, '', '0', 'true', ' 1']) rejected({ CMS_PUBLIC_DEPLOYMENT: value })
  rejected({ CMS_ORIGIN: 'http://127.0.0.1:3040' })
})

test('CMS and realm generation share canonical HTTPS/DNS origin checks', () => {
  for (const value of ['', 'http://editor.terrace.example', 'https://localhost', 'https://app.localhost',
    'https://127.0.0.1', 'https://[::1]', 'https://*.terrace.example', cms + '/', cms + ':443',
    cms + '/path', cms + '?token=private-marker', cms + '#private-marker', 'https://private-marker@editor.terrace.example',
    'https://editor.terrace.example.', 'https://-invalid.example', 'https://www..example', 'https://editor.terrace.example:65536', cms + '\\path']) {
    expect(() => productionOrigin(value)).toThrow()
    expect(() => productionRealm(web, value, credentials)).toThrow('Invalid production realm input.')
    rejected({ CMS_ORIGIN: value })
  }
  expect(cmsRuntimeOrigin({ ...baseline, CMS_ORIGIN: cms + ':8443' }, root)).toBe(cms + ':8443')
})

test('both complete parsed identities must use the same canonical Terrace HTTPS issuer', () => {
  for (const key of ['CMS_AUTH_ISSUER', 'MEMBER_AUTH_ISSUER']) {
    for (const value of [undefined, '', 'private-marker invalid URI', 'http://identity.terrace.example/realms/terrace',
      'https://localhost/realms/terrace', 'https://127.0.0.1/realms/terrace', identity + '/', identity + '?', identity + '#',
      identity.replace('/terrace', '/other'), identity.replace('https://', 'https://private-marker@'), identity.replace('.example/', '.example:443/')]) rejected({ [key]: value })
  }
  rejected({ MEMBER_AUTH_ISSUER: identity.replace('identity.', 'other.') })
  for (const key of ['CMS_AUTH_CLIENT_ID', 'CMS_AUTH_AUDIENCE', 'CMS_AUTH_INTROSPECTION_CLIENT_ID',
    'MEMBER_AUTH_CLIENT_ID', 'MEMBER_AUTH_AUDIENCE', 'MEMBER_AUTH_INTROSPECTION_CLIENT_ID']) {
    for (const value of [undefined, '', 'wrong-client', 'terrace-web\n']) rejected({ [key]: value })
  }
})

test('all four runtime secrets are distinct, trimmed and bounded by UTF-8 bytes', () => {
  for (const key of secretKeys) {
    for (const value of [undefined, '', 'x'.repeat(31), 'x'.repeat(4097), ' ' + baseline[key], baseline[key] + ' ',
      baseline[key] + '\n', baseline[key] + '\x00', baseline[key] + '\x7f', baseline[key] + '\x85']) rejected({ [key]: value })
  }
  for (let i = 0; i < secretKeys.length; i++) {
    for (const other of secretKeys.slice(i + 1)) rejected({ [secretKeys[i]]: baseline[other] })
  }
  expect(cmsRuntimeOrigin({ ...baseline, PAYLOAD_SECRET: 'x'.repeat(32) }, root)).toBe(cms)
  expect(cmsRuntimeOrigin({ ...baseline, PAYLOAD_SECRET: 'x'.repeat(4096) }, root)).toBe(cms)
  expect(cmsRuntimeOrigin({ ...baseline, PAYLOAD_SECRET: '😀'.repeat(8) }, root)).toBe(cms)
})

test('bootstrap settings are absent in public mode, even when false or empty', () => {
  for (const key of ['CMS_LOCAL_BOOTSTRAP', 'CMS_BOOTSTRAP_EMAIL', 'CMS_BOOTSTRAP_PASSWORD', 'CMS_BOOTSTRAP_OTHER']) {
    for (const value of [undefined, '', '0', 'private-marker']) rejected({ [key]: value })
  }
})

test('public media is explicitly normalized and external to code and the Nix store', () => {
  for (const value of [undefined, '', 'uploads', '../uploads', '/', '/nix/store', '/nix/store/package/uploads',
    root, root + '/uploads', '/srv', '/var/lib/uploads/', '/var/lib/../uploads', '/var/lib/line\nbreak', '/var/lib/null\0byte']) rejected({ CMS_MEDIA_DIR: value })
  expect(cmsRuntimeOrigin({ ...baseline, CMS_MEDIA_DIR: '/nix/store-archive/media' }, root)).toBe(cms)
  expect(cmsRuntimeOrigin(baseline, '/nix/store/immutable-cms')).toBe(cms)
})

function startupEnv(changes: Partial<NodeJS.ProcessEnv> = {}) {
  const env = { ...process.env, ...baseline, ...changes }
  for (const name of Object.keys(env)) if (name === 'CMS_LOCAL_BOOTSTRAP' || name.startsWith('CMS_BOOTSTRAP_')) delete env[name]
  return env
}

const config = fileURLToPath(new URL('../src/payload.config.ts', import.meta.url))

test('public Payload configuration loads without contacting a provider or requiring media filesystem state', () => {
  const result = spawnSync(process.execPath, ['-e', `globalThis.fetch = () => { throw new Error('Unexpected provider call.') }; const config = await (await import(${JSON.stringify(config)})).default; if (config.serverURL !== ${JSON.stringify(cms)}) process.exit(2)`], {
    env: startupEnv({ DATABASE_URI: 'postgresql://synthetic.invalid/terrace', CMS_MEDIA_DIR: '/nonexistent-terrace-test/media' }),
    encoding: 'utf8', timeout: 15000, maxBuffer: 65536,
  })
  expect(result.status).toBe(0)
  expect(result.stdout).toBe('')
  expect(result.stderr).toBe('')
})

test('startup parser failures expose static errors rather than URI or secret markers', () => {
  const marker = 'SYNTHETIC-PRIVATE-MARKER'
  for (const key of ['CMS_ORIGIN', 'CMS_AUTH_ISSUER', 'MEMBER_AUTH_ISSUER']) {
    const result = spawnSync(process.execPath, ['-e', `try { await import(${JSON.stringify(config)}); process.exit(2) } catch (error) { if (String(error.stack).includes(${JSON.stringify(marker)}) || 'input' in error || 'cause' in error) process.exit(3); console.error(error.message); process.exit(1) }`], {
      env: startupEnv({ [key]: marker }), encoding: 'utf8', timeout: 15000, maxBuffer: 65536,
    })
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).not.toContain(marker)
    expect(result.stderr).toMatch(/^(Invalid CMS runtime configuration\.|Invalid member identity issuer\.|Invalid CMS origin\.)/)
  }
})
