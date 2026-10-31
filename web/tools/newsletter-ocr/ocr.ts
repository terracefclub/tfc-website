#!/usr/bin/env bun
// Repeatable OCR job for the newsletter page images. See README.md in this directory.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { engineVersion, recognise } from './engine';
import {
  chooseReading, currentTool, planIssue, serialiseOcrFile, validateOcrFile,
  OCR_LANGUAGE, OCR_OEM, OCR_PSM, OCR_THRESHOLDING, SCHEMA_VERSION,
  type IssuePlan, type OcrFile, type OcrPage, type Reading, type SourcePage
} from './lib';

const webRoot = resolve(import.meta.dir, '../..');
const usage = `Usage: bun run ocr:newsletters [options]

  --check          Verify committed results cover every page image with a matching hash. Needs no OCR engine.
  --force          Re-run OCR for every page, ignoring committed results.
  --issue <slug>   Only handle one newsletter (repeatable).
  --jobs <n>       Parallel tesseract processes (default: min(4, CPU cores)).
  --out <dir>      Write results here instead of src/lib/archive/ocr (useful for timing trials).
  --help           Show this text.
`;

const { values } = parseArgs({
  options: {
    check: { type: 'boolean', default: false }, force: { type: 'boolean', default: false },
    issue: { type: 'string', multiple: true }, jobs: { type: 'string' }, out: { type: 'string' }, help: { type: 'boolean', default: false }
  },
  strict: true
});
if (values.help) { console.log(usage); process.exit(0); }

const pagesDir = join(webRoot, 'static/archive/pages');
const outDir = resolve(values.out ?? join(webRoot, 'src/lib/archive/ocr'));
const jobs = Math.max(1, Number(values.jobs ?? Math.min(4, navigator.hardwareConcurrency ?? 2)) | 0);

type ManifestEntry = { issueSlug: string; page: number; src: string; sha256: string; sourcePdfSha256: string };
const manifest = JSON.parse(readFileSync(join(pagesDir, 'manifest.json'), 'utf8')) as ManifestEntry[];
const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

function sourcesByIssue(): Map<string, SourcePage[]> {
  const issues = new Map<string, SourcePage[]>();
  for (const entry of manifest) {
    if (values.issue?.length && !values.issue.includes(entry.issueSlug)) continue;
    const file = basename(entry.src);
    const actual = sha256(join(pagesDir, file));
    if (actual !== entry.sha256) throw new Error(`${file}: image hash ${actual} does not match static/archive/pages/manifest.json; regenerate the manifest first`);
    const list = issues.get(entry.issueSlug) ?? [];
    list.push({ issueSlug: entry.issueSlug, page: entry.page, file, sha256: actual, sourcePdfSha256: entry.sourcePdfSha256 });
    issues.set(entry.issueSlug, list);
  }
  if (values.issue?.length) for (const slug of values.issue) if (!issues.has(slug)) throw new Error(`Unknown newsletter "${slug}"`);
  return issues;
}

function readExisting(slug: string): OcrFile | undefined {
  const path = join(outDir, `${slug}.json`);
  if (!existsSync(path)) return undefined;
  try { return JSON.parse(readFileSync(path, 'utf8')) as OcrFile; } catch { return undefined; }
}

async function pool<T>(items: T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) await work(items[next++]!);
  }));
}

