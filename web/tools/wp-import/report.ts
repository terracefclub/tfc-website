// Safe reconciliation report for the planner. It carries counts, hashes, ordinals, reason
// codes and the public redirect map only: no titles, bodies, author names, emails, WordPress
// IDs, GUIDs or metadata values. Redirect paths are included solely for published,
// unprotected items, whose URLs are already public. Leftover shortcode names and the paths of unresolved
// internal links and old-site upload links are listed (names and paths only, deduplicated).
import { preflight } from '../wxr-preflight';
import type { Plan } from './plan-schema';

export type ContentGatesSummary = { minBodyTextChars: number; leftoverShortcodeNames: Record<string, number>; reviewsApplied: number; reviewsUnmatched: number };
export type LinksSummary = { documentsWithFindings: number; unresolvedInternalTargets: string[]; oldSiteUploadLinks: string[]; perDocument: { ordinal: number; unresolved: number; uploads: number; uploadImages: number }[] };

export function dryRunReport(plan: Plan, xml: string) {
  const check = preflight(xml);
  const candidates = plan.summary.publishStatusContentWithoutPassword as number;
  return {
    schemaVersion: 1, kind: 'wp-import-dry-run-report', mode: 'dry-run',
    source: { sha256: plan.sourceSha256, bytes: plan.sourceBytes },
    planSha256: plan.planSha256,
    writes: { cms: 0, files: 0, network: 0, redirects: 0 },
    database: 'not-consulted-by-the-planner-run-the-cms-dry-run-for-created-updated-skipped',
    preflightReproduction: {
      itemCount: { import: plan.summary.sourceItems, preflight: check.itemCount, equal: plan.summary.sourceItems === check.itemCount },
      publishStatusContentWithoutPassword: { import: candidates, preflight: check.scope.publishStatusContentWithoutPassword, equal: candidates === check.scope.publishStatusContentWithoutPassword },
    },
    counts: {
      bySourceType: plan.summary.bySourceType, mappedByCollection: plan.summary.mappedByCollection, mappedBySourceType: plan.summary.mappedBySourceType,
      unmappedByReason: plan.summary.unmappedByReason, publishEligibleDocuments: plan.summary.publishEligibleDocuments, reviewFlags: plan.summary.reviewFlags,
      mappedDocuments: plan.docs.length, unmappedRecords: plan.unmapped.filter(item => item.scope === 'record').length, redirectGaps: plan.unmapped.filter(item => item.scope === 'redirect').length,
      redirects: plan.summary.redirects,
    },
    policy: { ...plan.policy, applyDefault: 'every document is created as a draft; publication needs the explicit --publish flag and an eligible document' },
    deferredToKinstaZip: plan.summary.extensions,
    // Content quality gates: a document with one of these flags is never published automatically (docs/wordpress-import.md).
    // Shortcode NAMES only (never their attributes or the surrounding text); link targets are public site paths.
    contentGates: plan.summary.contentGates as ContentGatesSummary,
    links: plan.summary.links as LinksSummary,
    documents: plan.docs.map(doc => ({
      ordinal: doc.ordinal, collection: doc.collection, sourceType: doc.sourceType, sourceStatus: doc.sourceStatus, desiredStatus: doc.desiredStatus,
      publishEligible: doc.publishEligible, flags: doc.flags, sourceHash: doc.sourceHash, targetHash: doc.targetHash,
    })),
    unmapped: plan.unmapped,
    redirects: plan.redirects.map(({ ordinal, collection, sourcePath, destination, mode }) => ({ ordinal, collection, sourcePath, destination, mode })),
  };
}
