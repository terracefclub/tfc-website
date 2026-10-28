import type { EventCategory, Initiative, Newsletter, TerraceEvent } from '../content';

type RecordValue = Record<string, unknown>;
type Fetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

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
  timeoutMs?: number;
}) {
  const base = origin(options.origin);
  const publicBase = origin(options.publicOrigin ?? options.origin);
  const request = options.fetch ?? globalThis.fetch;

  function mediaURL(value: unknown, mime: string): string {
    const item = record(value);
    if (item.public !== true || item.mimeType !== mime) throw new ContentUnavailable();
    let url: URL;
    try { url = new URL(text(item.url, 2000), base); } catch { throw new ContentUnavailable(); }
    if (url.origin !== base.origin || url.username || url.password || url.search || url.hash ||
        !url.pathname.startsWith('/api/media/file/')) throw new ContentUnavailable();
    return new URL(url.pathname, publicBase).href;
  }

  async function collection(name: string, query: Record<string, string> = {}): Promise<RecordValue[]> {
    const result: RecordValue[] = [];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 4000);
    try {
      for (let page = 1; page <= 20; page++) {
        controller.signal.throwIfAborted();
        const url = new URL(`/api/${name}`, base);
        url.search = new URLSearchParams({ 'where[_status][equals]': 'published', depth: '1', limit: '100', page: String(page), ...query }).toString();
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
        const payload = record(JSON.parse(new TextDecoder().decode(bytes)));
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

  function event(doc: RecordValue): TerraceEvent {
    const category = text(doc.category, 30);
    if (!['music', 'food', 'community'].includes(category)) throw new ContentUnavailable();
    const startsAt = date(doc.startsAt), endsAt = doc.endsAt ? date(doc.endsAt) : undefined;
    if (endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) throw new ContentUnavailable();
    const excerpt = text(doc.summary);
    return { slug: slug(doc.slug), title: text(doc.title, 200), category: category as EventCategory,
      startsAt, endsAt, location: text(doc.locationName, 200), excerpt, description: bodyText(doc.body, excerpt), preview: false };
  }

  return {
    async events() { return (await collection('events', { sort: 'startsAt' })).map(event); },
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
    }
  };
}
