// Safe reconciliation report for the planner. It carries counts, hashes, ordinals, reason
// codes and the public redirect map only: no titles, bodies, author names, emails, WordPress
// IDs, GUIDs or metadata values. Redirect paths are included solely for published,
// unprotected items, whose URLs are already public.
import { preflight } from '../wxr-preflight';
import type { Plan } from './plan-schema';

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
    documents: plan.docs.map(doc => ({
      ordinal: doc.ordinal, collection: doc.collection, sourceType: doc.sourceType, sourceStatus: doc.sourceStatus, desiredStatus: doc.desiredStatus,
      publishEligible: doc.publishEligible, flags: doc.flags, sourceHash: doc.sourceHash, targetHash: doc.targetHash,
    })),
    unmapped: plan.unmapped,
    redirects: plan.redirects.map(({ ordinal, collection, sourcePath, destination, mode }) => ({ ordinal, collection, sourcePath, destination, mode })),
  };
}
