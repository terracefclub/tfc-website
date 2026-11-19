// WXR records -> import plan. Pure and deterministic: the same XML always yields the same
// plan (no clocks, no randomness, no I/O, no network). The strict bounded parse is the
// preflight's (`readWxr`); this module only maps what it returns.
import { readWxr, type WxrRecord } from '../wxr-preflight';
import { blockingFlags, canonicalJson, collections, destinationFor, hashOf, isReservedSource, planHash, planKind, planSchemaVersion, publicMediaRequired, redirectPath, servedInPlace, type Plan, type PlanCollection, type PlanDoc, type PlanRedirect, type Unmapped } from './plan-schema';
import { convertBody, decodeEntities, excerptText, htmlToText, mergeFindings, sanitizeHtml, type Findings } from './sanitize';
import { noExtensions, type ExtensionHooks } from './zip-hooks';
import { appExactRoutes } from '../../src/lib/route-manifest';
import { oldSiteHosts } from '../../src/lib/site-routes';
import { applyReviews, bodyGatedCollections, isNearEmpty, leftoverShortcodes, minBodyTextChars, type ReviewFile } from './content-gates';
import { auditLinks, type DocLinks } from './links';

export const metaKeys = new Set([
  '_EventStartDate', '_EventEndDate', '_EventStartDateUTC', '_EventEndDateUTC', '_EventTimezone', '_EventAllDay', '_EventVenueID', '_EventOrganizerID',
  '_VenueAddress', '_VenueCity', '_VenueState', '_VenueZip', '_VenueCountry',
  '_thumbnail_id', '_wp_attached_file', '_wp_attachment_metadata', '_wp_attachment_image_alt',
  '_et_pb_use_builder', '_yoast_wpseo_title', '_yoast_wpseo_metadesc',
]);

const rasterMimes = ['image/jpeg', 'image/png', 'image/webp'];
const mimeByExtension: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', pdf: 'application/pdf',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', mp3: 'audio/mpeg', mp4: 'video/mp4',
};

// --- small helpers -----------------------------------------------------------------------------

const clean = (raw: string, max: number) => htmlToText(sanitizeHtml(decodeEntities(raw)).html).replace(/\s+/g, ' ').trim().slice(0, max);

function slugify(value: string): string {
  let text = value;
  try { text = decodeURIComponent(value); } catch { /* keep raw */ }
  return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120).replace(/-+$/, '');
}

type Wall = { y: number; m: number; d: number; h: number; i: number; s: number };
/** Parse a WordPress `YYYY-MM-DD HH:MM:SS` value; zero dates and impossible dates are null. */
function wall(value: string | undefined): Wall | null {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  const [y, m, d, h, i, s] = match.slice(1).map(Number);
  if (y < 1970) return null;
  const date = new Date(Date.UTC(y, m - 1, d, h, i, s));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d && date.getUTCHours() === h ? { y, m, d, h, i, s } : null;
}
const wallMs = (w: Wall) => Date.UTC(w.y, w.m - 1, w.d, w.h, w.i, w.s);
const utcIso = (value: string | undefined) => { const w = wall(value); return w ? new Date(wallMs(w)).toISOString() : null; };

function zoneOffsetMs(instant: number, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find(part => part.type === type)!.value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - Math.floor(instant / 1000) * 1000;
}
/** Convert a wall-clock time in an IANA zone to a UTC instant (ms). */
export function zonedToUtc(w: Wall, zone: string): number {
  const guess = wallMs(w);
  const first = guess - zoneOffsetMs(guess, zone);
  return guess - zoneOffsetMs(first, zone);
}
export type ZoneKind = { kind: 'iana'; zone: string } | { kind: 'fixed'; minutes: number } | { kind: 'unknown' } | { kind: 'missing' };
export function classifyZone(value: string | undefined): ZoneKind {
  if (!value) return { kind: 'missing' };
  const fixed = /^UTC([+-])(0?\d|1[0-4])(?::([0-5]\d)|\.(25|5|75))?$/i.exec(value);
  if (fixed) {
    const fraction = fixed[3] ? Number(fixed[3]) : fixed[4] ? Number(`0.${fixed[4]}`) * 60 : 0;
    return { kind: 'fixed', minutes: (fixed[1] === '-' ? -1 : 1) * (Number(fixed[2]) * 60 + fraction) };
  }
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }); return { kind: 'iana', zone: value }; } catch { return { kind: 'unknown' }; }
}

