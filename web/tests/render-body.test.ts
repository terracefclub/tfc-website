import { describe, expect, test } from 'bun:test';
import { renderBody } from '../src/lib/render-body';
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