function writeIfChanged(slug: string, file: OcrFile): boolean {
  const path = join(outDir, `${slug}.json`);
  const body = serialiseOcrFile(file);
  if (existsSync(path) && readFileSync(path, 'utf8') === body) return false;
  mkdirSync(outDir, { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, body);
  renameSync(temporary, path);
  return true;
}

const issues = sourcesByIssue();

if (values.check) {
  // The recorded tool is accepted as-is: checking needs no engine. Only hashes and coverage are verified.
  let stale = 0;
  for (const [slug, sources] of issues) {
    const existing = readExisting(slug);
    const problems = existing ? validateOcrFile(existing) : ['missing result file'];
    const plan = planIssue(sources, existing && problems.length === 0 ? existing : undefined, existing?.tool ?? currentTool('unknown'));
    const missing = plan.pages.filter((page) => page.action === 'process').length;
    stale += missing + problems.length;
    console.log(`${slug}: ${plan.pages.length - missing}/${plan.pages.length} pages current${problems.length ? `; ${problems.join('; ')}` : ''}`);
  }
  console.log(stale ? `STALE: ${stale} problem(s). Run: direnv exec . bun run ocr:newsletters` : 'OK: every page image has a current text entry.');
  process.exit(stale ? 1 : 0);
}

const engine = await engineVersion();
const tool = currentTool(engine);
console.log(`${tool.name} ${tool.version} using ${engine} (${OCR_LANGUAGE}, psm ${OCR_PSM}, oem ${OCR_OEM}, thresholding ${OCR_THRESHOLDING.join('/')}), ${jobs} parallel job(s)`);

const started = performance.now();
let processed = 0, skipped = 0, removed = 0, failed = 0, written = 0;
for (const [slug, sources] of issues) {
  const existing = readExisting(slug);
  const plan: IssuePlan = planIssue(sources, existing, tool, values.force);
  const reusable = new Map((existing?.pages ?? []).map((entry) => [entry.file, entry]));
  const results = new Map<string, OcrPage>();
  for (const { source, action } of plan.pages) if (action === 'skip') results.set(source.file, reusable.get(source.file)!);
  const todo = plan.pages.filter((page) => page.action === 'process').map((page) => page.source);
  const issueStart = performance.now();
  // One task per page and method, so every core stays busy; the best reading per page is chosen afterwards.
  const readings = new Map<string, Reading[]>();
  const tasks = todo.flatMap((source) => OCR_THRESHOLDING.map((method) => ({ source, method })));
  await pool(tasks, jobs, async ({ source, method }) => {
    try {
      const reading = await recognise(join(pagesDir, source.file), method);
      readings.set(source.file, [...(readings.get(source.file) ?? []), reading]);
    } catch (error) {
      failed += 1;
      console.error(`  ${source.file} (method ${method}): ${(error as Error).message}`);
    }
  });
  let issueProcessed = 0;
  for (const source of todo) {
    const found = (readings.get(source.file) ?? []).sort((a, b) => a.method - b.method);
    // A page is accepted only when every method ran, so a transient failure cannot silently lower quality.
    if (found.length !== OCR_THRESHOLDING.length) continue;
    const best = chooseReading(found);
    results.set(source.file, { page: source.page, file: source.file, sourceSha256: source.sha256, thresholding: best.method, confidence: best.confidence, words: best.words, solidWords: best.solidWords, text: best.text });
    issueProcessed += 1;
  }
  processed += issueProcessed;
  skipped += plan.pages.length - todo.length;
  removed += plan.removed;
  const pages = plan.pages.flatMap(({ source }) => results.get(source.file) ?? []);
  // A failed page leaves a gap, so only complete runs produce a file; a partial run keeps the previous one.
  if (pages.length === plan.pages.length) {
    const file: OcrFile = { schemaVersion: SCHEMA_VERSION, issueSlug: slug, sourcePdfSha256: plan.sourcePdfSha256, tool, pages };
    if (writeIfChanged(slug, file)) written += 1;
  }
  console.log(`${slug}: ${issueProcessed} processed, ${plan.pages.length - todo.length} skipped, ${plan.removed} removed in ${((performance.now() - issueStart) / 1000).toFixed(1)}s`);
}
console.log(`Total: ${processed} processed, ${skipped} skipped, ${removed} removed, ${failed} failed; ${written} file(s) written to ${outDir} in ${((performance.now() - started) / 1000).toFixed(1)}s`);
process.exit(failed ? 1 : 0);
