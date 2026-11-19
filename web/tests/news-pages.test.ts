import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { parseHTML } from 'linkedom';

type Doc = Record<string, unknown>;
let outage = false;
const requests: string[] = [];
const hostile = '<p onclick="x()">Body <script>window.pwned=1</script><a href="javascript:alert(1)">bad</a> <a href="https://example.org/">ext</a> <a href="/old-post/">internal</a> <a href="/old-page/#frag">page</a></p><img src="https://www.princetonterraceclub.org/wp-content/uploads/a.jpg" alt="gone"><figure><img src="/wp-content/b.jpg" alt=""><figcaption>Caption stays</figcaption></figure><img src="/api/media/file/ok.png" alt="Fine">';
const posts: Doc[] = Array.from({ length: 13 }, (_, i) => ({
  _status: 'published', slug: `post-${i + 1}`, title: `Post ${i + 1}`, publishedAt: new Date(Date.UTC(2020, 0, 1 + i, 3)).toISOString(),
  excerpt: `Excerpt ${i + 1}`, bodyHtml: i === 12 ? hostile : `<p>Body ${i + 1}</p><h1>Inner</h1>`, authorName: 'A. Writer', seoTitle: i === 12 ? 'SEO <Title>' : undefined, seoDescription: i === 12 ? 'SEO description' : undefined
}));
// Three posts at one instant (ids 101-103) test the neighbour tie-break.
for (const id of [101, 102, 103]) posts.push({ id, _status: 'published', slug: `tie-${id}`, title: `Tie ${id}`, publishedAt: '2019-06-01T12:00:00.000Z', bodyHtml: `<p>tie ${id}</p>` });
posts.push({ _status: 'draft', slug: 'secret-draft', title: 'Secret draft', bodyHtml: '<p>secret</p>', publishedAt: '2021-01-01T00:00:00.000Z' });
const pages: Doc[] = [
  { _status: 'published', slug: 'history', title: 'History', bodyHtml: '<p>Long ago</p>', excerpt: 'About the history' },
  { _status: 'draft', slug: 'draft-page', title: 'Draft page', bodyHtml: '<p>nope</p>' }
];
const redirects: Doc[] = [
  { sourcePath: '/old-post', destinationUrl: '/news/post-13', statusCode: '301', active: true },
  { sourcePath: '/old-page', destinationUrl: '/pages/history', statusCode: '302', active: true },
  { sourcePath: '/inactive', destinationUrl: '/news/post-1', statusCode: '301', active: false },
  { sourcePath: '/external', destinationUrl: 'https://evil.example/', statusCode: '301', active: true },
  { sourcePath: '/loop-a', destinationUrl: '/loop-b', statusCode: '301', active: true },
  { sourcePath: '/loop-b', destinationUrl: '/loop-a', statusCode: '301', active: true },
  { sourcePath: '/api/anything', destinationUrl: '/news/post-1', statusCode: '301', active: true },
  { sourcePath: '/members/old', destinationUrl: '/news/post-1', statusCode: '301', active: true }
];

const cms = Bun.serve({
  hostname: '127.0.0.1', port: 0,
  fetch(request) {
    const url = new URL(request.url);
    requests.push(url.pathname + url.search);
    if (outage) return new Response('Private internal diagnostic', { status: 503 });
    const query = url.searchParams;
    const published = query.get('where[_status][equals]') === 'published';
    const reply = (docs: Doc[], extra: Doc = {}) => Response.json({ docs, hasNextPage: false, totalPages: 1, ...extra });
    if (url.pathname === '/api/redirects') {
      const source = query.get('where[sourcePath][equals]');
      return reply(redirects.filter(row => row.sourcePath === source && row.active === true));
    }
    const all = url.pathname === '/api/posts' ? posts : url.pathname === '/api/pages' ? pages : null;
    if (!all) return new Response('not found', { status: 404 });
    let docs = all.filter(doc => !published || doc._status === 'published');
    const slug = query.get('where[slug][equals]');
    if (slug) docs = docs.filter(doc => doc.slug === slug);
    const before = query.get('where[publishedAt][less_than]'), after = query.get('where[publishedAt][greater_than]');
    for (const [op, test] of [['less_than', (a: number, b: number) => a < b], ['greater_than', (a: number, b: number) => a > b]] as const) {
      const pub = query.get(`where[or][0][publishedAt][${op}]`), tieAt = query.get('where[or][1][and][0][publishedAt][equals]'), tieId = query.get(`where[or][1][and][1][id][${op}]`);
      if (pub) docs = docs.filter(doc => test(Date.parse(String(doc.publishedAt)), Date.parse(pub)) || (tieAt !== null && tieId !== null && doc.publishedAt === tieAt && test(Number(doc.id ?? 0), Number(tieId))));
    }
    if (before) docs = docs.filter(doc => String(doc.publishedAt) < before);
    if (after) docs = docs.filter(doc => String(doc.publishedAt) > after);
    const sort = query.get('sort');
    if (sort) {
      const [field, ...rest] = sort.split(',');
      const sign = field.startsWith('-') ? -1 : 1;
      const idSign = rest.length && rest[0].startsWith('-') ? -1 : 1;
      docs = [...docs].sort((a, b) => String(a.publishedAt).localeCompare(String(b.publishedAt)) * sign || (Number(a.id ?? 0) - Number(b.id ?? 0)) * idSign);
    }
    const limit = Number(query.get('limit') ?? 10), page = Number(query.get('page') ?? 1);
    const total = Math.max(1, Math.ceil(docs.length / limit));
    return reply(docs.slice((page - 1) * limit, page * limit), { totalPages: total, hasNextPage: page < total });
  }
});

