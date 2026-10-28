import { afterAll, beforeAll, expect, test } from 'bun:test';
import { parseHTML } from 'linkedom';

let mode: 'published' | 'empty' | 'draft' | 'outage' = 'published';
let eventStartsAt: string;
const cms = Bun.serve({
  hostname: '127.0.0.1', port: 0,
  fetch(request) {
    if (mode === 'outage') return new Response('Private internal diagnostic', { status: 503 });
    const path = new URL(request.url).pathname;
    let docs: unknown[] = [];
    if (mode !== 'empty') {
      if (path === '/api/events') docs = [{ _status: mode === 'draft' ? 'draft' : 'published', slug: 'club-dinner', title: 'Published dinner', summary: 'A gathering at Terrace.', startsAt: eventStartsAt, category: 'food', locationName: 'Clubhouse', body: '<script>window.unsafeContent=true</script>' }];
      if (path === '/api/newsletters') docs = [{ _status: 'published', title: 'Winter 2027 News', issueDate: '2027-01-01T00:00:00.000Z', issuePdf: { public: true, mimeType: 'application/pdf', url: '/api/media/file/winter.pdf' } }];
      if (path === '/api/initiatives') docs = [{ _status: 'published', slug: 'care', title: 'Clubhouse care', summary: 'Keep the house welcoming.', body: 'A little care goes a long way.' }];
    }
    return Response.json({ docs, hasNextPage: false });
  }
});

let web: ReturnType<typeof Bun.spawn>;
let origin: string;
beforeAll(async () => {
  eventStartsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  web = Bun.spawn([process.execPath, './node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '0'], {
    env: { ...process.env, CONTENT_SOURCE: 'cms', CMS_ORIGIN: `http://127.0.0.1:${cms.port}`, CMS_PUBLIC_ORIGIN: 'https://files.example.org', NO_COLOR: '1' },
    stdout: 'pipe', stderr: 'ignore'
  });
  const reader = (web.stdout as ReadableStream<Uint8Array>).getReader();
  let log = '';
  const timer = setTimeout(() => web.kill(), 15000);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) throw new Error('CMS frontend test server failed to start');
      log += new TextDecoder().decode(value);
      const match = log.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { origin = match[0]; break; }
    }
  } finally { clearTimeout(timer); reader.releaseLock(); }
}, 20000);

afterAll(async () => {
  web?.kill();
  if (web) await web.exited;
  await cms.stop(true);
});

test('CMS data renders through the HTTP boundary without fixture labels or executable markup', async () => {
  mode = 'published';
  const home = await (await fetch(origin)).text();
  expect(home).toContain('Published dinner');
  expect(home).toContain('Clubhouse care');
  expect(home).toContain('Winter 2027 News');
  expect(home).not.toContain('sample listings');
  const detail = await fetch(`${origin}/events/club-dinner/`);
  expect(detail.status).toBe(200);
  const { document } = parseHTML(await detail.text());
  expect(document.querySelector('.prose')?.textContent).toContain('<script>window.unsafeContent=true</script>');
  expect(document.querySelector('.prose script')).toBeNull();
  const news = await (await fetch(`${origin}/newsletter/`)).text();
  expect(news).toContain('https://files.example.org/api/media/file/winter.pdf');
});

test('empty published collections render empty states and missing details return404', async () => {
  mode = 'empty';
  const home = await fetch(origin);
  expect(home.status).toBe(200);
  expect(await home.text()).toContain('New gatherings will appear');
  expect(await (await fetch(`${origin}/newsletter/`)).text()).toContain('New issues will appear');
  expect(await (await fetch(`${origin}/initiatives/`)).text()).toContain('More to share soon');
  expect((await fetch(`${origin}/events/club-dinner/`)).status).toBe(404);
});

test('draft responses and CMS outages fail closed with503 and no diagnostic disclosure', async () => {
  for (const state of ['draft', 'outage'] as const) {
    mode = state;
    const response = await fetch(`${origin}/events/`);
    expect(response.status).toBe(503);
    const html = await response.text();
    expect(html).not.toContain('Published dinner');
    expect(html).not.toContain('Supper at the table');
    expect(html).not.toContain('Private internal diagnostic');
    expect(html).not.toContain(`127.0.0.1:${cms.port}`);
  }
});
