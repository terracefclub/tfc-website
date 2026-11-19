// Render-time treatment of stored `bodyHtml`. The database is not trusted: the HTML is sanitized again with the
// importer's allowlist, then images and links get site policy, then it is sanitized once more so the result is
// always a fixed point of the allowlist. Only the return value may be given to {@html}.
import { decodeEntities, sanitizeHtml } from './html-sanitize';
import { oldSiteHosts } from './site-routes';

export type RenderOptions = {
  /** Public origin that serves CMS media (no trailing slash). Without it every image is dropped. */
  mediaOrigin?: string;
  /** Maps an old-site path to its new same-site path (the redirect map), or null. */
  resolveOldPath?: (path: string) => Promise<string | null>;
  /** Overall time allowed for the whole link-lookup step (default 3000 ms). Links not resolved by then stay as written. */
  lookupDeadlineMs?: number;
};

// File names start alphanumeric and never contain `%` or a `..` run.
const mediaPath = /^\/api\/media\/file\/(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9._-]*$/;
const escapeAttr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attribute = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
const maxLookups = 25, batchSize = 4, defaultLookupDeadlineMs = 3000;

/**
 * Image policy: imported media bytes are not on the site yet, so a body image survives only when it points at the
 * CMS's public media path. Anything else (old WordPress uploads, other hosts, relative paths) is removed with no
 * placeholder, and a figure left without an image keeps only its caption text. Nothing broken is rendered.
 */
function localMediaUrl(source: string, mediaOrigin: string | undefined): string | null {
  if (!mediaOrigin) return null;
  const value = decodeEntities(source);
  const path = value.startsWith(`${mediaOrigin}/`) ? value.slice(mediaOrigin.length) : value;
  return mediaPath.test(path) ? `${mediaOrigin}${path}` : null;
}

function internalPath(href: string): { path: string; fragment: string } | null {
  const value = decodeEntities(href);
  let url: URL;
  try { url = new URL(value, 'https://site.invalid'); } catch { return null; }
  const relative = value.startsWith('/') && !value.startsWith('//');
  const old = /^https?:/i.test(value) && oldSiteHosts.has(url.hostname.toLowerCase());
  if ((!relative && !old) || url.search) return null;
  return { path: url.pathname, fragment: url.hash };
}

export async function renderBody(bodyHtml: string, options: RenderOptions = {}): Promise<string> {
  let html = sanitizeHtml(bodyHtml).html;

  html = html.replace(/<img\b[^>]*>/g, tag => {
    const source = attribute(tag, 'src');
    const local = source === undefined ? null : localMediaUrl(source, options.mediaOrigin);
    return local ? tag.replace(/(\ssrc=")[^"]*(")/, (_all, a: string, b: string) => a + escapeAttr(local) + b) : '';
  });
  html = html.replace(/<figure>([\s\S]*?)<\/figure>/g, (whole, inner: string) => {
    if (/<img\b/.test(inner)) return whole;
    const caption = /<figcaption>([\s\S]*?)<\/figcaption>/.exec(inner);
    return caption?.[1].trim() ? `<p>${caption[1]}</p>` : '';
  });
  html = html.replace(/<a\b[^>]*>\s*<\/a>/g, '');

  if (options.resolveOldPath) {
    const found = new Map<string, { path: string; fragment: string }>();
    for (const match of html.matchAll(/<a\b[^>]*>/g)) {
      const href = attribute(match[0], 'href');
      const parsed = href === undefined ? null : internalPath(href);
      if (parsed && href !== undefined && !found.has(href) && found.size < maxLookups) found.set(href, parsed);
    }
    const rewritten = new Map<string, string>();
    const entries = [...found];
    // One deadline for the whole step: a stalled CMS costs a first render at most this long, not (25 / 4) x the
    // per-request timeout. Batches not yet started when it passes are never sent, so nothing about them is cached;
    // a request already in flight ends under its own timeout and its result is simply not waited for.
    const deadline = Date.now() + (options.lookupDeadlineMs ?? defaultLookupDeadlineMs);
    let expired!: () => void;
    const late = new Promise<void>(resolve => { expired = resolve; });
    const timer = setTimeout(expired, Math.max(0, deadline - Date.now()));
    try {
      for (let i = 0; i < entries.length && Date.now() < deadline; i += batchSize) { // small sequential batches: the CMS is never flooded
        const batch = Promise.all(entries.slice(i, i + batchSize).map(async ([href, { path, fragment }]) => {
          try {
            const destination = await options.resolveOldPath!(path);
            if (destination) rewritten.set(href, destination + fragment);
          } catch { /* a failed lookup leaves the link as written */ }
        }));
        await Promise.race([batch, late]);
      }
    } finally { clearTimeout(timer); }
    const resolved = new Map(rewritten); // results that arrive after the deadline must not change the output
    html = html.replace(/<a\b[^>]*>/g, tag => {
      const href = attribute(tag, 'href');
      const to = href === undefined ? undefined : resolved.get(href);
      return to ? tag.replace(/(\shref=")[^"]*(")/, (_all, a: string, b: string) => a + escapeAttr(to) + b) : tag;
    });
  }
  return sanitizeHtml(html).html;
}

/** The origin that serves public media. Only the explicit public origin counts: the internal CMS origin is never exposed to visitors. */
export function mediaOriginOf(publicOrigin: string | undefined): string | undefined {
  try { return publicOrigin ? new URL(publicOrigin).origin : undefined; } catch { return undefined; }
}