function serializedSize(meta: string | undefined): { width?: number; height?: number } {
  const match = /s:5:"width";i:(\d{1,5});s:6:"height";i:(\d{1,5});/.exec(meta ?? '');
  return match ? { width: Number(match[1]), height: Number(match[2]) } : {};
}

type Draft = { ordinal: number; record: WxrRecord; collection: PlanCollection; data: Record<string, unknown>; refs: Record<string, number>; flags: Set<string>; slug?: string; findings: Findings; shortcodes?: string[] };
export type BuildOptions = { /** Operator review decisions (see content-gates.ts); a flag is cleared only for a document whose ordinal and source hash match. */ reviews?: ReviewFile };

// --- source path / redirect -------------------------------------------------------------------

export function sourcePathOf(link: string, hosts: ReadonlySet<string>): { path: string } | { reason: string } {
  let url: URL;
  try { url = new URL(link); } catch { return { reason: 'no-valid-source-url' }; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return { reason: 'no-valid-source-url' };
  if (!hosts.has(url.hostname)) return { reason: 'foreign-origin' };
  if (url.search || url.hash) return { reason: 'query-or-fragment-route' };
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/$/, '') : url.pathname;
  if (path === '/') return { reason: 'site-root' };
  if (!redirectPath.test(path) || path.length > 500) return { reason: 'unrepresentable-path' };
  return { path };
}

// --- the planner ------------------------------------------------------------------------------

