// Redirect consumer: answers old WordPress URLs that match no route with the stored same-site redirect.
// Pure of SvelteKit imports so it is unit-testable. Every failure path returns null, which the caller
// turns into the normal 404.
import { isAppRoute } from '../site-routes';

export type RedirectHit = { location: string; status: 301 | 302 };
type Fetch = (input: string | URL, init?: RequestInit) => Promise<Response>;
type Entry = { destination: string; status: 301 | 302 } | null;

const sourcePattern = /^\/(?!\/)[a-zA-Z0-9/_-]*$/;
const maxPath = 500;

/** Request path to the stored form: one trailing slash trimmed, case untouched. Null when it cannot be a stored source. */
export function normalizeSource(pathname: string): string | null {
  if (pathname.length > maxPath + 1) return null;
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  if (path === '/' || path.includes('//') || !sourcePattern.test(path)) return null;
  return path;
}

/**
 * A stored destination is honoured only when it is a same-site path: one leading slash, no scheme, backslash,
 * protocol-relative form, dot segment or query, and never the source itself. The site uses trailing slashes, so one
 * is appended to avoid a second redirect.
 */
export function safeDestination(destination: unknown, source: string): string | null {
  if (typeof destination !== 'string' || destination.length > maxPath || !sourcePattern.test(destination) || destination.includes('//')) return null;
  if (destination.split('/').some(segment => segment === '.' || segment === '..')) return null;
  const trimmed = destination.length > 1 && destination.endsWith('/') ? destination.slice(0, -1) : destination;
  if (trimmed === '/' || trimmed.toLowerCase() === source.toLowerCase()) return null;
  return `${trimmed}/`;
}

export function createRedirectResolver(options: {
  origin: string;
  fetch?: Fetch;
  /** Cache lifetimes. Misses and outages are remembered briefly so a 404 flood does not reach the CMS. */
  hitTtlMs?: number; missTtlMs?: number; failureTtlMs?: number;
  maxEntries?: number; maxConcurrent?: number; timeoutMs?: number;
  now?: () => number;
}) {
  const request = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  const hitTtl = options.hitTtlMs ?? 300_000, missTtl = options.missTtlMs ?? 60_000, failureTtl = options.failureTtlMs ?? 10_000;
  const maxEntries = options.maxEntries ?? 500, maxConcurrent = options.maxConcurrent ?? 8;
  const cache = new Map<string, { entry: Entry; expires: number }>();
  const inflight = new Map<string, Promise<Entry>>();

  const remember = (key: string, entry: Entry, ttl: number) => {
    cache.delete(key);
    cache.set(key, { entry, expires: now() + ttl });
    while (cache.size > maxEntries) cache.delete(cache.keys().next().value as string);
  };

  async function fromCms(source: string): Promise<Entry> {
    const url = new URL('/api/redirects', options.origin);
    url.search = new URLSearchParams({ 'where[sourcePath][equals]': source, 'where[active][equals]': 'true', depth: '0', limit: '1' }).toString();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 1500);
    try {
      const response = await request(url, { headers: { Accept: 'application/json' }, credentials: 'omit', redirect: 'error', signal: controller.signal });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('unavailable');
      const text = await response.text();
      if (text.length > 100_000) throw new Error('oversize');
      const payload = JSON.parse(text) as { docs?: unknown };
      if (!Array.isArray(payload.docs) || payload.docs.length > 1) throw new Error('shape');
      const doc = payload.docs[0] as Record<string, unknown> | undefined;
      if (!doc) { remember(source, null, missTtl); return null; }
      // The CMS filters on these already; re-check because the database is not trusted.
      const status = Number(doc.statusCode);
      const destination = safeDestination(doc.destinationUrl, source);
      if (doc.sourcePath !== source || doc.active !== true || (status !== 301 && status !== 302) || !destination) { remember(source, null, missTtl); return null; }
      const entry: Entry = { destination, status };
      remember(source, entry, hitTtl);
      return entry;
    } catch {
      remember(source, null, failureTtl); // fail open: a normal 404
      return null;
    } finally { clearTimeout(timer); }
  }

  function lookup(source: string, shed = true): Promise<Entry> {
    const cached = cache.get(source);
    if (cached) {
      cache.delete(source);
      if (cached.expires > now()) { cache.set(source, cached); return Promise.resolve(cached.entry); } // LRU: a hot redirect moves to the newest slot
    }
    const pending = inflight.get(source);
    if (pending) return pending;
    if (shed && inflight.size >= maxConcurrent) return Promise.resolve(null); // shed load rather than queue behind a flood
    const run = fromCms(source).finally(() => inflight.delete(source));
    inflight.set(source, run);
    return run;
  }

  /** The one-hop redirect for a request path that matched no route, or null. Never follows a chain. */
  const resolve = async (pathname: string): Promise<RedirectHit | null> => {
      const source = normalizeSource(pathname);
      if (!source || isAppRoute(source)) return null;
      const entry = await lookup(source);
      if (!entry) return null;
      // Refuse a two-step loop (A to B while B points back to A). Longer chains end at the browser's own limit.
      const next = normalizeSource(entry.destination);
      if (next && !isAppRoute(next)) {
        const second = await lookup(next);
        if (second && normalizeSource(second.destination)?.toLowerCase() === source.toLowerCase()) return null;
      }
      return { location: entry.destination, status: entry.status };
  };

  return {
    resolve,
    /** Destination for an old-site path found inside stored content, or null. Same rules as `resolve`, minus the loop check. */
    // Render-time path: not shed by the 404-flood cap (callers batch their own requests) and no loop-check fetch.
    destination: async (pathname: string): Promise<string | null> => {
      const source = normalizeSource(pathname);
      if (!source || isAppRoute(source)) return null;
      return (await lookup(source, false))?.destination ?? null;
    },
    get size() { return cache.size; },
    clear() { cache.clear(); }
  };
}

export type RedirectResolver = ReturnType<typeof createRedirectResolver>;

const shared = new Map<string, RedirectResolver>();
/** One resolver (and cache) per CMS origin for the life of the server process. */
export function sharedRedirectResolver(origin: string): RedirectResolver {
  let resolver = shared.get(origin);
  if (!resolver) { resolver = createRedirectResolver({ origin }); shared.set(origin, resolver); }
  return resolver;
}
