export const origin = 'http://127.0.0.1:8184'
export const realm = 'terrace'
export const webOrigins = ['http://127.0.0.1:4174', 'http://127.0.0.1:4176', 'http://127.0.0.1:4194', 'http://127.0.0.1:4240']
export const realmSettings = { realm, enabled: true, displayName: 'Terrace', registrationAllowed: false, resetPasswordAllowed: false, loginWithEmailAllowed: true, duplicateEmailsAllowed: false, bruteForceProtected: true, sslRequired: 'none', accessTokenLifespan: 60, ssoSessionIdleTimeout: 1800, ssoSessionMaxLifespan: 28800, revokeRefreshToken: true, refreshTokenMaxReuse: 0 }
const audienceMapper = { name: 'community-resource', protocol: 'openid-connect', protocolMapper: 'oidc-audience-mapper', config: { 'included.custom.audience': 'terrace-community', 'id.token.claim': 'false', 'access.token.claim': 'true' } }
export function clientSettings(credentials: { webSecret: string; introspectionSecret: string }) { return [
  { clientId: 'terrace-web', secret: credentials.webSecret, standardFlowEnabled: true, directAccessGrantsEnabled: false, redirectUris: webOrigins.map((value) => `${value}/auth/callback`), webOrigins, attributes: { 'pkce.code.challenge.method': 'S256', 'post.logout.redirect.uris': webOrigins.map((value) => `${value}/`).join('##') }, protocolMappers: [audienceMapper], defaultClientScopes: ['basic', 'profile', 'roles'], optionalClientScopes: [] },
  { clientId: 'terrace-community', secret: credentials.introspectionSecret, standardFlowEnabled: false, directAccessGrantsEnabled: false, serviceAccountsEnabled: false, redirectUris: [], webOrigins: [] },
] }
