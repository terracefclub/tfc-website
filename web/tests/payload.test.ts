import { describe, expect, test } from 'bun:test';
import { ContentUnavailable, createPayloadClient } from '../src/lib/server/payload';
import { fixtureContent } from '../src/lib/content';

const publishedEvent = { _status: 'published', slug: 'club-dinner', title: 'Club dinner', summary: 'Everyone is welcome.', startsAt: '2027-01-08T23:00:00.000Z', endsAt: '2027-01-09T01:00:00.000Z', category: 'food', locationName: 'The clubhouse' };
const json = (docs: unknown[], hasNextPage = false) => Response.json({ docs, hasNextPage });
const client = (request: (url: string | URL, init?: RequestInit) => Promise<Response>, now = () => new Date('2027-01-01T00:00:00.000Z')) => createPayloadClient({ origin: 'http://127.0.0.1:3000', fetch: request, now });

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

  test('lists future and ongoing events, excludes ended and past undated events, but keeps past detail URLs', async () => {
    const now = new Date('2027-01-09T00:00:00.000Z');
    const ended = { ...publishedEvent, slug: 'ended', startsAt: '2027-01-08T20:00:00.000Z', endsAt: '2027-01-08T22:00:00.000Z' };
    const ongoing = { ...publishedEvent, slug: 'ongoing', startsAt: '2027-01-08T23:00:00.000Z', endsAt: now.toISOString() };
    const future = { ...publishedEvent, slug: 'future', startsAt: now.toISOString(), endsAt: '2027-01-09T01:00:00.000Z' };
    const pastWithoutEnd = { ...publishedEvent, slug: 'past-without-end', startsAt: '2027-01-08T20:00:00.000Z', endsAt: undefined };
    const futureWithoutEnd = { ...publishedEvent, slug: 'future-without-end', startsAt: '2027-01-10T20:00:00.000Z', endsAt: undefined };
    const docs = [ended, ongoing, future, pastWithoutEnd, futureWithoutEnd];
    const calls: URL[] = [];
    const cms = client(async value => {
      const url = new URL(value);
      calls.push(url);
      if (url.searchParams.has('where[slug][equals]')) return json([ended]);
      expect(url.searchParams.get('where[or][0][startsAt][greater_than_equal]')).toBe(now.toISOString());
      expect(url.searchParams.get('where[or][1][endsAt][greater_than_equal]')).toBe(now.toISOString());
      return json(docs);
    }, () => now);

    expect((await cms.events()).map(event => event.slug)).toEqual(['ongoing', 'future', 'future-without-end']);
    expect((await cms.event('ended'))?.slug).toBe('ended');
    expect(calls[1].searchParams.has('where[or][0][startsAt][greater_than_equal]')).toBe(false);
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

describe('event poster images', () => {
  const poster = { id: 7, public: true, mimeType: 'image/webp', url: 'http://127.0.0.1:3000/api/media/file/poster.webp', alt: 'A hand-lettered soup poster', caption: 'Poster for the supper', credit: 'Ada Example', width: 800, height: 1200 };
  const first = async (coverImage: unknown, slug = 'club-dinner', options: Partial<Parameters<typeof createPayloadClient>[0]> = {}) =>
    (await createPayloadClient({ origin: 'http://127.0.0.1:3000', publicOrigin: 'https://files.example.org', now: () => new Date('2027-01-01T00:00:00.000Z'), fetch: async () => json([{ ...publishedEvent, slug, coverImage }]), ...options }).events())[0];

  test('maps a public CMS image to the browser origin with alt, caption, credit and dimensions', async () => {
    expect((await first(poster)).image).toEqual({ url: 'https://files.example.org/api/media/file/poster.webp', alt: poster.alt, caption: poster.caption, credit: poster.credit, width: 800, height: 1200 });
  });

  test('omits optional caption, credit and unusable dimensions instead of inventing them', async () => {
    const image = (await first({ ...poster, caption: ' ', credit: null, width: 0, height: 'tall' })).image;
    expect(image).toEqual({ url: 'https://files.example.org/api/media/file/poster.webp', alt: poster.alt });
  });

  test('without a CMS image, a sample slug keeps its fixture poster and other events have none', async () => {
    const sample = fixtureContent.events[0];
    expect((await first(null, sample.slug)).image).toEqual(sample.image);
    expect((await first(undefined, sample.slug)).image).toEqual(sample.image);
    expect('image' in (await first(null))).toBe(false);
  });

  test('a CMS image takes precedence over the fixture poster', async () => {
    expect((await first(poster, fixtureContent.events[0].slug)).image?.alt).toBe(poster.alt);
  });

  test.each([
    ['an unpopulated relationship id', 7],
    ['private media', { ...poster, public: false }],
    ['a PDF', { ...poster, mimeType: 'application/pdf' }],
    ['an SVG', { ...poster, mimeType: 'image/svg+xml' }],
    ['a foreign origin', { ...poster, url: 'https://other.example/api/media/file/poster.webp' }],
    ['a non-media path', { ...poster, url: '/api/users/me' }],
    ['missing alt text', { ...poster, alt: ' ' }]
  ])('falls back rather than showing %s', async (_name, coverImage) => {
    const sample = fixtureContent.events[1];
    expect((await first(coverImage, sample.slug)).image).toEqual(sample.image);
    expect('image' in (await first(coverImage))).toBe(false);
  });

  test('the fallback can be replaced by the caller', async () => {
    const image = { url: '/x.png', alt: 'x' };
    expect((await first(null, 'club-dinner', { fallbackImage: () => image })).image).toBe(image);
  });
});