let web: ReturnType<typeof Bun.spawn>;
let origin: string;
beforeAll(async () => {
  web = Bun.spawn([process.execPath, './node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '0'], {
    env: { ...process.env, CONTENT_SOURCE: 'cms', CMS_ORIGIN: `http://127.0.0.1:${cms.port}`, CMS_PUBLIC_ORIGIN: 'https://files.example.org', TERRACE_KIT_OUT_DIR: `.svelte-kit/test-news-${process.pid}`, NO_COLOR: '1' },
    stdout: 'pipe', stderr: 'ignore'
  });
  const reader = (web.stdout as ReadableStream<Uint8Array>).getReader();
  let log = '';
  const timer = setTimeout(() => web.kill(), 15000);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) throw new Error('news frontend test server failed to start');
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

const get = (path: string) => fetch(`${origin}${path}`, { redirect: 'manual' });
const dom = async (path: string) => { const response = await get(path); return { response, document: parseHTML(await response.text()).document }; };

describe('news list', () => {
  test('lists published posts newest first with dates in the club timezone, and paginates', async () => {
    const { response, document } = await dom('/news/');
    expect(response.status).toBe(200);
    expect(document.querySelectorAll('h1').length).toBe(1);
    const titles = [...document.querySelectorAll('.news-list h2 a')].map(a => a.textContent);
    expect(titles).toEqual(['Post 13', 'Post 12', 'Post 11', 'Post 10', 'Post 9', 'Post 8', 'Post 7', 'Post 6', 'Post 5', 'Post 4', 'Post 3', 'Post 2']);
    expect(document.querySelector('.news-list a')!.getAttribute('href')).toBe('/news/post-13/');
    expect(document.body.textContent).not.toContain('Secret draft');
    // 2020-01-13T03:00Z is still January 12 in Princeton.
    expect(document.querySelector('.news-list time')!.textContent).toBe('January 12, 2020');
    expect(document.querySelector('link[rel="canonical"]')!.getAttribute('href')).toBe(`${origin}/news/`);
    expect(response.headers.get('content-security-policy')).toContain("object-src 'none'");
    expect(document.querySelector('nav[aria-label="News pages"] a[rel="next"]')!.getAttribute('href')).toBe('/news/?page=2');
    const second = await dom('/news/?page=2');
    expect([...second.document.querySelectorAll('.news-list h2 a')].map(a => a.textContent)).toEqual(['Post 1', 'Tie 103', 'Tie 102', 'Tie 101']);
    expect(second.document.querySelector('nav[aria-label="News pages"] a[rel="prev"]')!.getAttribute('href')).toBe('/news/');
    expect((await get('/news/?page=9')).status).toBe(404);
    for (const hostilePage of ['-1', '0', '99999999999', 'abc', '1.5', '1e3', '%00', '']) {
      const fallback = await dom(`/news/?page=${hostilePage}`);
      expect(fallback.response.status).toBe(200);
      expect([...fallback.document.querySelectorAll('.news-list h2 a')][0].textContent).toBe('Post 13');
    }
    expect((await dom('/news/?page=abc')).document.querySelectorAll('.news-list li').length).toBe(12);
  });
});

describe('news and page details', () => {
  test('a post renders its title, date, byline, neighbours and metadata with one h1', async () => {
    const { response, document } = await dom('/news/post-5/');
    expect(response.status).toBe(200);
    expect(document.querySelectorAll('h1').length).toBe(1);
    expect(document.querySelector('h1')!.textContent).toBe('Post 5');
    expect(document.querySelector('time')!.getAttribute('datetime')).toBe('2020-01-05T03:00:00.000Z');
    expect(document.body.textContent).toContain('By A. Writer');
    expect(document.querySelector('.rendered h2')!.textContent).toBe('Inner'); // body h1 demoted
    expect(document.querySelector('a[rel="prev"]')!.getAttribute('href')).toBe('/news/post-4/');
    expect(document.querySelector('a[rel="next"]')!.getAttribute('href')).toBe('/news/post-6/');
    expect(document.querySelector('link[rel="canonical"]')!.getAttribute('href')).toBe(`${origin}/news/post-5/`);
    expect(document.querySelector('title')!.textContent).toBe('Post 5 · Terrace F. Club');
  });

  test('hostile stored HTML is neutralized, images follow policy, links are rewritten and the CSP backstop is sent', async () => {
    const { response, document } = await dom('/news/post-13/');
    const html = document.querySelector('.rendered')!.innerHTML;
    expect(html).not.toMatch(/<script|onclick|javascript:|window\.pwned/);
    expect(document.querySelector('title')!.textContent).toBe('SEO <Title> · Terrace F. Club');
    expect(document.querySelector('meta[name="description"][content="SEO description"]')).not.toBeNull();
    const images = [...document.querySelectorAll('.rendered img')];
    expect(images.map(image => image.getAttribute('src'))).toEqual(['https://files.example.org/api/media/file/ok.png']);
    expect(html).toContain('<p>Caption stays</p>');
    const links = [...document.querySelectorAll('.rendered a')];
    for (const link of links) expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(links.map(link => link.getAttribute('href'))).toEqual(['https://example.org/', '/news/post-13/', '/pages/history/#frag']);
    const csp = response.headers.get('content-security-policy')!;
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("img-src 'self' data: https://files.example.org");
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  test('a page renders at /pages/{slug}/ and the other routes keep their hand-built pages', async () => {
    const { response, document } = await dom('/pages/history/');
    expect(response.status).toBe(200);
    expect(document.querySelector('h1')!.textContent).toBe('History');
    expect(document.querySelector('meta[name="description"][content="About the history"]')).not.toBeNull();
    expect((await get('/about/')).status).toBe(200);
  });

  test('draft, missing and malformed slugs are indistinguishable 404s', async () => {
    const bodies: string[] = [];
    for (const path of ['/news/secret-draft/', '/news/does-not-exist/', '/news/Bad_Slug/', '/pages/draft-page/', '/pages/nope/', '/pages/Bad_Slug/']) {
      const response = await get(path);
      expect(response.status).toBe(404);
      bodies.push((await response.text()).replace(/\s+/g, ' ').replace(/<title>[^<]*<\/title>/, ''));
    }
    expect(new Set(bodies.slice(0, 3)).size).toBe(1);
    expect(new Set(bodies.slice(3)).size).toBe(1);
    expect(bodies[0]).not.toContain('secret');
  });
});

describe('neighbours', () => {
  test('posts sharing one publication instant are all reachable with older/newer links', async () => {
    const mid = await dom('/news/tie-102/');
    expect(mid.document.querySelector('a[rel="prev"]')!.getAttribute('href')).toBe('/news/tie-101/');
    expect(mid.document.querySelector('a[rel="next"]')!.getAttribute('href')).toBe('/news/tie-103/');
    expect((await dom('/news/tie-103/')).document.querySelector('a[rel="prev"]')!.getAttribute('href')).toBe('/news/tie-102/');
    expect((await dom('/news/tie-101/')).document.querySelector('a[rel="next"]')!.getAttribute('href')).toBe('/news/tie-102/');
  });
});

describe('redirect consumer in the running app', () => {
  test('an old URL with no route gets the stored redirect, without the query string', async () => {
    const response = await get('/old-post/?utm_source=x');
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('/news/post-13/');
    expect((await get('/old-post'))?.status).toBe(301);
    const stored302 = await get('/old-page/');
    expect(stored302.status).toBe(302);
    expect(stored302.headers.get('location')).toBe('/pages/history/');
    const head = await fetch(`${origin}/old-post/`, { method: 'HEAD', redirect: 'manual' });
    expect(head.status).toBe(301);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  test('inactive, external, looping, reserved and unknown paths stay normal 404s', async () => {
    for (const path of ['/inactive/', '/external/', '/loop-a/', '/loop-b/', '/api/anything', '/unknown-thing/', '/x.js']) {
      const response = await get(path);
      expect(response.status).toBe(404);
      expect(response.headers.get('location')).toBeNull();
      expect(await response.text()).toContain('We couldn’t find that page.');
    }
    const members = await get('/members/old/');
    expect(members.headers.get('location')).not.toContain('/news/'); // the member gate answers, not a stored redirect
    expect((await fetch(`${origin}/old-post/`, { method: 'POST', redirect: 'manual' })).status).not.toBe(301);
  });

  test('a CMS outage gives the normal 404 for old URLs (and a 503 for content routes), never a leak', async () => {
    outage = true;
    try {
      const old = await get('/old-page-other/');
      expect(old.status).toBe(404);
      expect(await old.text()).not.toContain('diagnostic');
      const post = await get('/news/post-1/');
      expect(post.status).toBe(503);
      expect(await post.text()).not.toContain('diagnostic');
    } finally { outage = false; }
  });
});
