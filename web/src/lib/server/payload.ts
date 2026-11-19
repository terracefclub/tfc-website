import { fixtureContent, type EventCategory, type EventImage, type Initiative, type Newsletter, type TerraceEvent } from '../content';

type RecordValue = Record<string, unknown>;
type Fetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type ContentSummary = { slug: string; title: string; publishedAt?: string; excerpt?: string };
export type ContentDocument = ContentSummary & { bodyHtml: string; authorName?: string; seoTitle?: string; seoDescription?: string };
export type ContentPage = { docs: ContentSummary[]; page: number; totalPages: number };
export type PostView = { post: ContentDocument; previous?: ContentSummary; next?: ContentSummary };

export class ContentUnavailable extends Error {
  constructor() { super('Published content is temporarily unavailable'); }
}

function record(value: unknown): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ContentUnavailable();
  return value as RecordValue;
}

function text(value: unknown, max = 1000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new ContentUnavailable();
  return value;
}

function date(value: unknown): string {
  const result = text(value, 50);
  if (!/^\d{4}-\d\d-\d\dT/.test(result) || !Number.isFinite(Date.parse(result))) throw new ContentUnavailable();
  return result;
}

function slug(value: unknown): string {
  const result = text(value, 120);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result)) throw new ContentUnavailable();
  return result;
}

function origin(value: string): URL {
  try {
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
        !(url.protocol === 'https:' || (url.protocol === 'http:' && local))) throw new Error();
    return url;
  } catch { throw new ContentUnavailable(); }
}

// The initial CMS uses textareas. Render their contents as text, never as HTML.
function bodyText(value: unknown, fallback: string): string {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string' || value.length > 40000) throw new ContentUnavailable();
  return value.trim() || fallback;
}

