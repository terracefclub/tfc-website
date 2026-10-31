// Pure helpers for the newsletter OCR job: TSV parsing, the output schema, and
// the plan of which pages still need work. Nothing here touches the engine or disk.

export const TOOL_NAME = 'newsletter-ocr';
// Bump when a change to the job (settings, text assembly) should invalidate every committed result.
export const TOOL_VERSION = '1.0.0';
export const SCHEMA_VERSION = 1;
export const OCR_LANGUAGE = 'eng';
export const OCR_PSM = 3;
export const OCR_OEM = 1;
// Tesseract binarisation methods tried on every page (0 Otsu, 1 adaptive Otsu, 2 Sauvola). Pale text over
// photographs or marbling is invisible to one method and clear to another, so each page keeps the best result.
export const OCR_THRESHOLDING = [0, 1, 2];
// A later method must beat the current best by this factor, so near-ties keep the plainer method.
const SWITCH_MARGIN = 1.05;
// Words at or above this confidence are "solid". Counting them, not all words, stops a noisy binarisation
// from winning with hundreds of low-confidence guesses.
export const SOLID_CONFIDENCE = 70;

export type OcrTool = { name: string; version: string; engine: string; language: string; psm: number; oem: number; thresholding: number[] };
export type OcrPage = { page: number; file: string; sourceSha256: string; thresholding: number; confidence: number | null; words: number; solidWords: number; text: string };
export type OcrFile = { schemaVersion: number; issueSlug: string; sourcePdfSha256: string; tool: OcrTool; pages: OcrPage[] };
export type SourcePage = { issueSlug: string; page: number; file: string; sha256: string; sourcePdfSha256: string };

export function currentTool(engine: string): OcrTool {
  return { name: TOOL_NAME, version: TOOL_VERSION, engine, language: OCR_LANGUAGE, psm: OCR_PSM, oem: OCR_OEM, thresholding: [...OCR_THRESHOLDING] };
}

export function sameTool(a: OcrTool, b: OcrTool): boolean {
  return a.name === b.name && a.version === b.version && a.engine === b.engine && a.language === b.language && a.psm === b.psm && a.oem === b.oem && a.thresholding.join() === b.thresholding.join();
}

/** "tesseract 5.5.3\n leptonica-1.87.0 ..." -> "tesseract 5.5.3" */
export function parseEngineVersion(output: string): string {
  const match = output.match(/^tesseract\s+(\S+)/m);
  if (!match) throw new Error('Unrecognised tesseract --version output');
  return `tesseract ${match[1]}`;
}

export type Reading = { method: number; text: string; confidence: number | null; words: number; solidWords: number };

/** Picks the reading with the most solid (confidence >= 70) words, preferring earlier methods on near-ties. */
export function chooseReading(readings: Reading[]): Reading {
  if (!readings.length) throw new Error('No readings to choose from');
  let best = readings[0]!;
  for (const reading of readings.slice(1)) if (reading.solidWords > best.solidWords * SWITCH_MARGIN) best = reading;
  return best;
}

/**
 * Turns Tesseract TSV (one row per layout element) into reading-order text and a
 * mean word confidence. Words with negative confidence are layout rows, not words.
 * Lines join with "\n"; paragraphs and blocks are separated by a blank line.
 */
export function parseTsv(tsv: string): { text: string; confidence: number | null; words: number; solidWords: number } {
  const lines = tsv.split(/\r?\n/);
  const header = lines.shift()?.split('\t');
  const column = (name: string) => header?.indexOf(name) ?? -1;
  const [level, block, par, line, conf, text] = ['level', 'block_num', 'par_num', 'line_num', 'conf', 'text'].map(column);
  if (header === undefined || [level, block, par, line, conf, text].some((index) => index < 0)) throw new Error('Unexpected tesseract TSV header');

  let total = 0;
  let words = 0;
  let solidWords = 0;
  const out: string[] = [];
  let previous = '';
  let previousBlockPar = '';
  for (const row of lines) {
    if (!row) continue;
    const cells = row.split('\t');
    if (cells[level] !== '5') continue;
    const word = (cells[text] ?? '').trim();
    const confidence = Number(cells[conf]);
    if (!word || !Number.isFinite(confidence) || confidence < 0) continue;
    total += confidence;
    words += 1;
    if (confidence >= SOLID_CONFIDENCE) solidWords += 1;
    const lineKey = `${cells[block]}.${cells[par]}.${cells[line]}`;
    const blockPar = `${cells[block]}.${cells[par]}`;
    if (!out.length) out.push(word);
    else if (lineKey === previous) out[out.length - 1] += ` ${word}`;
    else out.push(blockPar === previousBlockPar ? `\n${word}` : `\n\n${word}`);
    previous = lineKey;
    previousBlockPar = blockPar;
  }
  return {
    text: out.join('').normalize('NFC'),
    confidence: words ? Math.round((total / words) * 10) / 10 : null,
    words,
    solidWords
  };
}

const SHA256 = /^[a-f0-9]{64}$/;

