// WordPress import planner. Reads a WXR export on standard input (like the preflight) and
// maps it; it never touches a database, the network or any path named inside the export.
//   bun web/tools/wp-import/import.ts dry-run --report /private/dir/wp-import-dryrun.safe.json < wordpress.xml
//   bun web/tools/wp-import/import.ts plan --out /private/dir/wp-import-plan.json [--report ...] < wordpress.xml
// `dry-run` writes only the safe reconciliation report. `plan` also writes the full private
// plan (titles and bodies!) that `cms/tools/wp-import.ts` applies. Both files are created
// exclusively with mode 0600 in an owner-only directory outside every Git checkout (a git-ignored directory inside
// a checkout is refused too; see private-output.ts).
// Both accept --reviewed /abs/review.json: the operator's per-document review decisions (docs/wordpress-import.md).
import { stdin } from 'node:process';
import { maxBytes } from '../wxr-preflight';
import { readFileSync } from 'node:fs';
import { OutputRefused, writePrivateJson } from '../private-output';
import { parseReviewFile } from './content-gates';
import { buildPlan } from './map';
import { dryRunReport } from './report';

const usage = 'Usage: import.ts <dry-run|plan> [--out /abs/plan.json] [--report /abs/report.json] [--reviewed /abs/review.json] < wordpress.xml';

export function parseArgs(argv: string[]) {
  const [command, ...rest] = argv;
  if (command !== 'dry-run' && command !== 'plan') throw new Error(usage);
  const options: { out?: string; report?: string; reviewed?: string } = {};
  for (let i = 0; i < rest.length; i += 2) {
    const flag = rest[i], value = rest[i + 1];
    if ((flag !== '--out' && flag !== '--report' && flag !== '--reviewed') || !value || options[flag.slice(2) as 'out' | 'report' | 'reviewed'] !== undefined) throw new Error(usage);
    options[flag.slice(2) as 'out' | 'report' | 'reviewed'] = value;
  }
  if (command === 'dry-run' && (options.out || !options.report)) throw new Error(usage);
  if (command === 'plan' && !options.out) throw new Error(usage);
  return { command, ...options };
}

if (import.meta.main) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (stdin.isTTY) throw new Error(usage);
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of stdin) { size += chunk.length; if (size > maxBytes) throw new Error('too large'); chunks.push(chunk); }
    const xml = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(Buffer.concat(chunks));
    const reviews = args.reviewed ? parseReviewFile(JSON.parse(readFileSync(args.reviewed, 'utf8'))) : undefined;
    const plan = buildPlan(xml, undefined, { reviews });
    const report = dryRunReport(plan, xml);
    if (args.report) writePrivateJson(args.report, JSON.stringify(report, null, 2) + '\n');
    if (args.out) writePrivateJson(args.out, JSON.stringify(plan) + '\n');
    // Aggregate counts only: never record contents, names, URLs or paths.
    console.log(JSON.stringify({
      mode: args.command, itemCount: report.preflightReproduction.itemCount, publishStatusContentWithoutPassword: report.preflightReproduction.publishStatusContentWithoutPassword,
      mappedDocuments: report.counts.mappedDocuments, mappedByCollection: report.counts.mappedByCollection, unmappedRecords: report.counts.unmappedRecords, redirectGaps: report.counts.redirectGaps,
      redirects: report.counts.redirects, publishEligibleDocuments: report.counts.publishEligibleDocuments, reviewFlags: report.counts.reviewFlags,
      leftoverShortcodeNames: report.contentGates.leftoverShortcodeNames, reviewsApplied: report.contentGates.reviewsApplied, reviewsUnmatched: report.contentGates.reviewsUnmatched,
      linkFindings: { documents: report.links.documentsWithFindings, unresolvedInternalTargets: report.links.unresolvedInternalTargets.length, oldSiteUploadLinks: report.links.oldSiteUploadLinks.length }, writes: report.writes, reportWritten: Boolean(args.report), planWritten: Boolean(args.out),
    }, null, 2));
  } catch (error) {
    console.error(error instanceof OutputRefused || error instanceof Error && (error.message.startsWith('Usage') || error.message.startsWith('Stale route manifest') || error.message.startsWith('Invalid review file')) ? error.message : 'Import planning failed. Supply a supported UTF-8 WXR export on standard input and new absolute JSON paths in a private directory outside Git checkouts. Nothing was written to the CMS.');
    process.exitCode = 1;
  }
}