export function createPayloadClient(options: {
  origin: string;
  publicOrigin?: string;
  fetch?: Fetch;
  /** Poster used when an event has no (usable) CMS image; defaults to the sample fixture poster for the same slug. */
  fallbackImage?: (slug: string) => EventImage | undefined;
  timeoutMs?: number;
  now?: () => Date;
}) {
  const base = origin(options.origin);
  const publicBase = origin(options.publicOrigin ?? options.origin);
  const request = options.fetch ?? globalThis.fetch;

  const posterTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const fallbackImage = options.fallbackImage ?? ((slug: string) => fixtureContent.events.find(value => value.slug === slug)?.image);

  function mediaURL(value: unknown, mime: string | string[]): string {
    const item = record(value);
    if (item.public !== true || typeof item.mimeType !== 'string' || !(Array.isArray(mime) ? mime : [mime]).includes(item.mimeType)) throw new ContentUnavailable();
    let url: URL;
    try { url = new URL(text(item.url, 2000), base); } catch { throw new ContentUnavailable(); }
    if (url.origin !== base.origin || url.username || url.password || url.search || url.hash ||
        !url.pathname.startsWith('/api/media/file/')) throw new ContentUnavailable();
    return new URL(url.pathname, publicBase).href;
  }

  /** One bounded, credential-free JSON request. */
  async function getJson(url: URL, controller: AbortController): Promise<RecordValue> {
    controller.signal.throwIfAborted();
    const response = await request(url, { headers: { Accept: 'application/json' }, credentials: 'omit', redirect: 'error', signal: controller.signal });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new ContentUnavailable();
    const reader = response.body?.getReader();
    if (!reader) throw new ContentUnavailable();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 2_000_000) { await reader.cancel(); throw new ContentUnavailable(); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return record(JSON.parse(new TextDecoder().decode(bytes)));
  }

  async function collection(name: string, query: Record<string, string> = {}): Promise<RecordValue[]> {
    const result: RecordValue[] = [];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 4000);
    try {
      for (let page = 1; page <= 20; page++) {
        const url = new URL(`/api/${name}`, base);
        url.search = new URLSearchParams({ 'where[_status][equals]': 'published', depth: '1', limit: '100', page: String(page), ...query }).toString();
        const payload = await getJson(url, controller);
        if (!Array.isArray(payload.docs) || payload.docs.length > 100 || typeof payload.hasNextPage !== 'boolean') throw new ContentUnavailable();
        for (const value of payload.docs) {
          const doc = record(value);
          if (doc._status !== 'published') throw new ContentUnavailable();
          result.push(doc);
        }
        if (!payload.hasNextPage) return result;
      }
      throw new ContentUnavailable();
    } catch { throw new ContentUnavailable(); }
    finally { clearTimeout(timer); }
  }

  /** One page of published documents with only the named fields (list pages never pull whole bodies). */
  async function publishedPage(name: string, query: Record<string, string>): Promise<{ docs: RecordValue[]; totalPages: number }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 4000);
    try {
      const url = new URL(`/api/${name}`, base);
      url.search = new URLSearchParams({ 'where[_status][equals]': 'published', depth: '0', ...query }).toString();
      const payload = await getJson(url, controller);
      if (!Array.isArray(payload.docs) || payload.docs.length > 100 || !Number.isInteger(payload.totalPages)) throw new ContentUnavailable();
      const docs = payload.docs.map(record);
      if (docs.some(doc => doc._status !== 'published')) throw new ContentUnavailable();
      return { docs, totalPages: Math.max(1, payload.totalPages as number) };
    } catch { throw new ContentUnavailable(); }
    finally { clearTimeout(timer); }
  }

  const optionalText = (value: unknown, max: number): string | undefined => {
    if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) return undefined;
    return text(value, max);
  };
  // An unparseable or absent date only hides the date, never the document.
  const optionalDate = (value: unknown): string | undefined => { try { return value === undefined || value === null ? undefined : date(value); } catch { return undefined; } };
  const summary = (doc: RecordValue): ContentSummary => ({
    slug: slug(doc.slug), title: text(doc.title, 300), publishedAt: optionalDate(doc.publishedAt), excerpt: optionalText(doc.excerpt, 2000)
  });
  const fullDocument = (doc: RecordValue): ContentDocument => ({
    ...summary(doc),
    bodyHtml: typeof doc.bodyHtml === 'string' && doc.bodyHtml.length <= 1_048_576 ? doc.bodyHtml : '',
    authorName: optionalText(doc.authorName, 200),
    seoTitle: optionalText(doc.seoTitle, 300),
    seoDescription: optionalText(doc.seoDescription, 500)
  });
  const summaryFields = { 'select[slug]': 'true', 'select[title]': 'true', 'select[publishedAt]': 'true', 'select[excerpt]': 'true', 'select[_status]': 'true' };

  // A missing, unpopulated, private or malformed image never hides the event: it falls back instead.
  function posterImage(value: unknown): EventImage | undefined {
    try {
      const item = record(value);
      const result: EventImage = { url: mediaURL(item, posterTypes), alt: text(item.alt, 300) };
      const { width, height } = item;
      if (Number.isInteger(width) && Number.isInteger(height) && (width as number) > 0 && (height as number) > 0 && (width as number) <= 20000 && (height as number) <= 20000) {
        result.width = width as number;
        result.height = height as number;
      }
      for (const [key, max] of [['caption', 500], ['credit', 200]] as const) {
        if (typeof item[key] === 'string' && item[key].trim() && item[key].length <= max) result[key] = item[key].trim();
      }
      return result;
    } catch { return undefined; }
  }

  function event(doc: RecordValue): TerraceEvent {
    const category = text(doc.category, 30);
    if (!['music', 'food', 'community'].includes(category)) throw new ContentUnavailable();
    const startsAt = date(doc.startsAt), endsAt = doc.endsAt ? date(doc.endsAt) : undefined;
    if (endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) throw new ContentUnavailable();
    const excerpt = text(doc.summary);
    const eventSlug = slug(doc.slug);
    const image = posterImage(doc.coverImage) ?? fallbackImage(eventSlug);
    return { slug: eventSlug, title: text(doc.title, 200), category: category as EventCategory,
      startsAt, endsAt, location: text(doc.locationName, 200), excerpt, description: bodyText(doc.body, excerpt),
      ...(image ? { image } : {}), preview: false };
  }

  return {
    async events() {
      const now = options.now?.() ?? new Date();
      const nowIso = now.toISOString();
      const nowMs = now.getTime();
      const docs = await collection('events', {
        sort: 'startsAt',
        'where[or][0][startsAt][greater_than_equal]': nowIso,
        'where[or][1][endsAt][greater_than_equal]': nowIso
      });
      return docs.map(event).filter(value =>
        Date.parse(value.startsAt) >= nowMs || (value.endsAt !== undefined && Date.parse(value.endsAt) >= nowMs)
      );
    },
    async event(value: string) {
      const docs = await collection('events', { 'where[slug][equals]': slug(value) });
      if (docs.length > 1) throw new ContentUnavailable();
      return docs.length ? event(docs[0]) : undefined;
    },
    async newsletters(): Promise<Newsletter[]> {
      return (await collection('newsletters', { sort: '-issueDate' })).map(doc => {
        const issue = new Date(date(doc.issueDate));
        return { title: text(doc.title, 200), year: issue.getUTCFullYear(),
          season: new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(issue),
          url: mediaURL(doc.issuePdf, 'application/pdf') };
      });
    },
    async initiatives(): Promise<Initiative[]> {
      return (await collection('initiatives', { sort: 'title' })).map(doc => {
        const summary = text(doc.summary);
        const result: Initiative = { slug: slug(doc.slug), title: text(doc.title, 200), summary, description: bodyText(doc.body, summary) };
        if (doc.ctaUrl) {
          const value = text(doc.ctaUrl, 2000);
          let url: URL;
          try { url = new URL(value); } catch { throw new ContentUnavailable(); }
          if (url.protocol !== 'https:' || url.username || url.password) throw new ContentUnavailable();
          result.ctaUrl = url.href;
          result.ctaLabel = text(doc.ctaLabel, 100);
        }
        return result;
      });
    },
    /** Published posts, newest first, one page at a time. */
    async posts(page: number, limit = 12): Promise<ContentPage> {
      const result = await publishedPage('posts', { ...summaryFields, sort: '-publishedAt', limit: String(limit), page: String(page) });
      return { docs: result.docs.map(summary), page, totalPages: result.totalPages };
    },
    async post(value: string): Promise<PostView | undefined> {
      const docs = await collection('posts', { 'where[slug][equals]': slug(value), depth: '0' });
      if (docs.length > 1) throw new ContentUnavailable();
      if (!docs.length) return undefined;
      const post = fullDocument(docs[0]);
      // Neighbours are a convenience: any failure just omits the links.
      const neighbour = async (direction: 'older' | 'newer') => {
        if (!post.publishedAt) return undefined;
        try {
          const { docs: found } = await publishedPage('posts', { ...summaryFields, limit: '1', page: '1',
            sort: direction === 'older' ? '-publishedAt' : 'publishedAt',
            [`where[publishedAt][${direction === 'older' ? 'less_than' : 'greater_than'}]`]: post.publishedAt });
          return found.length ? summary(found[0]) : undefined;
        } catch { return undefined; }
      };
      const [previous, next] = await Promise.all([neighbour('older'), neighbour('newer')]);
      return { post, previous, next };
    },
    async page(value: string): Promise<ContentDocument | undefined> {
      const docs = await collection('pages', { 'where[slug][equals]': slug(value), depth: '0' });
      if (docs.length > 1) throw new ContentUnavailable();
      return docs.length ? fullDocument(docs[0]) : undefined;
    }
  };
}
