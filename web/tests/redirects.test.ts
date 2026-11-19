import { describe, expect, test } from 'bun:test';
import { createRedirectResolver, normalizeSource, safeDestination } from '../src/lib/server/redirects';

type Row = { sourcePath: string; destinationUrl: string; statusCode?: string; active?: boolean };
function cms(rows: Row[], behavior: { fail?: boolean } = {}) {
  const calls: string[] = [];
  const fetch = async (input: string | URL) => {
    const url = new URL(String(input));
    calls.push(url.searchParams.get('where[sourcePath][equals]')!);
    if (behavior.fail) throw new Error('unreachable');
    const source = url.searchParams.get('where[sourcePath][equals]');
    // Mimic the CMS: only active rows are readable and the where clause filters on the exact stored path.
    const docs = rows.filter(row => row.sourcePath === source && row.active !== false).map(row => ({ statusCode: '301', active: true, ...row }));
    return Response.json({ docs }, { headers: { 'content-type': 'application/json' } });
  };
  return { fetch, calls };
}
const resolver = (rows: Row[], extra: Partial<Parameters<typeof createRedirectResolver>[0]> = {}, behavior = {}) => {
  const server = cms(rows, behavior);
  return { ...server, resolver: createRedirectResolver({ origin: 'http://cms.test', fetch: server.fetch, ...extra }) };
};

