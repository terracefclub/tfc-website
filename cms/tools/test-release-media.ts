import { chromium } from 'playwright'
import { localFixtureCredentials } from './local-fixtures'

const origin = process.env.CMS_ORIGIN || ''
const state = process.env.TERRACE_TEST_IDENTITY_STATE
const parsed = new URL(origin)
if (parsed.origin !== origin || parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1' || !state) throw new Error('Use a dedicated loopback release fixture.')
const credentials = localFixtureCredentials(state, ['editorialAdminPassword'])
const browser = await chromium.launch({ headless: true, executablePath: process.env.TERRACE_TEST_BROWSER_BINARY || undefined })
const admin = await browser.newContext(), anonymous = await browser.newContext()
const created: number[] = []
let stage = 'SSO', assertions = 0
const check = (value: unknown) => { if (!value) throw new Error(); assertions++ }
try {
  const page = await admin.newPage()
  await page.goto(`${origin}/admin/login`)
  await page.getByRole('button', { name: 'Sign in with Terrace', exact: true }).click()
  await page.locator('#username').fill('local-editorial-admin')
  await page.locator('#password').fill(credentials.editorialAdminPassword)
  await page.locator('#kc-login').click()
  await page.waitForURL(url => url.origin === origin && url.pathname.startsWith('/admin'), { timeout: 60_000 })
  check((await (await page.request.get(`${origin}/api/users/me`)).json()).user?.role === 'admin')
  // Public 1x1 synthetic PNG, never source or user media.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGPgUbL4DwACCgFmeGgpMwAAAABJRU5ErkJggg==', 'base64')
  for (const publicFile of [true, false]) {
    stage = publicFile ? 'public image and native optimization' : 'private image and cache isolation'
    const response = await page.request.post(`${origin}/api/media`, { headers: { origin }, multipart: {
      _payload: JSON.stringify({ alt: 'Synthetic release image', public: publicFile }),
      file: { name: `release-${crypto.randomUUID()}.png`, mimeType: 'image/png', buffer: png },
    } })
    check(response.ok())
    const doc = (await response.json()).doc
    created.push(doc.id)
    const path = new URL(doc.url, origin).pathname
    const direct = await page.request.get(`${origin}${path}`)
    check(direct.ok() && (await direct.body()).equals(png))
    const visitor = await anonymous.request.get(`${origin}${path}`)
    check(publicFile ? visitor.ok() : visitor.status() === 403)
    const optimized = `${origin}/_next/image?url=${encodeURIComponent(path)}&w=64&q=75`
    // Authenticated first, then the exact same cache key anonymously.
    const first = await page.request.get(optimized)
    const next = await anonymous.request.get(optimized)
    if (publicFile) {
      check(first.ok() && first.headers()['content-type']?.startsWith('image/'))
      check(next.ok() && (await first.body()).equals(await next.body()))
    } else {
      check(!first.ok() && !first.headers()['content-type']?.startsWith('image/'))
      check(!next.ok() && !next.headers()['content-type']?.startsWith('image/'))
      check(!(await next.body()).equals(png))
    }
  }
  console.log(`Release media checks passed: ${assertions} assertions; public optimization and authenticated-then-anonymous private-image denial.`)
} catch {
  console.error(`Release media check failed during ${stage}; raw authentication/media errors suppressed.`)
  process.exitCode = 1
} finally {
  for (const id of created) {
    try { if (!(await admin.request.delete(`${origin}/api/media/${id}`, { headers: { origin } })).ok()) throw new Error() }
    catch { console.error('Synthetic release media cleanup failed.'); process.exitCode = 1 }
  }
  await admin.close(); await anonymous.close(); await browser.close()
}
