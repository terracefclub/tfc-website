import { describe, expect, test } from 'bun:test';
import { mediaOriginOf, renderBody } from '../src/lib/render-body';
import { createRedirectResolver } from '../src/lib/server/redirects';
import { isSafeHtml } from '../src/lib/html-sanitize';

const media = 'https://files.example.org';
const hostile = [
  '<p onclick="steal()">Hello <script>alert(1)</script><b onmouseover=x>bold</b></p>',
  '<a href="javascript:alert(1)">js</a> <a href="  JaVa\tScRiPt:alert(1)">js2</a> <a href="data:text/html,<script>1</script>">d</a>',
  '<img src=x onerror="alert(1)"><iframe src="https://evil.example/"></iframe><svg onload=alert(1)><circle/></svg>',
  '<style>body{display:none}</style><form action="https://evil.example"><input name=x></form><object data=x></object>',
  '<a href="//evil.example/x">proto-relative</a><a href="/\\evil.example">backslash</a>',
  '<p style="position:fixed" class="x" id="y">styled</p>'
].join('\n');

describe('render-time sanitization', () => {
  test('hostile stored HTML is neutralized even though the database should never hold it', async () => {
    const html = await renderBody(hostile, { mediaOrigin: media });
    expect(html).not.toMatch(/<script|<iframe|<style|<form|<input|<object|<svg|onclick|onerror|onmouseover|onload|javascript:|data:text|style=|class=|id=|evil\.example/i);
    expect(html).toContain('Hello');
    expect(html).toContain('bold');
    expect(isSafeHtml(html)).toBe(true);
  });

  test('output is a fixed point and h1 never appears in a body', async () => {
    const html = await renderBody('<h1>Big</h1><p>x</p>');
    expect(html).not.toContain('<h1');
    expect(html).toContain('<h2>Big</h2>');
    expect(await renderBody(html)).toBe(html);
  });

  test('every link is noopener noreferrer, including ones the database marked otherwise', async () => {
    const html = await renderBody('<a href="https://example.org/" rel="opener" target="_blank">out</a><a href="/about/">in</a><a href="mailto:a@example.org">mail</a>');
    const tags = html.match(/<a\b[^>]*>/g)!;
    expect(tags).toHaveLength(3);
    for (const tag of tags) expect(tag).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain('target=');
    expect(html).not.toContain('opener"');
  });
});

describe('image policy', () => {
  test('images not served from the CMS public media path are dropped without a placeholder', async () => {
    const html = await renderBody([
      '<p>a<img src="https://www.princetonterraceclub.org/wp-content/uploads/2019/x.jpg" alt="old"></p>',
      '<p>b<img src="/wp-content/uploads/x.jpg" alt="rel"></p>',
      '<p>c<img src="https://other.example/api/media/file/x.png" alt="other host"></p>',
      '<p>d<img src="https://files.example.org/api/media/file/x.png?x=1" alt="query"></p>',
      '<p>e<img src="https://files.example.org/api/media/file/../../etc.png" alt="dots"></p>'
    ].join(''), { mediaOrigin: media });
    expect(html).not.toContain('<img');
    expect(html).toBe('<p>a</p><p>b</p><p>c</p><p>d</p><p>e</p>');
  });

  test('local media is kept and relative media paths are anchored to the media origin', async () => {
    const html = await renderBody('<p><img src="https://files.example.org/api/media/file/a-b_c.png" alt="A"><img src="/api/media/file/d.jpg" alt="D" width="10" height="20"></p>', { mediaOrigin: media });
    expect(html).toContain('<img src="https://files.example.org/api/media/file/a-b_c.png" alt="A">');
    expect(html).toContain('<img src="https://files.example.org/api/media/file/d.jpg" alt="D" width="10" height="20">');
  });

  test('without a media origin every image is dropped', async () => {
    expect(await renderBody('<p>t<img src="/api/media/file/x.png" alt=""></p>')).toBe('<p>t</p>');
  });

  test('a figure that loses its image keeps only its caption, and an emptied link disappears', async () => {
    const html = await renderBody('<figure><img src="/wp-content/x.jpg" alt=""><figcaption>Dinner, 1999</figcaption></figure><figure><img src="/wp-content/y.jpg" alt=""></figure><p>x <a href="https://example.org/"><img src="/wp-content/z.jpg" alt=""></a>y</p>');
    expect(html).toBe('<p>Dinner, 1999</p><p>x y</p>');
  });
});

describe('internal links', () => {
  const map: Record<string, string> = { '/old-post': '/news/old-post/', '/old-page': '/pages/old-page/' };
  const resolveOldPath = async (path: string) => map[path.replace(/\/$/, '')] ?? null;

  test('old-site links are rewritten through the redirect map and unmapped ones are untouched', async () => {
    const html = await renderBody([
      '<a href="/old-post/">one</a>',
      '<a href="https://www.princetonterraceclub.org/old-page/#part">two</a>',
      '<a href="https://princetonterraceclub.org/unmapped/">three</a>',
      '<a href="/old-post/?x=1">query</a>',
      '<a href="https://other.example/old-post/">foreign</a>'
    ].join(''), { resolveOldPath });
    expect(html).toContain('href="/news/old-post/"');
    expect(html).toContain('href="/pages/old-page/#part"');
    expect(html).toContain('href="https://princetonterraceclub.org/unmapped/"');
    expect(html).toContain('href="/old-post/?x=1"');
    expect(html).toContain('href="https://other.example/old-post/"');
  });

  test('a failing lookup leaves the link as written', async () => {
    const html = await renderBody('<a href="/old-post/">x</a>', { resolveOldPath: async () => { throw new Error('down'); } });
    expect(html).toContain('href="/old-post/"');
  });
});

