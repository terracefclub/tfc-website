import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium, type BrowserContext, type Page } from 'playwright'

const origin = process.env.CMS_ORIGIN || 'http://127.0.0.1:3040'
const issuer = process.env.CMS_AUTH_ISSUER || ''
const identityState = process.env.TERRACE_TEST_IDENTITY_STATE
for (const value of [origin, issuer]) {
  const url = new URL(value)
  if (url.hostname !== '127.0.0.1' || url.protocol !== 'http:' || url.username || url.password) throw new Error('Browser tests only target owned loopback fixtures.')
}
if (!identityState) throw new Error('TERRACE_TEST_IDENTITY_STATE must reference the dedicated local fixtures.')
// Fixture credentials are consumed only by the browser/API, never printed or saved in artifacts.
const credentials = JSON.parse(readFileSync(resolve(identityState, 'credentials.json'), 'utf8'))
const browser = await chromium.launch({ headless: true })
let stage = 'start', count = 0
class TestFailure extends Error {}
const assert = (condition: unknown, message: string) => { if (!condition) throw new TestFailure(message); count++ }
const contexts: BrowserContext[] = []
async function signIn(username: string, password: string, tamperState = false) {
  const context = await browser.newContext()
  contexts.push(context)
  const page = await context.newPage()
  page.on('pageerror', (error) => console.error(`CMS client exception: ${['TypeError', 'ReferenceError', 'SyntaxError', 'Error'].includes(error.name) ? error.name : 'unclassified'}.`))
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname
    if (response.status() >= 400 && /\.(js|css)$/.test(path)) console.error(`CMS static asset failed: HTTP ${response.status()}.`)
  })
  const previousStage = stage
  stage = `${username}: open login`
  let changedState = false
  if (tamperState) await page.route((url) => url.origin === new URL(issuer).origin && url.pathname.includes('/login-actions/authenticate'), async (route) => {
    const response = await route.fetch({ maxRedirects: 0 })
    const headers = response.headers()
    if (headers.location?.startsWith(`${origin}/api/editorial/callback?`)) {
      const url = new URL(headers.location); url.searchParams.set('state', 'wrong-state')
      headers.location = url.href
      changedState = true
    }
    await route.fulfill({ response, headers })
  })
  await page.goto(`${origin}/admin/login`)
  stage = `${username}: open Keycloak`
  await page.getByRole('button', { name: 'Sign in with Terrace', exact: true }).click()
  stage = `${username}: enter fixture credentials`
  await page.locator('#username').fill(username)
  await page.locator('#password').fill(password)
  await page.locator('#kc-login').click()
  stage = `${username}: callback`
  await page.waitForURL((url) => url.origin === origin && url.pathname.startsWith('/admin'), { timeout: 60_000 })
  if (tamperState) assert(changedState, 'Callback interception did not run')
  stage = previousStage
  return { page, context }
}
const me = async (page: Page) => (await page.request.get(`${origin}/api/users/me`)).json()
let adminToken = ''
const keycloak = async (path: string, method = 'GET', body?: unknown) => {
  const response = await fetch(`${new URL(issuer).origin}/admin/realms/terrace/${path}`, {
    method, headers: { authorization: `Bearer ${adminToken}`, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined,
    redirect: 'error', signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) throw new Error('Fixture administration failed')
  return response
}
async function signOut(page: Page) {
  stage = 'logout hydration'
  await page.bringToFront()
  await page.reload({ waitUntil: 'networkidle' })
  const nav = page.locator('aside.nav')
  await page.locator('aside.nav--nav-hydrated').waitFor({ state: 'attached' })
  stage = 'logout menu'
  const logoutButton = page.getByRole('button', { name: 'Sign out of Terrace', exact: true })
  if (await nav.getAttribute('inert') !== null) {
    const toggle = page.getByRole('button', { name: /^open menu$/i })
    await toggle.click()
  }
  await page.locator('aside.nav:not([inert])').waitFor({ state: 'visible', timeout: 10_000 })
  stage = 'logout button'
  await logoutButton.click()
  stage = 'logout return'
  await page.waitForURL((url) => url.pathname.endsWith('/admin/login') || url.pathname.includes('/logout'))
  if (new URL(page.url()).origin === new URL(issuer).origin) {
    await page.locator('#kc-logout').click()
  }
  await page.waitForURL((url) => url.origin === origin && url.pathname === '/admin/login')
  assert(!(await me(page)).user, 'Logout retained editorial access')
}
let createdEvent: number | undefined
let adminPage: Page | undefined
try {
  stage = 'administrator sign-in'
  const administrator = await signIn('local-editorial-admin', credentials.editorialAdminPassword); adminPage = administrator.page
  assert((await me(adminPage)).user?.role === 'admin', 'Administrator mapping failed')
  stage = 'editor sign-in and immutable account'
  const editor = await signIn('local-editorial-editor', credentials.editorialEditorPassword)
  const first = await me(editor.page)
  assert(first.user?.collection === 'users' && first.user?.role === 'editor', 'Editor login denied')
  assert(!first.token && !first.user.identityKey, 'Private identity data exposed')
  assert((await editor.context.cookies()).some((cookie) => cookie.name.startsWith('terrace_cms_') && !cookie.name.endsWith('_login') && cookie.httpOnly), 'Opaque session cookie missing')
  await editor.page.screenshot({ path: '.state/editorial-editor.png', fullPage: true })
  const again = await signIn('local-editorial-editor', credentials.editorialEditorPassword)
  assert((await me(again.page)).user?.id === first.user.id, 'Same subject got a different account')
  stage = 'editor permissions and CSRF'
  const denied = await editor.page.request.post(`${origin}/api/users`, { headers: { origin }, data: { email: 'denied@terrace.invalid', displayName: 'Denied', role: 'admin' } })
  assert(denied.status() === 403, 'Editor created a user')
  const changed = await editor.page.request.patch(`${origin}/api/users/${first.user.id}`, { headers: { origin }, data: { role: 'admin' } })
  assert(changed.status() === 403 && (await me(editor.page)).user.role === 'editor', 'Editor escalated role')
  const passwordChange = await editor.page.request.patch(`${origin}/api/users/${first.user.id}`, { headers: { origin }, data: { email: 'local@terrace.invalid', password: crypto.randomUUID() } })
  assert(passwordChange.status() === 403, 'Managed account accepted local credentials')
  const event = { slug: `sso-browser-${crypto.randomUUID()}`, title: 'Synthetic SSO browser test', summary: 'Temporary fixture, removed by test.', startsAt: '2030-01-18T23:00:00.000Z', category: 'music', locationName: 'Test only', _status: 'draft' }
  const forged = await editor.page.request.post(`${origin}/api/events`, { headers: { origin: 'https://attacker.invalid' }, data: event })
  assert(forged.status() === 403, 'Cross-origin mutation accepted')
  const created = await editor.page.request.post(`${origin}/api/events`, { headers: { origin }, data: event })
  assert(created.ok(), 'Editor cannot create content'); createdEvent = (await created.json()).doc.id
  assert((await editor.page.request.delete(`${origin}/api/events/${createdEvent}`, { headers: { origin } })).status() === 403, 'Editor deleted content')
  assert(!(await editor.page.request.post(`${origin}/api/users/login`, { data: { email: first.user.email, password: 'irrelevant' } })).ok(), 'Local password route enabled')
  const refreshed = await editor.page.request.post(`${origin}/api/users/refresh-token`, { headers: { origin } })
  const refreshedBody = await refreshed.json()
  assert(refreshed.ok() && !refreshedBody.token && !refreshedBody.refreshedToken, 'Refresh emitted a bearer token')
  stage = 'edit a draft in the dashboard'
  await editor.page.goto(`${origin}/admin/collections/events/${createdEvent}`)
  const title = editor.page.locator('#field-title')
  await title.fill('Edited from the Terrace dashboard')
  await editor.page.getByRole('button', { name: /^save draft$/i }).click()
  await editor.page.waitForFunction(async ({ origin, id }) => {
    const response = await fetch(`${origin}/api/events/${id}?draft=true`)
    return response.ok && (await response.json()).title === 'Edited from the Terrace dashboard'
  }, { origin, id: createdEvent }, { timeout: 20_000 })
  const saved = await editor.page.request.get(`${origin}/api/events/${createdEvent}?draft=true`)
  assert((await saved.json()).title === 'Edited from the Terrace dashboard', 'Draft UI changes did not persist')
  stage = 'non-editor and invalid state denial'
  for (const [username, password] of [['local-member', credentials.memberPassword], ['local-alumni', credentials.alumniPassword], ['local-unapproved', credentials.outsiderPassword]]) {
    const deniedLogin = await signIn(username, password)
    assert(!(await me(deniedLogin.page)).user, 'Non-editor entered CMS')
    assert(await deniedLogin.page.getByRole('alert').filter({ hasText: 'approved editorial account' }).isVisible(), 'Missing editorial denial message')
  }
  const invalid = await signIn('local-editorial-editor', credentials.editorialEditorPassword, true)
  assert(!(await me(invalid.page)).user, 'Invalid OIDC state accepted')
  stage = 'administrator permissions'
  assert((await adminPage.request.delete(`${origin}/api/events/${createdEvent}`, { headers: { origin } })).ok(), 'Administrator cannot delete content'); createdEvent = undefined
  await adminPage.screenshot({ path: '.state/editorial-admin.png', fullPage: true })
  stage = 'live Keycloak session revocation'
  const tokenResponse = await fetch(`${new URL(issuer).origin}/realms/master/protocol/openid-connect/token`, { method: 'POST', body: new URLSearchParams({ client_id: 'admin-cli', grant_type: 'password', username: 'terrace-local-admin', password: credentials.adminPassword }), signal: AbortSignal.timeout(5000) })
  if (!tokenResponse.ok) throw new Error('Fixture token failed')
  adminToken = (await tokenResponse.json()).access_token
  const users = await (await keycloak('users?username=local-editorial-editor&exact=true')).json()
  const editorId = users[0]?.id
  if (!editorId) throw new Error('Fixture user missing')
  await keycloak(`users/${editorId}/logout`, 'POST')
  assert(!(await me(editor.page)).user, 'Revoked session remained valid')
  await signOut(adminPage)
  console.log(`Editorial browser checks passed: ${count} assertions; editor/admin, membership denial, permissions, CSRF, state, revocation and logout.`)
} catch (error) {
  const safeMessage = error instanceof TestFailure ? error.message : 'Browser operation did not complete.'
  console.error(`Editorial browser checks failed at: ${stage}. Raw browser/auth errors suppressed.`)
  console.error(safeMessage)
  if (stage.startsWith('logout') && adminPage) await adminPage.screenshot({ path: '.state/editorial-failed.png', fullPage: true }).catch(() => undefined)
  process.exitCode = 1
} finally {
  if (createdEvent && adminPage) await adminPage.request.delete(`${origin}/api/events/${createdEvent}`, { headers: { origin } }).catch(() => undefined)
  for (const context of contexts) await context.close()
  await browser.close()
}