/** Returns a list of problems; empty means the object is a valid OCR file. */
export function validateOcrFile(value: unknown): string[] {
  const problems: string[] = [];
  const record = (candidate: unknown): candidate is Record<string, unknown> => typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate);
  if (!record(value)) return ['file is not an object'];
  if (value.schemaVersion !== SCHEMA_VERSION) problems.push(`schemaVersion must be ${SCHEMA_VERSION}`);
  if (typeof value.issueSlug !== 'string' || !/^[a-z0-9-]+$/.test(value.issueSlug)) problems.push('issueSlug must be a slug');
  if (typeof value.sourcePdfSha256 !== 'string' || !SHA256.test(value.sourcePdfSha256)) problems.push('sourcePdfSha256 must be a sha256');
  const tool = value.tool;
  if (!record(tool)) problems.push('tool must be an object');
  else {
    for (const key of ['name', 'version', 'engine', 'language'] as const) if (typeof tool[key] !== 'string' || !tool[key]) problems.push(`tool.${key} must be a non-empty string`);
    for (const key of ['psm', 'oem'] as const) if (!Number.isInteger(tool[key])) problems.push(`tool.${key} must be an integer`);
    if (!Array.isArray(tool.thresholding) || !tool.thresholding.length || !tool.thresholding.every((method: unknown) => Number.isInteger(method))) problems.push('tool.thresholding must be a non-empty list of integers');
  }
  if (!Array.isArray(value.pages)) return [...problems, 'pages must be an array'];
  value.pages.forEach((page: unknown, index: number) => {
    const label = `pages[${index}]`;
    if (!record(page)) return void problems.push(`${label} must be an object`);
    if (page.page !== index + 1) problems.push(`${label}.page must be ${index + 1} (pages are consecutive from 1)`);
    if (typeof page.file !== 'string' || !/^[a-z0-9-]+\.webp$/.test(page.file)) problems.push(`${label}.file must be a webp file name`);
    if (typeof page.sourceSha256 !== 'string' || !SHA256.test(page.sourceSha256)) problems.push(`${label}.sourceSha256 must be a sha256`);
    if (!Number.isInteger(page.thresholding) || (record(tool) && Array.isArray(tool.thresholding) && !tool.thresholding.includes(page.thresholding))) problems.push(`${label}.thresholding must be one of tool.thresholding`);
    if (typeof page.text !== 'string') problems.push(`${label}.text must be a string`);
    if (!Number.isInteger(page.words) || (page.words as number) < 0) problems.push(`${label}.words must be a non-negative integer`);
    if (!Number.isInteger(page.solidWords) || (page.solidWords as number) < 0 || (page.solidWords as number) > (page.words as number)) problems.push(`${label}.solidWords must be an integer between 0 and words`);
    const c = page.confidence;
    if (!(c === null || (typeof c === 'number' && c >= 0 && c <= 100))) problems.push(`${label}.confidence must be null or 0-100`);
    if ((page.words === 0) !== (c === null)) problems.push(`${label}.confidence must be null exactly when words is 0`);
    if (page.words === 0 && page.text !== '') problems.push(`${label}.text must be empty when words is 0`);
  });
  return problems;
}

export type PagePlan = { source: SourcePage; action: 'process' | 'skip' };
export type IssuePlan = { issueSlug: string; sourcePdfSha256: string; pages: PagePlan[]; removed: number };

/**
 * Decides, per page, whether OCR must run. A page is skipped only when the existing
 * file was produced by the same tool/engine settings and recorded the same image hash.
 */
export function planIssue(sources: SourcePage[], existing: OcrFile | undefined, tool: OcrTool, force = false): IssuePlan {
  const ordered = [...sources].sort((a, b) => a.page - b.page);
  const usable = existing && validateOcrFile(existing).length === 0 && sameTool(existing.tool, tool) ? existing : undefined;
  const previous = new Map((usable?.pages ?? []).map((entry) => [entry.file, entry]));
  const pages: PagePlan[] = ordered.map((source) => {
    const entry = previous.get(source.file);
    const unchanged = !force && entry && entry.sourceSha256 === source.sha256 && entry.page === source.page;
    return { source, action: unchanged ? 'skip' : 'process' };
  });
  const kept = new Set(ordered.map((source) => source.file));
  return {
    issueSlug: ordered[0]?.issueSlug ?? '',
    sourcePdfSha256: ordered[0]?.sourcePdfSha256 ?? '',
    pages,
    removed: usable ? usable.pages.filter((entry) => !kept.has(entry.file)).length : 0
  };
}

/** Deterministic serialisation: fixed key order, two-space indent, trailing newline. */
export function serialiseOcrFile(file: OcrFile): string {
  const { schemaVersion, issueSlug, sourcePdfSha256, tool, pages } = file;
  const ordered: OcrFile = {
    schemaVersion, issueSlug, sourcePdfSha256,
    tool: { name: tool.name, version: tool.version, engine: tool.engine, language: tool.language, psm: tool.psm, oem: tool.oem, thresholding: [...tool.thresholding] },
    pages: pages.map(({ page, file: name, sourceSha256, thresholding, confidence, words, solidWords, text }) => ({ page, file: name, sourceSha256, thresholding, confidence, words, solidWords, text }))
  };
  return JSON.stringify(ordered, null, 2) + '\n';
}