export function buildPlan(xml: string, hooks: ExtensionHooks = noExtensions, options: BuildOptions = {}): Plan {
  const read = readWxr(xml, metaKeys);
  const { records, authors, safeHosts } = read;
  const byId = new Map<number, WxrRecord>();
  for (const record of records) if (record.id && !record.duplicateId) byId.set(record.id, record);
  const unmapped: Unmapped[] = [];
  const skip = (record: WxrRecord, reason: string, scope: Unmapped['scope'] = 'record') => unmapped.push({ ordinal: record.ordinal, sourceType: record.type, sourceStatus: record.status, scope, reason });
  const sourceHashOf = (record: WxrRecord) => hashOf({
    type: record.type, status: record.status, protected: record.protected, parent: record.parent, title: record.title, slug: record.slug, link: record.link, guid: record.guid,
    date: record.date, dateGmt: record.dateGmt, excerpt: record.excerpt, body: record.body, attachmentUrl: record.attachmentUrl, menuOrder: record.menuOrder,
    terms: record.terms, meta: [...record.meta.entries()].sort(([a], [b]) => a < b ? -1 : 1),
  });

  const drafts: Draft[] = [];
  const pdfsByParent = new Map<number, WxrRecord[]>();
  const attachmentByUrl = new Map<string, WxrRecord>();
  const mappedMedia = new Set<number>();

  // 1. Attachments become reference-only media records.
  for (const record of records) {
    if (record.type !== 'attachment') continue;
    if (!record.id || record.duplicateId) { skip(record, 'invalid-or-duplicate-id'); continue; }
    if (['trash', 'auto-draft', 'other'].includes(record.status)) { skip(record, 'non-content-status'); continue; }
    let url: URL | null = null;
    try { url = new URL(record.attachmentUrl); } catch { /* handled below */ }
    if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || record.attachmentUrl.length > 2000) { skip(record, 'attachment-url-missing-or-unsafe'); continue; }
    const extension = /\.([a-z0-9]{1,5})$/i.exec(url.pathname)?.[1]?.toLowerCase() ?? '';
    const mimeType = mimeByExtension[extension];
    const flags = new Set<string>();
    if (!mimeType) flags.add('mime-unknown');
    const altMeta = clean(record.meta.get('_wp_attachment_image_alt') ?? '', 300);
    const fallback = clean(record.title, 300) || decodeURIComponent(url.pathname.split('/').at(-1) || 'attachment').slice(0, 300);
    if (!altMeta) flags.add('alt-missing');
    if (!record.parent || !byId.has(record.parent)) flags.add('attachment-without-parent');
    const size = serializedSize(record.meta.get('_wp_attachment_metadata'));
    drafts.push({
      ordinal: record.ordinal, record, collection: 'media', refs: {}, flags, findings: {},
      data: {
        wpId: record.id, wpGuid: record.guid.slice(0, 600) || undefined, wpStatus: record.status, wpPasswordProtected: record.protected,
        alt: altMeta || fallback || 'Imported media', caption: clean(record.excerpt, 500) || undefined, public: false, mimeType: mimeType ?? 'application/octet-stream',
        width: size.width, height: size.height, sourceUrl: record.attachmentUrl, sourceFile: (record.meta.get('_wp_attached_file') ?? '').slice(0, 500) || undefined,
      },
    });
    mappedMedia.add(record.id);
    attachmentByUrl.set(url.origin + url.pathname, record);
    if (mimeType === 'application/pdf' && record.parent) pdfsByParent.set(record.parent, [...(pdfsByParent.get(record.parent) ?? []), record]);
  }
  const mediaMime = (id: number) => { const m = drafts.find(draft => draft.collection === 'media' && draft.record.id === id); return m ? String(m.data.mimeType) : null; };

  // 2. Content records.
  for (const record of records) {
    if (record.type === 'attachment') continue;
    if (!record.id || record.duplicateId) { skip(record, 'invalid-or-duplicate-id'); continue; }
    if (record.type === 'revision') { skip(record, 'revision'); continue; }
    if (record.status === 'trash') { skip(record, 'trashed'); continue; }
    if (record.status === 'auto-draft') { skip(record, 'auto-draft'); continue; }
    if (record.type === 'nav_menu_item') { skip(record, 'menus-need-database-backup-or-review'); continue; }
    if (record.type === 'et_pb_layout') { skip(record, 'divi-layout-library-not-imported'); continue; }
    if (record.type === 'custom_css' || record.type === 'wp_global_styles') { skip(record, 'theme-styles-not-imported'); continue; }
    if (record.type === 'tribe_venue' || record.type === 'tribe_organizer') { skip(record, 'embedded-in-events-not-standalone'); continue; }
    if (record.type === 'other') { skip(record, 'unknown-post-type'); continue; }
    if (record.status === 'other') { skip(record, 'unknown-status'); continue; }
    const flags = new Set<string>();
    const refs: Record<string, number> = {};
    const title = clean(record.title, 300) || (flags.add('title-missing'), `Untitled WordPress item ${record.id}`);
    const converted = convertBody(record.body);
    if (converted.unsafe) flags.add('unsafe-html-stripped');
    if (converted.findings['builder-code']) flags.add('builder-code-dropped');
    if (converted.findings['form-shortcode-dropped']) flags.add('form-shortcode-dropped');
    if (converted.findings['plugin-shortcode-dropped']) flags.add('plugin-shortcode-dropped');
    if (record.meta.get('_et_pb_use_builder') === 'on') flags.add('divi-layout-review');
    const common = { wpId: record.id, wpGuid: record.guid.slice(0, 600) || undefined, wpStatus: record.status, wpPasswordProtected: record.protected, wpReviewFlags: undefined as string[] | undefined };
    const thumbnail = Number(record.meta.get('_thumbnail_id'));
    const thumbnailId = Number.isSafeInteger(thumbnail) && thumbnail > 0 ? thumbnail : null;
    const summary = clean(record.excerpt, 1000) || excerptText(converted.html) || title;
    const publishedAt = utcIso(record.dateGmt);
    const termNames = (domain: string) => record.terms.filter(term => term.domain === domain && term.nicename).map(term => term.nicename.slice(0, 100)).slice(0, 50);
    const base: Pick<Draft, 'ordinal' | 'record' | 'flags' | 'refs' | 'findings' | 'shortcodes'> = { ordinal: record.ordinal, record, flags, refs, findings: converted.findings };
    // Shortcodes the converter did not know survive as bracketed text; they would show on the page as raw markup.
    const noteShortcodes = (target: typeof base) => { const names = leftoverShortcodes(htmlToText(converted.html)); if (names.length) { target.flags.add('leftover-shortcode'); target.shortcodes = names; } };

    if (record.type === 'tribe_events') {
      const result = mapEvent(record, byId, flags);
      if ('reason' in result) { skip(record, result.reason); continue; }
      if (thumbnailId) {
        if (!mappedMedia.has(thumbnailId)) flags.add('featured-media-unresolved');
        else if (!rasterMimes.includes(mediaMime(thumbnailId) ?? '')) flags.add('cover-not-raster');
        else refs.coverImage = thumbnailId;
      }
      noteShortcodes(base);
      drafts.push({ ...base, collection: 'events', data: { ...common, title, summary, ...result.fields, body: htmlToText(converted.html) || undefined } });
    } else if (record.type === 'project') {
      if (thumbnailId) { if (mappedMedia.has(thumbnailId)) refs.coverImage = thumbnailId; else flags.add('featured-media-unresolved'); }
      noteShortcodes(base);
      drafts.push({ ...base, collection: 'initiatives', data: { ...common, title, summary, body: htmlToText(converted.html) || undefined } });
    } else if (record.type === 'post' || record.type === 'page') {
      const name = record.terms.filter(term => ['category', 'post_tag'].includes(term.domain)).map(term => term.nicename).join(' ');
      const nameEvidence = record.type === 'post' && /newsletter/i.test(`${record.title} ${name}`);
      const linkedPdfs = new Set<number>((pdfsByParent.get(record.id) ?? []).map(item => item.id!));
      for (const match of record.body.matchAll(/\bhref\s*=\s*["']([^"']+\.pdf)["']/gi)) {
        try { const url = new URL(match[1], read.siteOrigin ?? undefined); const found = attachmentByUrl.get(url.origin + url.pathname); if (found?.id) linkedPdfs.add(found.id); } catch { /* ignore */ }
      }
      if (nameEvidence && !linkedPdfs.size) flags.add('newsletter-without-pdf-evidence');
      if (nameEvidence && linkedPdfs.size) {
        // The plan only types a post as a newsletter when both its name and a PDF agree.
        if (!publishedAt) { skip(record, 'newsletter-missing-issue-date'); continue; }
        refs.issuePdf = [...linkedPdfs].sort((a, b) => a - b)[0];
        if (thumbnailId && mappedMedia.has(thumbnailId) && rasterMimes.includes(mediaMime(thumbnailId) ?? '')) refs.coverImage = thumbnailId;
        drafts.push({ ...base, collection: 'newsletters', data: { ...common, title, issueDate: publishedAt, summary } });
        continue;
      }
      if (thumbnailId) { if (mappedMedia.has(thumbnailId)) refs.featuredMedia = thumbnailId; else flags.add('featured-media-unresolved'); }
      if (!publishedAt) flags.add('date-missing');
      if ((bodyGatedCollections as readonly string[]).includes(record.type === 'post' ? 'posts' : 'pages') && isNearEmpty(converted.html)) flags.add('empty-body');
      noteShortcodes(base);
      drafts.push({
        ...base, collection: record.type === 'post' ? 'posts' : 'pages',
        data: {
          ...common, title, excerpt: clean(record.excerpt, 2000) || undefined, bodyHtml: converted.html || undefined,
          authorName: record.creator && authors[record.creator] ? clean(authors[record.creator], 200) : undefined, publishedAt: publishedAt ?? undefined,
          categories: termNames('category'), tags: termNames('post_tag'),
          seoTitle: clean(record.meta.get('_yoast_wpseo_title') ?? '', 300) || undefined, seoDescription: clean(record.meta.get('_yoast_wpseo_metadesc') ?? '', 600) || undefined,
          ...(record.type === 'page' ? { parentWpId: record.parent ?? undefined, menuOrder: record.menuOrder } : {}),
        },
      });
    }
  }

  // 3. Slugs: deterministic and unique per collection. Lowest WordPress ID keeps the plain slug.
  const taken = new Map<string, Set<string>>();
  const bySlugOrder = [...drafts].filter(draft => draft.collection !== 'media').sort((a, b) => a.record.id! - b.record.id!);
  for (const draft of bySlugOrder) {
    const used = taken.get(draft.collection) ?? new Set<string>();
    taken.set(draft.collection, used);
    const id = draft.record.id!;
    let slug = slugify(draft.record.slug) || slugify(String(draft.data.title)) || `${draft.record.type}-${id}`;
    if (!slug) slug = `item-${id}`;
    if (used.has(slug)) { slug = `${slug}-${id}`; draft.flags.add('slug-deduplicated'); }
    used.add(slug);
    draft.slug = slug;
    draft.data.slug = slug;
  }

  // 4. Finish documents: flags, operator reviews, publication eligibility, hashes. Redirects are built next from the
  //    finished documents; link audit flags (non-blocking) then re-finish the affected documents.
  let reviewsApplied = 0;
  const finish = (draft: Draft, extra: string[] = []): PlanDoc => {
    const { record, collection } = draft;
    const flags = new Set(draft.flags);
    for (const flag of extra) flags.add(flag);
    if (publicMediaRequired.includes(collection) && Object.keys(draft.refs).length) flags.add('media-bytes-pending');
    const sourceHash = sourceHashOf(record);
    const reviewed = applyReviews([...flags].sort(), draft.ordinal, sourceHash, options.reviews);
    if (reviewed.applied.length && !extra.length) reviewsApplied++;
    const sortedFlags = reviewed.flags;
    const data = JSON.parse(JSON.stringify({ ...draft.data, wpReviewFlags: sortedFlags.length ? sortedFlags : undefined })) as Record<string, unknown>; // drops undefined, fixes key order for hashing
    const publishEligible = collection !== 'media' && record.status === 'publish' && !record.protected && !sortedFlags.some(flag => (blockingFlags as readonly string[]).includes(flag));
    return {
      ordinal: draft.ordinal, wpId: record.id!, collection, sourceType: record.type, sourceStatus: record.status,
      desiredStatus: collection === 'media' ? 'inherit' : publishEligible ? 'published' : 'draft', publishEligible,
      data, refs: draft.refs, flags: sortedFlags, sourceHash, targetHash: hashOf({ data, refs: draft.refs }),
    };
  };
  const draftOf = new Map<string, Draft>(drafts.map(draft => [`${draft.collection}:${draft.record.id}`, draft]));
  const docs: PlanDoc[] = drafts.map(draft => finish(draft));

  // 5. Redirects for every public (publish, unprotected) mapped content item.
  const redirects: PlanRedirect[] = [];
  const claimed = new Map<string, number>();
  const hosts = safeHosts as ReadonlySet<string>;
  for (const doc of docs) {
    if (doc.collection === 'media' || doc.sourceStatus !== 'publish' || doc.data.wpPasswordProtected === true) continue;
    const record = byId.get(doc.wpId)!;
    const source = sourcePathOf(record.link, hosts);
    if ('reason' in source) { skip(record, `redirect-${source.reason}`, 'redirect'); continue; }
    if (claimed.has(source.path)) { skip(record, 'redirect-duplicate-source-path', 'redirect'); continue; }
    const inPlace = doc.collection === 'pages' && (servedInPlace as readonly string[]).includes(source.path);
    const destination = inPlace ? source.path : destinationFor(doc.collection, String(doc.data.slug));
    if (!inPlace && isReservedSource(source.path)) { skip(record, 'redirect-reserved-route', 'redirect'); continue; }
    if (!inPlace && destination === source.path) { skip(record, 'redirect-source-equals-destination', 'redirect'); continue; }
    claimed.set(source.path, doc.wpId);
    redirects.push({ ordinal: doc.ordinal, wpId: doc.wpId, collection: doc.collection, sourcePath: source.path, destination, mode: inPlace ? 'served-in-place' : 'redirect' });
  }

  // 6. Link audit (paths only). A link resolves when the new site would answer it once the plan is applied with --publish: an
  //    app route, a served-in-place page, or the redirect source / new path of a document that is publish-eligible. A link to a
  //    document that stays a draft is reported too: it would 404 until an editor publishes that document.
  const live = new Map(docs.map(doc => [doc.wpId, doc.publishEligible]));
  const answered = new Set<string>([
    ...appExactRoutes, ...servedInPlace,
    ...redirects.filter(item => item.mode === 'served-in-place' || live.get(item.wpId)).map(item => item.sourcePath),
    ...docs.filter(doc => doc.collection !== 'media' && doc.publishEligible).map(doc => destinationFor(doc.collection as Exclude<PlanCollection, 'media'>, String(doc.data.slug ?? ''))),
  ].map(path => path.toLowerCase()));
  const linkContext = { hosts: new Set<string>([...hosts, ...oldSiteHosts]) as ReadonlySet<string>, resolves: (path: string) => answered.has(path.toLowerCase()) };
  const linkRows: { ordinal: number; unresolved: number; uploads: number; uploadImages: number }[] = [];
  const unresolvedTargets = new Set<string>(), uploadTargets = new Set<string>();
  for (let index = 0; index < docs.length; index++) {
    const doc = docs[index];
    if (doc.collection !== 'posts' && doc.collection !== 'pages') continue;
    const found: DocLinks = auditLinks(String(doc.data.bodyHtml ?? ''), linkContext);
    if (!found.unresolved.length && !found.uploads.length) continue;
    found.unresolved.forEach(path => unresolvedTargets.add(path)); found.uploads.forEach(path => uploadTargets.add(path));
    linkRows.push({ ordinal: doc.ordinal, unresolved: found.unresolved.length, uploads: found.uploads.length, uploadImages: found.uploadImages });
    docs[index] = finish(draftOf.get(`${doc.collection}:${doc.wpId}`)!, ['unresolved-links']);
  }
  const shortcodeCounts: Record<string, number> = {};
  for (const draft of drafts) for (const name of draft.shortcodes ?? []) shortcodeCounts[name] = (shortcodeCounts[name] ?? 0) + 1;
  const order = (collection: PlanCollection) => collections.indexOf(collection);
  docs.sort((a, b) => order(a.collection) - order(b.collection) || a.ordinal - b.ordinal);
  unmapped.sort((a, b) => a.ordinal - b.ordinal || (a.scope < b.scope ? -1 : 1));

  const publishCandidates = records.filter(record => ['post', 'page', 'tribe_events'].includes(record.type) && record.status === 'publish' && !record.protected);
  const count = (items: { key: string }[]) => items.reduce<Record<string, number>>((acc, item) => { acc[item.key] = (acc[item.key] ?? 0) + 1; return acc; }, {});
  const sorted = (value: Record<string, number>) => Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : 1));
  const sourceByType: Record<string, Record<string, number>> = {};
  for (const record of records) { const row = sourceByType[record.type] ??= { total: 0 }; row.total++; row[record.status] = (row[record.status] ?? 0) + 1; }
  const flagCounts = count(docs.flatMap(doc => doc.flags.map(key => ({ key }))));
  const body: Omit<Plan, 'planSha256'> = {
    schemaVersion: planSchemaVersion, kind: planKind, sourceSha256: read.sourceSha256, sourceBytes: read.sourceBytes,
    policy: { mediaBytes: 'not-downloaded-references-only', gravityEntries: 'excluded', defaultStatus: 'draft', authorAccounts: 'no-automatic-provisioning', networkFetches: 0 },
    docs, redirects, unmapped,
    summary: {
      sourceItems: records.length, publishStatusContentWithoutPassword: publishCandidates.length, bySourceType: Object.fromEntries(Object.entries(sourceByType).sort(([a], [b]) => a < b ? -1 : 1)),
      mappedByCollection: sorted(count(docs.map(doc => ({ key: doc.collection })))), mappedBySourceType: sorted(count(docs.map(doc => ({ key: doc.sourceType })))),
      publishEligibleDocuments: docs.filter(doc => doc.publishEligible).length, reviewFlags: sorted(flagCounts),
      unmappedByReason: sorted(count(unmapped.map(item => ({ key: `${item.scope}:${item.reason}` })))),
      redirects: { total: redirects.length, redirect: redirects.filter(item => item.mode === 'redirect').length, servedInPlace: redirects.filter(item => item.mode === 'served-in-place').length, publishCandidatesWithoutRedirect: publishCandidates.filter(record => !redirects.some(item => item.wpId === record.id)).length },
      extensions: hooks.status(),
      contentGates: { minBodyTextChars, leftoverShortcodeNames: sorted(shortcodeCounts), reviewsApplied, reviewsUnmatched: (options.reviews?.reviewed.length ?? 0) - reviewsApplied },
      links: { documentsWithFindings: linkRows.length, unresolvedInternalTargets: [...unresolvedTargets].sort(), oldSiteUploadLinks: [...uploadTargets].sort(), perDocument: linkRows },
    },
  };
  return { ...body, planSha256: planHash(body) };
}