describe('image path strictness', () => {
  test('dot, percent and non-alphanumeric-leading file names are dropped', async () => {
    const names = ['..', '.hidden.png', '-x.png', 'a..b.png', '..%2F..%2Fx', 'a%2Fb.png', '%2e%2e', 'a%20b.png'];
    const html = await renderBody(names.map(name => `<img src="/api/media/file/${name}" alt="">`).join(''), { mediaOrigin: media });
    expect(html).not.toContain('<img');
    expect(await renderBody('<img src="/api/media/file/a.b-c_1.png" alt="">', { mediaOrigin: media })).toContain('<img');
  });

  test('only the explicit public origin is a media origin', () => {
    expect(mediaOriginOf(undefined)).toBeUndefined();
    expect(mediaOriginOf('not a url')).toBeUndefined();
    expect(mediaOriginOf('https://files.example.org/x')).toBe('https://files.example.org');
  });
});

describe('figures', () => {
  test('nested figures and a table inside a caption stay safe and fixed-point', async () => {
    const html = await renderBody('<figure><img src="/x.jpg" alt=""><figure><figcaption>inner <b>cap</b></figcaption></figure><figcaption><table><tr><td onclick="x()">cell<script>1</script></td></tr></table></figcaption></figure><figure><figcaption><a href="javascript:1">j</a>plain</figcaption></figure>', { mediaOrigin: media });
    expect(html).not.toMatch(/<img|<script|onclick|javascript:/);
    expect(isSafeHtml(html)).toBe(true);
    expect(await renderBody(html, { mediaOrigin: media })).toBe(html);
    expect(html).toContain('plain');
  });
});

describe('many old-site links', () => {
  test('25 distinct mapped links all rewrite on the first render through the real resolver and a slow CMS', async () => {
    const fetch = async (input: string | URL) => {
      const source = new URL(String(input)).searchParams.get('where[sourcePath][equals]')!;
      await Bun.sleep(15);
      return Response.json({ docs: [{ sourcePath: source, destinationUrl: `/news${source}`, statusCode: '301', active: true }] });
    };
    const resolver = createRedirectResolver({ origin: 'http://cms.test', fetch });
    const body = Array.from({ length: 25 }, (_, i) => `<a href="/old-${i}/">l${i}</a>`).join(' ');
    const html = await renderBody(body, { resolveOldPath: resolver.destination });
    for (let i = 0; i < 25; i++) expect(html).toContain(`href="/news/old-${i}/"`);
    expect(html).not.toContain('href="/old-');
  });
});

describe('link lookup deadline', () => {
  test('a stalled CMS cannot hold a first render beyond the overall deadline; unresolved links stay as written and are not cached', async () => {
    const asked: string[] = [];
    // Answers the first four lookups at once, then stalls every request until its own abort.
    const fetch = (input: string | URL, init?: RequestInit) => {
      const source = new URL(String(input)).searchParams.get('where[sourcePath][equals]')!;
      asked.push(source);
      if (asked.length <= 4) return Promise.resolve(Response.json({ docs: [{ sourcePath: source, destinationUrl: `/news${source}`, statusCode: '301', active: true }] }));
      return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
    };
    const resolver = createRedirectResolver({ origin: 'http://cms.test', fetch: fetch as never, timeoutMs: 1500 });
    const body = Array.from({ length: 25 }, (_, i) => `<a href="/old-${i}/">l${i}</a>`).join(' ');
    const started = performance.now();
    const html = await renderBody(body, { resolveOldPath: resolver.destination, lookupDeadlineMs: 250 });
    const elapsed = performance.now() - started;
    expect(elapsed).toBeLessThan(900); // far below the 1500 ms request timeout times the 6 batches
    for (let i = 0; i < 4; i++) expect(html).toContain(`href="/news/old-${i}/"`);
    for (let i = 4; i < 25; i++) expect(html).toContain(`href="/old-${i}/"`);
    expect(isSafeHtml(html)).toBe(true);
    // Only the batch that was in flight was ever asked; the rest were never sent, so they are not negatively cached.
    expect(asked.length).toBe(8);
    expect(resolver.size).toBe(4);
  });

  test('the default deadline is about three seconds', async () => {
    const started = performance.now();
    const html = await renderBody('<a href="/slow/">x</a>', { resolveOldPath: () => new Promise<string | null>(resolve => setTimeout(() => resolve('/news/slow/'), 3600)) });
    expect(performance.now() - started).toBeLessThan(3400);
    expect(html).toContain('href="/slow/"');
  }, 6000);

  test('an absurd or invalid deadline is clamped to a sane range', async () => {
    const never = () => new Promise<string | null>(() => {});
    for (const lookupDeadlineMs of [-5, 0]) {
      const started = performance.now();
      expect(await renderBody('<a href="/x/">x</a>', { resolveOldPath: never, lookupDeadlineMs })).toContain('href="/x/"');
      expect(performance.now() - started).toBeLessThan(500);
    }
    // NaN and Infinity fall back to the 3 s default instead of waiting forever (checked with a fast resolver).
    for (const lookupDeadlineMs of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const html = await renderBody('<a href="/x/">x</a>', { resolveOldPath: async () => '/news/x/', lookupDeadlineMs });
      expect(html).toContain('href="/news/x/"');
    }
  });
});
