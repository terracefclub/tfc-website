import { mkdirSync } from 'node:fs'
import { chromium, type APIResponse, type BrowserContext, type Page } from 'playwright'
import { localFixtureCredentials } from './local-fixtures'

const cms = process.env.CMS_ORIGIN || ''
const web = process.env.MEMBER_AUTH_ORIGIN || ''
const state = process.env.TERRACE_TEST_IDENTITY_STATE
const editorialSSO = Boolean(process.env.CMS_AUTH_ISSUER)
for (const value of [cms, web]) {
  const url = new URL(value)
  if (url.hostname !== '127.0.0.1' || url.protocol !== 'http:' || url.username || url.password || url.pathname !== '/') throw new Error('Reporting checks require plain loopback origins.')
}
if (process.env.CMS_LOCAL_BOOTSTRAP !== '1' || !state) throw new Error('Use an owned synthetic CMS and dedicated identity fixtures.')
if (editorialSSO) {
  const issuer = new URL(process.env.CMS_AUTH_ISSUER!)
  if (issuer.hostname !== '127.0.0.1' || issuer.protocol !== 'http:' || issuer.username || issuer.password) throw new Error('Editorial sign-in requires the dedicated loopback identity fixture.')
}
const credentials = localFixtureCredentials(state, ['memberPassword', 'alumniPassword', ...(editorialSSO ? ['editorialAdminPassword', 'editorialEditorPassword'] : [])])
mkdirSync('.state', { recursive: true, mode: 0o700 })
const browser = await chromium.launch({ headless: true, executablePath: process.env.TERRACE_TEST_BROWSER_BINARY || undefined })
const contexts: BrowserContext[] = []
let stage = 'start', count = 0
class CheckFailure extends Error {}
const assert = (condition: unknown, message: string) => { if (!condition) throw new CheckFailure(message); count++ }
async function cleanup(label: string, remove: () => Promise<APIResponse>) {
  try { if ((await remove()).ok()) return } catch { /* report only the safe fixture label */ }
  console.error(`Reporting browser cleanup failed: ${label}. Raw errors suppressed.`)
  process.exitCode = 1
}
async function member(username: string, password: string) {
  const previousStage = stage
  const context = await browser.newContext()
  contexts.push(context)
  const page = await context.newPage()
  page.on('pageerror', error => console.error(`Reporting client exception: ${['TypeError', 'ReferenceError', 'SyntaxError', 'Error'].includes(error.name) ? error.name : 'unclassified'}.`))
  stage = `${username}: open website sign-in`
  const response = await page.goto(`${web}/auth/login?returnTo=/members/stories/`)
  assert(response?.ok(), `Member sign-in entrypoint failed (HTTP ${response?.status() || 0})`)
  stage = `${username}: enter fixture credentials`
  await page.locator('#username').fill(username)
  await page.locator('#password').fill(password)
  await page.locator('#kc-login').click()
  stage = `${username}: member callback`
  await page.waitForURL(`${web}/members/stories/`, { timeout: 60_000 })
  stage = previousStage
  return page
}
async function editorial(page: Page, username: string, password: string, role: 'admin' | 'editor') {
  await page.goto(`${cms}/admin/login`)
  await page.getByRole('button', { name: 'Sign in with Terrace', exact: true }).click()
  await page.locator('#username').fill(username)
  await page.locator('#password').fill(password)
  await page.locator('#kc-login').click()
  await page.waitForURL((url) => url.origin === cms && url.pathname.startsWith('/admin'), { timeout: 60_000 })
  const response = await page.request.get(`${cms}/api/users/me`, { headers: { origin: cms } })
  const body = await response.json()
  assert(response.ok() && body.user?.collection === 'users' && body.user?.role === role, `Keycloak ${role} mapping failed`)
  assert(!body.token && !body.user.identityKey, 'Editorial sign-in exposed private identity data')
}
const title = `Synthetic report ${crypto.randomUUID().slice(0, 8)}`
let author: Awaited<ReturnType<typeof member>> | undefined
let storyId: string | undefined, reportId: number | undefined, editorId: number | undefined
const adminContext = await browser.newContext()
contexts.push(adminContext)
const admin = await adminContext.newPage()
try {
  stage = 'member story creation'
  author = await member('local-member', credentials.memberPassword)
  stage = 'member story form'
  const share = author.locator('form[action="?/share"]')
  await share.locator('[name=title]').fill(title)
  await share.locator('[name=body]').fill('Original synthetic story <script>literal text</script>.')
  stage = 'member story submission'
  await share.getByRole('button', { name: 'Share the story', exact: true }).click()
  await author.getByRole('status').filter({ hasText: 'Your story is shared.' }).waitFor()
  storyId = await author.locator('article').filter({ has: author.getByRole('heading', { name: title, exact: true }) }).locator('form[action="?/edit"] input[name=id]').getAttribute('value') || undefined
  assert(storyId, 'New story ID missing')

  stage = 'member disclosure and submission'
  const reader = await member('local-alumni', credentials.alumniPassword)
  const card = reader.locator('article').filter({ has: reader.getByRole('heading', { name: title, exact: true }) })
  await card.getByText('Report this story', { exact: true }).click()
  const report = card.locator('form[action="?/report"]')
  assert((await report.textContent())?.includes('Terrace administrators will receive a copy of this story'), 'Missing administrator disclosure')
  await report.locator('[name=reason]').selectOption('privacy')
  await reader.setViewportSize({ width: 390, height: 844 })
  await reader.screenshot({ path: '.state/report-member.png', fullPage: true })
  assert(await reader.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile report form overflows')
  await report.getByRole('button', { name: 'Send report', exact: true }).click()
  await reader.getByRole('status').filter({ hasText: 'Your report was sent to the Terrace administrators.' }).waitFor()
  count++

  stage = 'administrator queue API'
  if (editorialSSO) {
    await editorial(admin, 'local-editorial-admin', credentials.editorialAdminPassword, 'admin')
    assert((await adminContext.cookies()).some((cookie) => cookie.name.startsWith('terrace_cms_') && !cookie.name.endsWith('_login') && cookie.httpOnly), 'Opaque administrator session cookie missing')
  } else {
    const login = await admin.request.post(`${cms}/api/users/login`, { data: { email: process.env.CMS_BOOTSTRAP_EMAIL, password: process.env.CMS_BOOTSTRAP_PASSWORD } })
    assert(login.ok(), 'Synthetic administrator login failed')
    assert((await login.json()).user?.role === 'admin', 'Synthetic account lacks administrator role')
    assert((await adminContext.cookies()).some((cookie) => cookie.name === 'payload-token'), 'Administrator session cookie missing')
  }
  const query = `${cms}/api/story-reports?where[storyId][equals]=${storyId}`
  const queued = await admin.request.get(query, { headers: { origin: cms } })
  assert(queued.ok(), `Administrator queue access denied (HTTP ${queued.status()})`)
  const snapshot = (await queued.json()).docs[0]
  reportId = snapshot?.id
  assert(snapshot?.storyTitle === title && snapshot?.reason === 'privacy' && snapshot?.status === 'open', 'Wrong report snapshot')
  assert(!snapshot.reportKey, 'Reporter key exposed')

  stage = 'ordinary editor API denial'
  const editorContext = await browser.newContext(); contexts.push(editorContext)
  const editorPage = await editorContext.newPage()
  if (editorialSSO) await editorial(editorPage, 'local-editorial-editor', credentials.editorialEditorPassword, 'editor')
  else {
    const email = `report-editor-${crypto.randomUUID()}@terrace.invalid`, password = crypto.randomUUID()
    const editor = await admin.request.post(`${cms}/api/users`, { headers: { origin: cms }, data: { email, password, displayName: 'Synthetic report editor', role: 'editor' } })
    assert(editor.ok(), 'Synthetic editor setup failed')
    editorId = (await editor.json()).doc.id
    assert((await editorContext.request.post(`${cms}/api/users/login`, { data: { email, password } })).ok(), 'Synthetic editor login failed')
    await editorPage.goto(`${cms}/admin`)
  }
  assert(await editorPage.locator('a[href="/admin/collections/story-reports"]').count() === 0, 'Editor dashboard exposes the report queue')
  assert((await editorContext.request.get(`${cms}/api/story-reports`, { headers: { origin: cms } })).status() === 403, 'Editor listed the report queue')
  for (const method of ['get', 'patch', 'delete'] as const) {
    const response = await editorContext.request[method](`${cms}/api/story-reports/${reportId}`, { headers: { origin: cms }, ...(method === 'patch' ? { data: { status: 'reviewed' } } : {}) })
    assert(response.status() === 403, `Editor ${method} was not denied`)
  }

  stage = 'native reviewer interface'
  await admin.goto(`${cms}/admin/collections/story-reports`)
  await admin.getByRole('link', { name: title, exact: true }).click()
  await admin.locator('#field-status').click()
  await admin.getByRole('option', { name: 'reviewed', exact: true }).click()
  await admin.getByRole('button', { name: /^save$/i }).click()
  await admin.waitForFunction(async ({ cms, id }) => {
    const response = await fetch(`${cms}/api/story-reports/${id}`)
    return response.ok && (await response.json()).status === 'reviewed'
  }, { cms, id: reportId }, { timeout: 20_000 })
  count++
  await admin.reload({ waitUntil: 'networkidle' })
  await admin.screenshot({ path: '.state/report-reviewer.png', fullPage: true })
  assert(await admin.locator('#field-storyBody').inputValue() === 'Original synthetic story <script>literal text</script>.', 'Reviewer snapshot changed')

  stage = 'snapshot survives story edits'
  const edit = author.locator('article').filter({ has: author.getByRole('heading', { name: title, exact: true }) }).locator('form[action="?/edit"]')
  await edit.locator('..').getByText('Edit your story', { exact: true }).click()
  await edit.locator('[name=body]').fill('Changed synthetic story.')
  await edit.getByRole('button', { name: 'Save changes', exact: true }).click()
  await author.getByRole('status').filter({ hasText: 'Your story is updated.' }).waitFor()
  const unchanged = await admin.request.get(`${cms}/api/story-reports/${reportId}`, { headers: { origin: cms } })
  assert(unchanged.ok() && (await unchanged.json()).storyBody === snapshot.storyBody, 'Editing the story changed its report snapshot')

  stage = 'snapshot survives story removal'
  const removal = await author.request.post(`${web}/members/stories/?/remove`, { headers: { origin: web }, form: { id: storyId! } })
  assert(removal.ok(), 'Author could not remove synthetic story')
  storyId = undefined
  const retained = await admin.request.get(`${cms}/api/story-reports/${reportId}`, { headers: { origin: cms } })
  assert(retained.ok() && (await retained.json()).storyTitle === title, 'Deleted story lost its report context')
  console.log(`Reporting browser checks passed: ${count} assertions; member Keycloak login, ${editorialSSO ? 'editorial Keycloak SSO' : 'local password trial'}, disclosure, submission, editor API denial, native reviewer UI and retained snapshot.`)
} catch (error) {
  console.error(`Reporting browser check failed at ${stage}. ${error instanceof CheckFailure ? error.message : 'Browser operation did not complete.'} Raw browser/auth errors suppressed.`)
  process.exitCode = 1
} finally {
  if (storyId && author) await cleanup('story', () => author!.request.post(`${web}/members/stories/?/remove`, { headers: { origin: web }, form: { id: storyId! } }))
  if (reportId) await cleanup('report', () => admin.request.delete(`${cms}/api/story-reports/${reportId}`, { headers: { origin: cms } }))
  if (editorId) await cleanup('trial editor', () => admin.request.delete(`${cms}/api/users/${editorId}`, { headers: { origin: cms } }))
  for (const context of contexts) await context.close()
  await browser.close()
}
