export const keycloakOrigin = (port = 8184) => `http://127.0.0.1:${port}`
export const origin = keycloakOrigin()
export const realm = 'terrace'
export const webOrigins = ['http://127.0.0.1:4174', 'http://127.0.0.1:4176', 'http://127.0.0.1:4194', 'http://127.0.0.1:4240']
export const cmsOrigins = ['http://127.0.0.1:3010', 'http://127.0.0.1:3032', 'http://127.0.0.1:3040']
export const memberRoleNames = ['current-member', 'alumni'] as const
export const editorialRoleNames = ['editorial-editor', 'editorial-admin'] as const
export const realmRoleNames = [...memberRoleNames, ...editorialRoleNames] as const
export const clientSecuritySettings = { enabled: true, publicClient: false, protocol: 'openid-connect', implicitFlowEnabled: false, consentRequired: false, fullScopeAllowed: false } as const
export type ClientCredentials = { webSecret: string; introspectionSecret: string; cmsSecret: string; editorialSecret: string }
export type ClientOrigins = { webOrigins: readonly string[]; cmsOrigins: readonly string[] }
export const roleScopeMappings = { 'terrace-web': memberRoleNames, 'terrace-cms': editorialRoleNames } as const
export const syntheticIdentityRoles = [
  { username: 'local-member', roles: ['current-member'] },
  { username: 'local-alumni', roles: ['alumni'] },
  { username: 'local-unapproved', roles: [] },
  { username: 'local-editorial-editor', roles: ['editorial-editor'] },
  { username: 'local-editorial-admin', roles: ['editorial-admin'] },
] as const
// The member's verified `email` claim binds a first sign-in to their redeemed invitation (cms/src/lifecycle/linking.ts),
// so addresses are unique (no duplicates, usernames fixed). The production realm also has `verifyEmail: true`, so an address a user
// changes becomes unverified and the CMS ignores it; the local bootstrap additionally makes the address administrator-only (local-up.ts).
// Admin events audit administrator changes to site accounts; details stay off so no representation (personal data or secrets) is stored in event payloads.
export const realmSettings = { realm, enabled: true, displayName: 'Terrace', registrationAllowed: false, resetPasswordAllowed: false, loginWithEmailAllowed: true, duplicateEmailsAllowed: false, editUsernameAllowed: false, bruteForceProtected: true, sslRequired: 'none', accessTokenLifespan: 60, ssoSessionIdleTimeout: 1800, ssoSessionMaxLifespan: 28800, revokeRefreshToken: true, refreshTokenMaxReuse: 0, adminEventsEnabled: true, adminEventsDetailsEnabled: false }
const audienceMapper = { name: 'community-resource', protocol: 'openid-connect', protocolMapper: 'oidc-audience-mapper', config: { 'included.custom.audience': 'terrace-community', 'id.token.claim': 'false', 'access.token.claim': 'true' } }
export function localClientOrigins(web?: string, cms?: string): ClientOrigins {
  if (web === undefined && cms === undefined) return { webOrigins, cmsOrigins }
  const exact = (value?: string) => {
    try {
      const url = new URL(value || '')
      if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || Number(url.port) < 1024 || Number(url.port) > 64535) throw new Error()
      return url.origin
    } catch { throw new Error('Local client origins must be exact loopback HTTP origins with bounded ports.') }
  }
  return { webOrigins: [exact(web)], cmsOrigins: [exact(cms)] }
}
export function clientSettings(credentials: ClientCredentials, origins: ClientOrigins = { webOrigins, cmsOrigins }) {
  const { webOrigins, cmsOrigins } = origins
  return [
  { clientId: 'terrace-web', secret: credentials.webSecret, standardFlowEnabled: true, directAccessGrantsEnabled: false, redirectUris: webOrigins.map((value) => `${value}/auth/callback`), webOrigins, attributes: { 'pkce.code.challenge.method': 'S256', 'post.logout.redirect.uris': webOrigins.map((value) => `${value}/`).join('##') }, protocolMappers: [audienceMapper], defaultClientScopes: ['basic', 'profile', 'email', 'roles'], optionalClientScopes: [] },
  { clientId: 'terrace-community', secret: credentials.introspectionSecret, standardFlowEnabled: false, directAccessGrantsEnabled: false, serviceAccountsEnabled: false, redirectUris: [], webOrigins: [] },
  { clientId: 'terrace-cms', secret: credentials.cmsSecret, standardFlowEnabled: true, directAccessGrantsEnabled: false, redirectUris: cmsOrigins.map((value) => `${value}/api/editorial/callback`), webOrigins: cmsOrigins, attributes: { 'pkce.code.challenge.method': 'S256', 'post.logout.redirect.uris': cmsOrigins.map((value) => `${value}/admin/login`).join('##') }, protocolMappers: [{ ...audienceMapper, name: 'editorial-resource', config: { ...audienceMapper.config, 'included.custom.audience': 'terrace-editorial' } }], defaultClientScopes: ['basic', 'profile', 'roles'], optionalClientScopes: [] },
  { clientId: 'terrace-editorial', secret: credentials.editorialSecret, standardFlowEnabled: false, directAccessGrantsEnabled: false, serviceAccountsEnabled: false, redirectUris: [], webOrigins: [] },
] }

type ProfileAttribute = { name: string; permissions?: { view?: string[]; edit?: string[] }; [key: string]: unknown }
export type UserProfile = { attributes?: ProfileAttribute[]; [key: string]: unknown }

/**
 * The member's verified `email` binds a first sign-in to their invitation (cms/src/lifecycle/linking.ts), so only an administrator may
 * set or change it. Returns the profile with that one restriction applied (idempotent); used by the local bootstrap on the live profile
 * and by the production realm artifact on Keycloak's default profile.
 */
export function restrictEmailEdit<T extends UserProfile>(profile: T): T {
  const email = profile.attributes?.find(attribute => attribute.name === 'email');
  if (email) email.permissions = { view: email.permissions?.view ?? ['admin', 'user'], edit: ['admin'] };
  return profile;
}

/** Keycloak's default declarative user profile (username, email, first and last name) with email editable by administrators only. */
export const memberUserProfile = (): UserProfile => restrictEmailEdit({
  attributes: [
    { name: 'username', displayName: '${username}', validations: { length: { min: 3, max: 255 }, 'username-prohibited-characters': {}, 'up-username-not-idn-homograph': {} }, permissions: { view: ['admin', 'user'], edit: ['admin', 'user'] }, multivalued: false },
    { name: 'email', displayName: '${email}', validations: { email: {}, length: { max: 255 } }, required: { roles: ['user'] }, permissions: { view: ['admin', 'user'], edit: ['admin', 'user'] }, multivalued: false },
    { name: 'firstName', displayName: '${firstName}', validations: { length: { max: 255 }, 'person-name-prohibited-characters': {} }, required: { roles: ['user'] }, permissions: { view: ['admin', 'user'], edit: ['admin', 'user'] }, multivalued: false },
    { name: 'lastName', displayName: '${lastName}', validations: { length: { max: 255 }, 'person-name-prohibited-characters': {} }, required: { roles: ['user'] }, permissions: { view: ['admin', 'user'], edit: ['admin', 'user'] }, multivalued: false },
  ],
  groups: [{ name: 'user-metadata', displayHeader: 'User metadata', displayDescription: 'Attributes, which refer to user metadata' }],
});
