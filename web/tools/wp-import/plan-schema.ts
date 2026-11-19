// Plan schema shared by the planner (web/tools/wp-import) and the applier (cms/tools/wp-import).
// Pure and dependency-free: no XML parser, no Payload. The applier re-validates every plan
// it is handed, including re-checking HTML with the sanitizer, so a hand-edited or
// corrupted plan file cannot smuggle unsafe markup or unknown fields into the CMS.
import { createHash } from 'node:crypto';
import { isSafeHtml } from './sanitize';

export const planKind = 'wp-import-plan';
export const planSchemaVersion = 1;

export const collections = ['media', 'events', 'newsletters', 'posts', 'pages', 'initiatives'] as const;
export type PlanCollection = typeof collections[number];

/** Provenance fields every imported collection carries (see cms/src/collections/shared.ts). */
export const wpFields = ['wpId', 'wpGuid', 'wpStatus', 'wpPasswordProtected', 'wpReviewFlags'] as const;
/** Fields stamped by the applier, never by the plan. */
export const applierFields = ['wpContentHash', 'wpAppliedHash', 'wpImportRun'] as const;

/** Managed (importer-owned) fields per collection, excluding relationships (see `refFields`). */
export const dataFields: Record<PlanCollection, readonly string[]> = {
  media: ['alt', 'caption', 'public', 'mimeType', 'width', 'height', 'sourceUrl', 'sourceFile'],
  events: ['slug', 'title', 'summary', 'startsAt', 'endsAt', 'category', 'locationName', 'locationAddress', 'organizerName', 'timezone', 'allDay', 'startsAtLocal', 'endsAtLocal', 'body'],
  newsletters: ['slug', 'title', 'issueDate', 'summary'],
  initiatives: ['slug', 'title', 'summary', 'body'],
  posts: ['slug', 'title', 'excerpt', 'bodyHtml', 'authorName', 'publishedAt', 'categories', 'tags', 'seoTitle', 'seoDescription'],
  pages: ['slug', 'title', 'excerpt', 'bodyHtml', 'authorName', 'publishedAt', 'categories', 'tags', 'seoTitle', 'seoDescription', 'parentWpId', 'menuOrder'],
};
/** Relationship fields per collection; each always points at a media record by WordPress ID. */
export const refFields: Record<PlanCollection, readonly string[]> = {
  media: [], events: ['coverImage'], newsletters: ['issuePdf', 'coverImage'], initiatives: ['coverImage'], posts: ['featuredMedia'], pages: ['featuredMedia'],
};
export const htmlFields = ['bodyHtml'] as const;
/** Collections whose publish hooks require public media; reference-only media can never satisfy them. */
export const publicMediaRequired: readonly PlanCollection[] = ['events', 'newsletters', 'initiatives'];

/** Public routes the new site serves for each collection. `{slug}` is replaced at apply time. */
export const routes: Record<Exclude<PlanCollection, 'media'>, string> = {
  events: '/events/{slug}', newsletters: '/newsletter/{slug}', initiatives: '/initiatives', posts: '/news/{slug}', pages: '/pages/{slug}',
};
/** Existing top-level routes. A WordPress page already living at one of these paths is served in place. */
export const servedInPlace = ['/about', '/contact', '/donate', '/merchandise', '/shows-archive', '/newsletter', '/events', '/initiatives'] as const;

/** Paths the new site already serves, or reserves, that a WordPress URL must never be redirected over. */
export const reservedSourcePrefix = /^\/(?:members|auth|preview|api|admin|_app|events|newsletter)(?:\/|$)/;
export const isReservedSource = (path: string) => reservedSourcePrefix.test(path) || (servedInPlace as readonly string[]).includes(path);

export const blockingFlags = ['unsafe-html-stripped', 'builder-code-dropped', 'event-date-review', 'event-timezone-review', 'event-venue-missing', 'event-end-invalid', 'form-shortcode-dropped', 'plugin-shortcode-dropped', 'media-bytes-pending'] as const;

export type PlanDoc = {
  ordinal: number; wpId: number; collection: PlanCollection; sourceType: string; sourceStatus: string;
  desiredStatus: 'draft' | 'published' | 'inherit'; publishEligible: boolean;
  data: Record<string, unknown>; refs: Record<string, number>; flags: string[];
  sourceHash: string; targetHash: string;
};
export type PlanRedirect = { ordinal: number; wpId: number; collection: Exclude<PlanCollection, 'media'>; sourcePath: string; destination: string; mode: 'redirect' | 'served-in-place' };
export type Unmapped = { ordinal: number; sourceType: string; sourceStatus: string; scope: 'record' | 'redirect'; reason: string };
export type Plan = {
  schemaVersion: typeof planSchemaVersion; kind: typeof planKind; sourceSha256: string; sourceBytes: number;
  policy: { mediaBytes: 'not-downloaded-references-only'; gravityEntries: 'excluded'; defaultStatus: 'draft'; authorAccounts: 'no-automatic-provisioning'; networkFetches: 0 };
  docs: PlanDoc[]; redirects: PlanRedirect[]; unmapped: Unmapped[];
  summary: Record<string, unknown>; planSha256: string;
};

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
}
export const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
export const hashOf = (value: unknown) => sha256(canonicalJson(value));
export const planHash = (plan: Omit<Plan, 'planSha256'>) => hashOf(plan);

