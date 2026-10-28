import { describe, expect, test } from 'bun:test';
import { ContentUnavailable, createPayloadClient } from '../src/lib/server/payload';

const publishedEvent = { _status: 'published', slug: 'club-dinner', title: 'Club dinner', summary: 'Everyone is welcome.', startsAt: '2027-01-08T23:00:00.000Z', endsAt: '2027-01-09T01:00:00.000Z', category: 'food', locationName: 'The clubhouse' };
const json = (docs: unknown[], hasNextPage = false) => Response.json({ docs, hasNextPage });
const client = (request: (url: string | URL, init?: RequestInit) => Promise<Response>) => createPayloadClient({ origin: 'http://127.0.0.1:3000', fetch: request });

describe('public Payload boundary', () => {
  test('requests published records anonymously and follows bounded pagination', async () => {
    const calls: URL[] = [];
    const cms = client(async (value, init) => {
      const url = new URL(value); calls.push(url);
      expect(url.searchParams.get('where[_status][equals]')).toBe('published');
      expect(url.searchParams.get('depth')).toBe('1');
      expect(init?.credentials).toBe('omit');
      expect(init?.redirect).toBe('error');
      expect(new Headers(init?.headers).has('Authorization')).toBe(false);
      expect(new Headers(init?.headers).has('Cookie')).toBe(false);
      return calls.length === 1 ? json([publishedEvent], true) : json([{ ...publishedEvent, slug: 'another-dinner' }]);
    });
    const events = await cms.events();
    expect(events.map(event => event.slug)).toEqual(['club-dinner', 'another-dinner']);
    expect(events[0].preview).toBe(false);
    expect(calls.map(url => url.searchParams.get('page'))).toEqual(['1', '2']);
  });

  test('a missing published event is distinct from a backend outage', async () => {
    expect(await client(async () => json([])).event('missing')).toBeUndefined();
    await expect(client(async () => new Response('Unavailable', { status: 503 })).event('missing')).rejects.toBeInstanceOf(ContentUnavailable);
  });

  test.each([
    { ...publishedEvent, _status: 'draft' },
    { ...publishedEvent, startsAt: 'not a date' },
    { ...publishedEvent, endsAt: publishedEvent.startsAt },
    { ...publishedEvent, slug: '../private' },
    { ...publishedEvent, category: 'unknown' }
  ])('rejects unsafe or malformed event records', async value => {
    await expect(client(async () => json([value])).events()).rejects.toBeInstanceOf(ContentUnavailable);
  });

  test('preserves textarea text without interpreting markup and permits no end time', async () => {
    const body = '<script>alert(1)</script>\n\nAnother paragraph.';
    const [event] = await client(async () => json([{ ...publishedEvent, endsAt: null, body }])).events();
    expect(event.description).toBe(body);
    expect(event.endsAt).toBeUndefined();
  });

  test('empty editor text uses the summary', async () => {
    const body = '';
    const [event] = await client(async () => json([{ ...publishedEvent, body }])).events();
    expect(event.description).toBe(publishedEvent.summary);
  });

  test('rewrites only public PDF URLs to the configured browser origin', async () => {
    const cms = createPayloadClient({ origin: 'http://127.0.0.1:3000', publicOrigin: 'https://files.example.org', fetch: async () => json([{ _status: 'published', title: 'Winter news', issueDate: '2027-01-01T00:00:00.000Z', issuePdf: { public: true, mimeType: 'application/pdf', url: '/api/media/file/winter.pdf' } }]) });
    expect((await cms.newsletters())[0].url).toBe('https://files.example.org/api/media/file/winter.pdf');
  });

  test.each([
    { public: false, mimeType: 'application/pdf', url: '/api/media/file/private.pdf' },
    { public: true, mimeType: 'text/html', url: '/api/media/file/index.html' },
    { public: true, mimeType: 'application/pdf', url: 'https://other.example/file.pdf' },
    { public: true, mimeType: 'application/pdf', url: '/api/media/file/../../users' }
  ])('rejects private or unexpected newsletter media', async issuePdf => {
    await expect(client(async () => json([{ _status: 'published', title: 'News', issueDate: '2027-01-01T00:00:00.000Z', issuePdf }])).newsletters()).rejects.toBeInstanceOf(ContentUnavailable);
  });

  test('rejects unsafe initiative calls to action', async () => {
    await expect(client(async () => json([{ _status: 'published', slug: 'care', title: 'Care', summary: 'Help out.', ctaUrl: 'javascript:alert(1)', ctaLabel: 'Go' }])).initiatives()).rejects.toBeInstanceOf(ContentUnavailable);
  });

  test.each(['https://user:password@example.org', 'http://example.org', 'file:///tmp/content', 'https://example.org/subpath', 'https://example.org/?token=example'])('rejects an unsafe CMS origin', value => {
    expect(() => createPayloadClient({ origin: value })).toThrow(ContentUnavailable);
  });

  test('bounds total pages and response bytes', async () => {
    let calls = 0;
    await expect(client(async () => { calls++; return json([], true); }).events()).rejects.toBeInstanceOf(ContentUnavailable);
    expect(calls).toBe(20);
    await expect(client(async () => new Response(' '.repeat(2_000_001), { headers: { 'content-type': 'application/json' } })).events()).rejects.toBeInstanceOf(ContentUnavailable);
  });

  test('aborts an unresponsive request and exposes only a generic error', async () => {
    const cms = createPayloadClient({ origin: 'http://127.0.0.1:3000', timeoutMs: 10, fetch: async (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('internal diagnostic')), { once: true });
    }) });
    await expect(cms.events()).rejects.toThrow('Published content is temporarily unavailable');
  });
});