describe('redirect consumer', () => {
  test('trims one trailing slash and answers with the stored status and a same-site destination', async () => {
    const { resolver: r, calls } = resolver([{ sourcePath: '/old-post', destinationUrl: '/news/old-post' }, { sourcePath: '/temp', destinationUrl: '/pages/temp', statusCode: '302' }]);
    expect(await r.resolve('/old-post/')).toEqual({ location: '/news/old-post/', status: 301 });
    expect(await r.resolve('/old-post')).toEqual({ location: '/news/old-post/', status: 301 });
    expect(await r.resolve('/temp/')).toEqual({ location: '/pages/temp/', status: 302 });
    expect(calls.filter(call => call === '/old-post')).toHaveLength(1); // second request came from the cache
  });

  test('case is matched as stored', async () => {
    const { resolver: r } = resolver([{ sourcePath: '/Old-Post', destinationUrl: '/news/old-post/' }]);
    expect(await r.resolve('/old-post/')).toBeNull();
    expect((await r.resolve('/Old-Post/'))?.location).toBe('/news/old-post/');
  });

  test('inactive redirects are ignored even if the CMS were to return them', async () => {
    const { resolver: r } = resolver([{ sourcePath: '/off', destinationUrl: '/news/off/', active: false }]);
    expect(await r.resolve('/off/')).toBeNull();
    const stale = createRedirectResolver({ origin: 'http://cms.test', fetch: async () => Response.json({ docs: [{ sourcePath: '/off', destinationUrl: '/news/off/', statusCode: '301', active: false }] }) });
    expect(await stale.resolve('/off/')).toBeNull();
  });

  test.each([
    'https://evil.example/', 'http://evil.example/x', '//evil.example/x', '/\\evil.example', '\\\\evil.example', 'javascript:alert(1)', '/news/../admin/', '/news//x', '/a?b=1', '/a#b', 'news/x', '/', ''
  ])('destination %j is refused', async destination => {
    const { resolver: r } = resolver([{ sourcePath: '/old', destinationUrl: destination }]);
    expect(await r.resolve('/old/')).toBeNull();
  });

  test('a destination equal to the source is refused', async () => {
    const { resolver: r } = resolver([{ sourcePath: '/same', destinationUrl: '/same/' }]);
    expect(await r.resolve('/same')).toBeNull();
    expect(safeDestination('/Same', '/same')).toBeNull();
  });

  test('a two-step loop is refused and only one hop is ever emitted', async () => {
    const { resolver: r } = resolver([{ sourcePath: '/a', destinationUrl: '/b' }, { sourcePath: '/b', destinationUrl: '/a' }, { sourcePath: '/c', destinationUrl: '/d' }, { sourcePath: '/d', destinationUrl: '/e' }]);
    expect(await r.resolve('/a/')).toBeNull();
    expect(await r.resolve('/b/')).toBeNull();
    expect(await r.resolve('/c/')).toEqual({ location: '/d/', status: 301 }); // not followed on to /e
  });

  test('reserved and app prefixes are never redirected and never reach the CMS', async () => {
    const paths = ['/members', '/members/x', '/Members/x', '/auth/login', '/preview/source/published', '/api/x', '/API', '/admin', '/admin/collections/posts', '/_app/x', '/news/x', '/pages/x', '/events/x', '/newsletter', '/donate/x', '/about', '/contact', '/join', '/apply', '/merchandise', '/shows-archive', '/initiatives'];
    const rows = paths.map(path => ({ sourcePath: path, destinationUrl: '/news/hijack/' }));
    const { resolver: r, calls } = resolver(rows);
    for (const path of paths) expect(await r.resolve(`${path}/`)).toBeNull();
    expect(calls).toEqual([]);
  });

  test('the top-level pages are protected exactly, not their old sub-paths', async () => {
    const { resolver: r } = resolver([{ sourcePath: '/about/history', destinationUrl: '/pages/history/' }]);
    expect((await r.resolve('/about/history/'))?.location).toBe('/pages/history/');
  });

  test('paths that cannot be stored sources never reach the CMS', async () => {
    const { resolver: r, calls } = resolver([]);
    for (const path of ['/', '//evil.example', '/a//b', '/a.js', '/a%2Fb', '/a b', '/x/__data.json', '/' + 'a'.repeat(600)]) expect(await r.resolve(path)).toBeNull();
    expect(normalizeSource('/a/')).toBe('/a');
    expect(calls).toEqual([]);
  });

  test('an unreachable or erroring CMS fails open and does not hammer the CMS', async () => {
    const { resolver: r, calls } = resolver([{ sourcePath: '/x', destinationUrl: '/news/x/' }], {}, { fail: true });
    for (let i = 0; i < 5; i++) expect(await r.resolve('/x/')).toBeNull();
    expect(calls).toHaveLength(1);
    const broken = createRedirectResolver({ origin: 'http://cms.test', fetch: async () => new Response('Private diagnostic', { status: 503 }) });
    expect(await broken.resolve('/x/')).toBeNull();
  });

  test('misses are cached briefly, then asked again; recovery after an outage works', async () => {
    let clock = 0;
    const rows: Row[] = [];
    const { resolver: r, calls } = resolver(rows, { now: () => clock, missTtlMs: 1000 });
    expect(await r.resolve('/late/')).toBeNull();
    rows.push({ sourcePath: '/late', destinationUrl: '/news/late/' });
    expect(await r.resolve('/late/')).toBeNull();
    clock = 1001;
    expect((await r.resolve('/late/'))?.location).toBe('/news/late/');
    expect(calls).toHaveLength(2);
  });

  test('the cache is bounded', async () => {
    const { resolver: r } = resolver([], { maxEntries: 5 });
    for (let i = 0; i < 50; i++) await r.resolve(`/missing-${i}/`);
    expect(r.size).toBe(5);
  });

  test('the cache evicts the least recently used entry, so a hot redirect survives a flood', async () => {
    const { resolver: r, calls } = resolver([{ sourcePath: '/hot', destinationUrl: '/news/hot/' }], { maxEntries: 5 });
    await r.resolve('/hot/');
    for (let i = 0; i < 20; i++) { await r.resolve(`/flood-${i}/`); await r.resolve('/hot/'); }
    expect(calls.filter(call => call === '/hot')).toHaveLength(1);
  });

  test('lookups beyond the concurrency limit are shed to a normal 404 instead of queueing', async () => {
    let release!: () => void;
    const gate = new Promise<void>(done => { release = done; });
    let started = 0;
    const r = createRedirectResolver({ origin: 'http://cms.test', maxConcurrent: 2, fetch: async () => { started++; await gate; return Response.json({ docs: [] }); } });
    const all = Promise.all(['/p1/', '/p2/', '/p3/', '/p4/'].map(path => r.resolve(path)));
    await Bun.sleep(10);
    expect(started).toBe(2);
    release();
    expect(await all).toEqual([null, null, null, null]);
  });
});