export const destinationFor = (collection: Exclude<PlanCollection, 'media'>, slug: string) => routes[collection].replace('{slug}', slug);
/** Redirect source paths accepted by the Redirects collection. */
export const redirectPath = /^\/(?!\/)[a-zA-Z0-9/_-]*$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isoDate = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const httpUrl = (value: unknown) => { try { const url = new URL(String(value)); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; } };

function fail(reason: string): never { throw new Error(`Invalid import plan: ${reason}`); }
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isInt = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;

// Plain-text fields (title, summary, body, ...) are stored entity-decoded: they may legitimately contain `<`, `&` and
// quotes. Consumers MUST render them as text (never as HTML). Only `bodyHtml` is HTML, and it is allowlist-sanitized.
const stringFields: Record<string, number> = {
  alt: 300, caption: 500, mimeType: 100, sourceUrl: 2000, sourceFile: 500, slug: 160, title: 300, summary: 1000, locationName: 300, locationAddress: 500, organizerName: 300,
  timezone: 64, startsAtLocal: 32, endsAtLocal: 32, body: 60000, excerpt: 2000, bodyHtml: 200000, authorName: 200, seoTitle: 300, seoDescription: 600, wpGuid: 600, wpStatus: 20,
};

/** Validate an untrusted plan object and return it typed. Throws a fixed-prefix error, never echoing content. */
export function validatePlan(input: unknown): Plan {
  if (!isObject(input) || input.kind !== planKind || input.schemaVersion !== planSchemaVersion) return fail('unsupported kind or version');
  const plan = input as unknown as Plan;
  const { planSha256, ...rest } = plan;
  if (typeof planSha256 !== 'string' || planHash(rest) !== planSha256) fail('plan hash mismatch');
  if (!/^[0-9a-f]{64}$/.test(plan.sourceSha256) || !Array.isArray(plan.docs) || !Array.isArray(plan.redirects) || !Array.isArray(plan.unmapped)) fail('shape');
  if (plan.docs.length > 20000 || plan.redirects.length > 20000) fail('too many records');
  const seen = new Set<string>(), slugs = new Set<string>();
  for (const doc of plan.docs) {
    if (!isObject(doc) || !(collections as readonly string[]).includes(doc.collection) || !isInt(doc.wpId) || !isInt(doc.ordinal)) fail('document identity');
    if (!isObject(doc.data) || !isObject(doc.refs) || !Array.isArray(doc.flags) || !doc.flags.every(flag => typeof flag === 'string' && /^[a-z0-9-]{1,60}$/.test(flag))) fail('document body');
    const key = `${doc.collection}:${doc.wpId}`;
    if (seen.has(key)) fail('duplicate document identity');
    seen.add(key);
    if (!['draft', 'published', 'inherit'].includes(doc.desiredStatus) || typeof doc.publishEligible !== 'boolean') fail('status');
    if (typeof doc.sourceStatus !== 'string' || doc.data.wpStatus !== doc.sourceStatus) fail('status mismatch');
    if (canonicalJson(doc.data.wpReviewFlags ?? []) !== canonicalJson(doc.flags)) fail('review flags mismatch');
    // Publication is derived from source facts here, never trusted from the plan: only a publish-status, unprotected
    // document with no blocking review flag can be published. (The plan hash is an integrity check, not authenticity.)
    const eligible = doc.collection !== 'media' && doc.sourceStatus === 'publish' && doc.data.wpPasswordProtected !== true && !doc.flags.some(flag => (blockingFlags as readonly string[]).includes(flag));
    if (doc.publishEligible !== eligible || doc.desiredStatus !== (doc.collection === 'media' ? 'inherit' : eligible ? 'published' : 'draft')) fail('publication not supported by source');
    if (doc.collection === 'media' && (doc.data.public !== false)) fail('media must be non-public');
    if (doc.data.wpId !== doc.wpId) fail('wpId mismatch');
    const allowed = new Set<string>([...dataFields[doc.collection], ...wpFields]);
    for (const [name, value] of Object.entries(doc.data)) {
      if (!allowed.has(name)) fail('unknown field');
      if (value === null || value === undefined) continue;
      if (name in stringFields) {
        if (typeof value !== 'string' || value.length > stringFields[name]) fail('field type');
        if ((htmlFields as readonly string[]).includes(name) && !isSafeHtml(value)) fail('unsafe html');
      }
      if (name === 'slug') { if (!slugPattern.test(String(value))) fail('slug'); const id = `${doc.collection}/${value}`; if (slugs.has(id)) fail('duplicate slug'); slugs.add(id); }
      if (['startsAt', 'endsAt', 'issueDate', 'publishedAt'].includes(name) && !(typeof value === 'string' && isoDate.test(value) && Number.isFinite(Date.parse(value)))) fail('date');
      if (name === 'sourceUrl' && !httpUrl(value)) fail('url');
      if (['width', 'height', 'parentWpId'].includes(name) && !isInt(value)) fail('number');
      if (name === 'menuOrder' && !(Number.isSafeInteger(value) && Math.abs(value as number) < 1_000_000)) fail('number');
      if (name === 'category' && !['music', 'food', 'community'].includes(String(value))) fail('category');
      if (['startsAtLocal', 'endsAtLocal'].includes(name) && !/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(String(value))) fail('local date');
      if (name === 'wpReviewFlags' && !(Array.isArray(value) && value.length <= 40 && value.every(item => typeof item === 'string' && /^[a-z0-9-]{1,60}$/.test(item)))) fail('flags');
      if (['allDay', 'public', 'wpPasswordProtected'].includes(name) && typeof value !== 'boolean') fail('boolean');
      if (['categories', 'tags'].includes(name) && !(Array.isArray(value) && value.length <= 50 && value.every(item => typeof item === 'string' && item.length <= 100))) fail('terms');
    }
    for (const [name, target] of Object.entries(doc.refs)) {
      if (!refFields[doc.collection].includes(name) || !isInt(target)) fail('reference');
      if (!plan.docs.some(other => other.collection === 'media' && other.wpId === target)) fail('dangling reference');
    }
    if (doc.desiredStatus === 'published' && publicMediaRequired.includes(doc.collection) && Object.keys(doc.refs).length) fail('published item references reference-only media');
    if (doc.desiredStatus === 'published' && doc.flags.some(flag => (blockingFlags as readonly string[]).includes(flag))) fail('blocked publication');
    if (doc.desiredStatus === 'published' && doc.data.wpPasswordProtected === true) fail('password-protected publication');
    if (!/^[0-9a-f]{64}$/.test(doc.sourceHash) || doc.targetHash !== hashOf({ data: doc.data, refs: doc.refs })) fail('document hash');
  }
  const paths = new Set<string>();
  for (const redirect of plan.redirects) {
    if (!isObject(redirect) || typeof redirect.sourcePath !== 'string' || !redirectPath.test(redirect.sourcePath) || redirect.sourcePath.length > 500 || redirect.sourcePath === '/' || !['redirect', 'served-in-place'].includes(redirect.mode)) fail('redirect');
    const target = plan.docs.find(doc => doc.collection === redirect.collection && doc.wpId === redirect.wpId && doc.sourceStatus === 'publish' && doc.data.wpPasswordProtected !== true);
    if (!(redirect.collection in routes) || !target) fail('redirect target');
    if (redirect.mode === 'redirect') {
      if (redirect.destination !== destinationFor(redirect.collection, String(target!.data.slug)) || redirect.destination === redirect.sourcePath || isReservedSource(redirect.sourcePath)) fail('redirect destination');
    } else if (redirect.collection !== 'pages' || redirect.destination !== redirect.sourcePath || !(servedInPlace as readonly string[]).includes(redirect.sourcePath)) fail('redirect destination');
    if (paths.has(redirect.sourcePath)) fail('duplicate redirect');
    paths.add(redirect.sourcePath);
  }
  return plan;
}

/**
 * Resolve an old site URL (absolute or path) against the plan the way the redirect layer will.
 * Returns the new path, or null when nothing maps it. Trailing slashes are ignored; any query
 * or fragment makes a URL unresolvable (queries are never dropped to force a match).
 */
export function resolveOldUrl(plan: Pick<Plan, 'docs' | 'redirects'>, oldUrl: string): { destination: string; mode: PlanRedirect['mode'] } | null {
  let path: string;
  try {
    const url = new URL(oldUrl, 'https://placeholder.invalid');
    if (url.search || url.hash) return null;
    path = url.pathname.length > 1 ? url.pathname.replace(/\/$/, '') : url.pathname;
  } catch { return null; }
  const redirect = plan.redirects.find(entry => entry.sourcePath === path);
  if (!redirect) return null;
  const doc = plan.docs.find(entry => entry.collection === redirect.collection && entry.wpId === redirect.wpId);
  if (!doc) return null;
  if (redirect.mode === 'served-in-place') return (servedInPlace as readonly string[]).includes(path) && redirect.destination === path ? { destination: path, mode: redirect.mode } : null;
  const destination = destinationFor(redirect.collection, String(doc.data.slug));
  return redirect.destination === destination ? { destination, mode: redirect.mode } : null;
}
