// Content quality gates for the planner: what must be reviewed before an imported document may be published.
// Pure functions over the converted body. Everything reported from here is names, counts and paths, never content.
import { htmlToText } from './sanitize';

/** Plain text below this length after sanitization is a near-empty body (a heading and little else). */
export const minBodyTextChars = 200;
/** Collections whose body is page content that a visitor reads (events and initiatives are summaries that may be short). */
export const bodyGatedCollections = ['posts', 'pages'] as const;

/** Flags an operator may clear for ONE document after reviewing it (see `applyReviews`): the flag becomes `<flag>-reviewed`. */
export const overridableFlags = ['divi-layout-review', 'empty-body', 'leftover-shortcode'] as const;
export const reviewedFlag = (flag: string) => `${flag}-reviewed`;

/**
 * WordPress shortcodes that survive conversion (`convertShortcodes` strips the ones it knows). Deliberately narrow so prose
 * such as "[sic]", "[1]" or "[citation needed]" never matches:
 *  - `[name key=value ...]` (at least one attribute) and `[name/]`-style self-closing forms with attributes;
 *  - a closing tag `[/name]`;
 *  - a bare `[name]` only when the name contains an underscore or hyphen (`[tt-event]`, `[my_plugin]`).
 */
const withAttribute = /\[\/?([a-z][a-z0-9]*(?:[_-][a-z0-9]+)*)\s+(?:[a-z_][\w-]*\s*=\s*(?:"[^"\]]*"|'[^'\]]*'|[^\s\]"']+)\s*)+\/?\]/gi;
const closing = /\[\/([a-z][a-z0-9]*(?:[_-][a-z0-9]+)*)\]/gi;
const bareCompound = /\[([a-z][a-z0-9]*(?:[_-][a-z0-9]+)+)\]/gi;

/** Distinct, lower-cased shortcode names found in text, sorted. */
export function leftoverShortcodes(text: string): string[] {
  const names = new Set<string>();
  for (const pattern of [withAttribute, closing, bareCompound]) {
    for (const match of text.matchAll(pattern)) names.add(match[1].toLowerCase());
  }
  return [...names].sort();
}

export const bodyText = (html: string) => htmlToText(html).replace(/\s+/g, ' ').trim();
export const isNearEmpty = (html: string) => bodyText(html).length < minBodyTextChars;

// --- operator review decisions ------------------------------------------------------------------

export const reviewKind = 'wp-import-review';
export type ReviewEntry = { ordinal: number; sourceHash: string; flags: string[] };
export type ReviewFile = { kind: typeof reviewKind; schemaVersion: 1; reviewed: ReviewEntry[] };

/** Validate an operator-supplied review file (ordinals and source hashes from the safe report; nothing else). */
export function parseReviewFile(input: unknown): ReviewFile {
  const fail = (): never => { throw new Error('Invalid review file.'); };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail();
  const file = input as Record<string, unknown>;
  if (file.kind !== reviewKind || file.schemaVersion !== 1 || !Array.isArray(file.reviewed) || file.reviewed.length > 5000) return fail();
  const seen = new Set<string>();
  const reviewed = file.reviewed.map((entry): ReviewEntry => {
    if (!entry || typeof entry !== 'object') return fail();
    const { ordinal, sourceHash, flags } = entry as Record<string, unknown>;
    if (!Number.isSafeInteger(ordinal) || (ordinal as number) < 1 || typeof sourceHash !== 'string' || !/^[0-9a-f]{64}$/.test(sourceHash)) return fail();
    if (!Array.isArray(flags) || !flags.length || !flags.every(flag => (overridableFlags as readonly string[]).includes(flag as string))) return fail();
    if (seen.has(`${ordinal}`)) return fail();
    seen.add(`${ordinal}`);
    return { ordinal: ordinal as number, sourceHash, flags: [...new Set(flags as string[])].sort() };
  });
  return { kind: reviewKind, schemaVersion: 1, reviewed };
}

/**
 * Replace each reviewed flag with its `-reviewed` form for a document whose ordinal AND source hash match an entry, so a
 * decision never survives a change to the source. Returns the new flags and whether a review applied.
 */
export function applyReviews(flags: string[], ordinal: number, sourceHash: string, reviews: ReviewFile | undefined): { flags: string[]; applied: string[] } {
  const entry = reviews?.reviewed.find(item => item.ordinal === ordinal && item.sourceHash === sourceHash);
  if (!entry) return { flags, applied: [] };
  const applied = flags.filter(flag => entry.flags.includes(flag));
  return { flags: [...new Set(flags.map(flag => applied.includes(flag) ? reviewedFlag(flag) : flag))].sort(), applied };
}
