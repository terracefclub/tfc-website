import { expect, test } from 'bun:test'
import { clientSettings, realmSettings, webOrigins } from '../tools/realm-config'

test('local realm requires approval and uses short, rotating sessions', () => {
  expect(realmSettings.registrationAllowed).toBe(false)
  expect(realmSettings.bruteForceProtected).toBe(true)
  expect(realmSettings.accessTokenLifespan).toBe(60)
  expect(realmSettings.revokeRefreshToken).toBe(true)
  expect(realmSettings.refreshTokenMaxReuse).toBe(0)
})
test('browser client is PKCE only with exact loopback returns and a separate resource audience', () => {
  const [web, resource] = clientSettings({ webSecret: 'synthetic-web', introspectionSecret: 'synthetic-resource' })
  expect(web.attributes?.['pkce.code.challenge.method']).toBe('S256')
  expect(web.directAccessGrantsEnabled).toBe(false)
  expect(web.defaultClientScopes).toContain('basic')
  expect(web.defaultClientScopes).toContain('roles')
  expect(web.redirectUris).toEqual(webOrigins.map(value => `${value}/auth/callback`))
  expect(webOrigins.every(value => new URL(value).hostname === '127.0.0.1' && !value.includes('*'))).toBe(true)
  expect(web.protocolMappers?.[0].config['included.custom.audience']).toBe(resource.clientId)
  expect(web.protocolMappers?.[0].config['id.token.claim']).toBe('false')
  expect(resource.standardFlowEnabled).toBe(false)
  expect(resource.serviceAccountsEnabled).toBe(false)
  expect(resource.redirectUris).toEqual([])
})
