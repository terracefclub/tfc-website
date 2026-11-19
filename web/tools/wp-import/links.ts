// Link audit for imported bodies: which internal links will 404 on the new site, and which still point at the old
// site's uploads (they break at cutover unless the media bytes are imported and the links rewritten, see zip-hooks.ts).
// Reports are paths only. Pure and offline.
import { decodeEntities } from './sanitize';

export type LinkContext = {
  /** Hosts that mean "this site" (the export's own host and the importer's known hosts). */
  hosts: ReadonlySet<string>;
  /** True when the new site answers this path (an app route, a mapped page or an active redirect source). */
  resolves(path: string): boolean;
};
export type DocLinks = { unresolved: string[]; uploads: string[]; uploadImages: number; internal: number };
export const uploadPrefix = '/wp-content/uploads/';

const attribute = (tag: string, name: string) => new RegExp(`<${tag}\\b[^>]*?\\s${name}="([^"]*)"`, 'gi');

function internalPath(value: string, hosts: ReadonlySet<string>): { path: string; query: boolean } | null {
  const raw = decodeEntities(value).trim();
  if (!raw || raw.startsWith('#') || /^(?:mailto|tel):/i.test(raw) || raw.startsWith('//')) return null;
  let url: URL;
  try { url = new URL(raw, 'https://internal.invalid'); } catch { return null; }
  const absolute = /^[a-z][a-z0-9+.-]*:/i.test(raw);
  if (absolute ? !['http:', 'https:'].includes(url.protocol) || !hosts.has(url.hostname) : !raw.startsWith('/')) return null;
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/$/, '') : url.pathname;
  return { path, query: url.search !== '' };
}

export function auditLinks(html: string, context: LinkContext): DocLinks {
  const unresolved = new Set<string>(), uploads = new Set<string>();
  let internal = 0, uploadImages = 0;
  for (const match of html.matchAll(attribute('a', 'href'))) {
    const target = internalPath(match[1], context.hosts);
    if (!target) continue;
    internal++;
    if (target.path.startsWith(uploadPrefix)) uploads.add(target.path);
    else if (target.query || !context.resolves(target.path)) unresolved.add(target.path);
  }
  for (const match of html.matchAll(attribute('img', 'src'))) {
    const target = internalPath(match[1], context.hosts);
    if (target?.path.startsWith(uploadPrefix)) { uploadImages++; uploads.add(target.path); }
  }
  return { unresolved: [...unresolved].sort(), uploads: [...uploads].sort(), uploadImages, internal };
}
