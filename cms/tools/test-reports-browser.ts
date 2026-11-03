import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium, type BrowserContext } from 'playwright'

const cms = process.env.CMS_ORIGIN || ''
const web = process.env.MEMBER_AUTH_ORIGIN || ''
const state = process.env.TERRACE_TEST_IDENTITY_STATE
for (const value of [cms, web]) {
  const url = new URL(value)
  if (url.hostname !== '127.0.0.1' || url.protocol !== 'http:' || url.username || url.password || url.pathname !== '/') throw new Error('Reporting checks require plain loopback origins.')
}
if (process.env.CMS_LOCAL_BOOTSTRAP !== '1' || process.env.CMS_AUTH_ISSUER || !state) throw new Error('Use an owned synthetic CMS password trial and dedicated identity fixtures.')
const credentials = JSON.parse(readFileSync(resolve(state, 'credentials.json'), 'utf8'))
const browser = await chromium.launch({ headless: true })
const contexts: BrowserContext[] = []
let stage = 'start', count = 0
class CheckFailure extends Error {}
const assert = (condition: unknown, message: string) => { if (!condition) throw new CheckFailure(message); count++ }
async function member(username: string, password: string) {
  const context = await browser.newContext()
  contexts.push(context)
  const page = await context.newPage()
  await page.goto(`${web}/auth/login?returnTo=/members/stories/`)
  await page.locator('#username').fill(username)
  await page.locator('#password').fill(password)
  await page.locator('#kc-login').click()
  await page.waitForURL(`${web}/members/stories/`, { timeout: 60_000 })
  return page
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
  const share = author.locator('form[action="?/share"]')
  await share.locator('[name=title]').fill(title)
  await share.locator('[name=body]').fill('Original synthetic story <script>literal text</script>.')
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
  const login = await admin.request.post(`${cms}/api/users/login`, { data: { email: process.env.CMS_BOOTSTRAP_EMAIL, password: process.env.CMS_BOOTSTRAP_PASSWORD } })
  assert(login.ok(), 'Synthetic administrator login failed')
  assert((await login.json()).user?.role === 'admin', 'Synthetic account lacks administrator role')
  assert((await adminContext.cookies()).some((cookie) => cookie.name === 'payload-token'), 'Administrator session cookie missing')
  const query = `${cms}/api/story-reports?where[storyId][equals]=${storyId}`
  const queued = await admin.request.get(query, { headers: { origin: cms } })
  assert(queued.ok(), `Administrator queue access denied (HTTP ${queued.status()})`)
  const snapshot = (await queued.json()).docs[0]
  reportId = snapshot?.id
  assert(snapshot?.storyTitle === title && snapshot?.reason === 'privacy' && snapshot?.status === 'open', 'Wrong report snapshot')
  assert(!snapshot.reportKey, 'Reporter key exposed')

  stage = 'ordinary editor API denial'
  const email = `report-editor-${crypto.randomUUID()}@terrace.invalid`, password = crypto.randomUUID()
  const editor = await admin.request.post(`${cms}/api/users`, { headers: { origin: cms }, data: { email, password, displayName: 'Synthetic report editor', role: 'editor' } })
  assert(editor.ok(), 'Synthetic editor setup failed')
  editorId = (await editor.json()).doc.id
  const editorContext = await browser.newContext(); contexts.push(editorContext)
  assert((await editorContext.request.post(`${cms}/api/users/login`, { data: { email, password } })).ok(), 'Synthetic editor login failed')
  for (const method of ['get', 'patch', 'delete'] as const) {
    const response = await editorContext.request[method](`${cms}/api/story-reports/${reportId}`, { headers: { origin: cms }, ...(method === 'patch' ? { data: { status: 'reviewed' } } : {}) })
    assert(response.status() === 403, `Editor ${method} was not denied`)
  }

  stage = 'native reviewer interface'
  await admin.goto(`${cms}/admin/collections/story-reports/${reportId}`)
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

  stage = 'snapshot survives story removal'
  const removal = await author.request.post(`${web}/members/stories/?/remove`, { headers: { origin: web }, form: { id: storyId! } })
  assert(removal.ok(), 'Author could not remove synthetic story')
  storyId = undefined
  const retained = await admin.request.get(`${cms}/api/story-reports/${reportId}`, { headers: { origin: cms } })
  assert(retained.ok() && (await retained.json()).storyTitle === title, 'Deleted story lost its report context')
  console.log(`Reporting browser checks passed: ${count} assertions; real member Keycloak login, disclosure, submission, editor API denial, native reviewer UI and retained snapshot.`)
} catch (error) {
  console.error(`Reporting browser check failed at ${stage}. ${error instanceof CheckFailure ? error.message : 'Browser operation did not complete.'} Raw browser/auth errors suppressed.`)
  process.exitCode = 1
} finally {
  if (storyId && author) await author.request.post(`${web}/members/stories/?/remove`, { headers: { origin: web }, form: { id: storyId } }).catch(() => undefined)
  if (reportId) await admin.request.delete(`${cms}/api/story-reports/${reportId}`, { headers: { origin: cms } }).catch(() => undefined)
  if (editorId) await admin.request.delete(`${cms}/api/users/${editorId}`, { headers: { origin: cms } }).catch(() => undefined)
  for (const context of contexts) await context.close()
  await browser.close()
}