function mapEvent(record: WxrRecord, byId: Map<number, WxrRecord>, flags: Set<string>): { fields: Record<string, unknown> } | { reason: string } {
  const get = (key: string) => record.meta.get(key);
  const startLocal = wall(get('_EventStartDate')), endLocal = wall(get('_EventEndDate'));
  const startUtc = wall(get('_EventStartDateUTC')), endUtc = wall(get('_EventEndDateUTC'));
  const zone = classifyZone(get('_EventTimezone'));
  let start: number | null = startUtc ? wallMs(startUtc) : null, end: number | null = endUtc ? wallMs(endUtc) : null;
  const convert = (local: Wall | null): number | null => {
    if (!local) return null;
    if (zone.kind === 'iana') return zonedToUtc(local, zone.zone);
    if (zone.kind === 'fixed') return wallMs(local) - zone.minutes * 60_000;
    return null;
  };
  if (start === null) { start = convert(startLocal); if (start !== null) flags.add('event-date-review'); }
  else if (zone.kind === 'iana' && startLocal && convert(startLocal) !== start) flags.add('event-date-review');
  if (start === null) return { reason: 'event-missing-or-unconvertible-start' };
  if (end === null) { end = convert(endLocal); if (end !== null) flags.add('event-date-review'); }
  if (zone.kind !== 'iana') flags.add('event-timezone-review');
  if (end !== null && end <= start) { end = null; flags.add('event-end-invalid'); }
  const venueId = Number(get('_EventVenueID')), organizerId = Number(get('_EventOrganizerID'));
  const venue = venueId > 0 ? byId.get(venueId) : undefined, organizer = organizerId > 0 ? byId.get(organizerId) : undefined;
  const venueName = venue?.type === 'tribe_venue' ? clean(venue.title, 300) : '';
  if (!venueName) flags.add('event-venue-missing');
  const address = venue ? ['_VenueAddress', '_VenueCity', '_VenueState', '_VenueZip', '_VenueCountry'].map(key => clean(venue.meta.get(key) ?? '', 120)).filter(Boolean).join(', ') : '';
  const cats = record.terms.filter(term => term.domain === 'tribe_events_cat').map(term => term.nicename).join(' ');
  const category = /music|concert|band|jazz|open-?mic|show/i.test(cats) ? 'music' : /food|dinner|brunch|lunch|beer|tap|menu|cook/i.test(cats) ? 'food' : 'community';
  if (!cats) flags.add('event-category-defaulted'); else if (category === 'community' && !/community/i.test(cats)) flags.add('event-category-defaulted');
  const iso = (ms: number) => new Date(ms).toISOString();
  return {
    fields: {
      startsAt: iso(start), endsAt: end === null ? undefined : iso(end), category, locationName: venueName || 'Location to be confirmed', locationAddress: address.slice(0, 500) || undefined,
      organizerName: organizer?.type === 'tribe_organizer' ? clean(organizer.title, 300) || undefined : undefined, timezone: get('_EventTimezone')?.slice(0, 64) || undefined,
      allDay: ['yes', 'true', '1'].includes((get('_EventAllDay') ?? '').toLowerCase()), startsAtLocal: get('_EventStartDate') || undefined, endsAtLocal: get('_EventEndDate') || undefined,
    },
  };
}

export { canonicalJson, mergeFindings };
