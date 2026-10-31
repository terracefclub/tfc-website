import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { engineVersion, recognise } from '../tools/newsletter-ocr/engine';
import {
  chooseReading, currentTool, parseEngineVersion, parseTsv, planIssue, serialiseOcrFile, validateOcrFile,
  type OcrFile, type SourcePage
} from '../tools/newsletter-ocr/lib';
import { archiveIssues } from '../src/lib/archive/content';
import pageManifest from '../static/archive/pages/manifest.json';

const root = join(import.meta.dir, '..');
const loadResult = (slug: string) => JSON.parse(readFileSync(join(root, 'src/lib/archive/ocr', `${slug}.json`), 'utf8')) as OcrFile;
const header = 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
const row = (level: number, block: number, par: number, line: number, word: number, conf: number, text: string) =>
  [level, 1, block, par, line, word, 0, 0, 10, 10, conf, text].join('\t');

describe('OCR output parsing', () => {
  test('rebuilds lines and paragraphs, averages word confidence, and ignores layout rows', () => {
    const tsv = [
      header,
      row(1, 0, 0, 0, 0, -1, ''), row(2, 1, 0, 0, 0, -1, ''), row(4, 1, 1, 1, 0, -1, ''),
      row(5, 1, 1, 1, 1, 90, 'Dear'), row(5, 1, 1, 1, 2, 80, 'Terrans,'),
      row(5, 1, 1, 2, 1, 70, 'Welcome'), row(5, 1, 1, 2, 2, -1, 'ghost'),
      row(5, 1, 2, 1, 1, 100, 'Next'), row(5, 2, 1, 1, 1, 60, '   '), row(5, 2, 1, 1, 2, 60, 'Block')
    ].join('\n');
    expect(parseTsv(tsv)).toEqual({ text: 'Dear Terrans,\nWelcome\n\nNext\n\nBlock', confidence: 80, words: 5, solidWords: 4 });
  });

  test('an empty page yields empty text and null confidence, and a bad header is rejected', () => {
    expect(parseTsv(header + '\n')).toEqual({ text: '', confidence: null, words: 0, solidWords: 0 });
    expect(() => parseTsv('a\tb\n1\t2')).toThrow('header');
  });

  test('reads the engine version line', () => {
    expect(parseEngineVersion('tesseract 5.5.3\n leptonica-1.87.0\n')).toBe('tesseract 5.5.3');
    expect(() => parseEngineVersion('not it')).toThrow();
  });
});

describe('OCR result schema and planning', () => {
  const tool = currentTool('tesseract 5.5.3');
  const hash = (seed: string) => createHash('sha256').update(seed).digest('hex');
  const sources: SourcePage[] = [1, 2, 3].map((page) => ({ issueSlug: 'demo-2020', page, file: `demo-2020-0${page}.webp`, sha256: hash('img' + page), sourcePdfSha256: hash('pdf') }));
  const complete = (): OcrFile => ({
    schemaVersion: 1, issueSlug: 'demo-2020', sourcePdfSha256: hash('pdf'), tool,
    pages: sources.map((source) => ({ page: source.page, file: source.file, sourceSha256: source.sha256, thresholding: 0, confidence: 90, words: 2, solidWords: 2, text: 'two words' }))
  });

  test('a well-formed file validates and every defect is reported', () => {
    expect(validateOcrFile(complete())).toEqual([]);
    const broken = complete();
    broken.pages[1]!.page = 5;
    broken.pages[2]!.sourceSha256 = 'xyz';
    broken.pages[0]!.confidence = 120;
    (broken as Record<string, unknown>).schemaVersion = 2;
    const problems = validateOcrFile(broken).join('\n');
    expect(problems).toContain('schemaVersion');
    expect(problems).toContain('pages[1].page');
    expect(problems).toContain('pages[2].sourceSha256');
    expect(problems).toContain('pages[0].confidence');
    broken.pages[2]!.thresholding = 7;
    expect(validateOcrFile(broken).join('\n')).toContain('pages[2].thresholding');
    expect(validateOcrFile(null)).toEqual(['file is not an object']);
  });

  test('unchanged pages are skipped; changed, new and forced pages are processed', () => {
    const existing = complete();
    expect(planIssue(sources, existing, tool).pages.map((page) => page.action)).toEqual(['skip', 'skip', 'skip']);

    const changed = sources.map((source) => source.page === 2 ? { ...source, sha256: hash('new image') } : source);
    expect(planIssue(changed, existing, tool).pages.map((page) => page.action)).toEqual(['skip', 'process', 'skip']);

    const partial = { ...existing, pages: existing.pages.slice(0, 2) };
    expect(planIssue(sources, partial, tool).pages.map((page) => page.action)).toEqual(['skip', 'skip', 'process']);

    expect(planIssue(sources, existing, tool, true).pages.every((page) => page.action === 'process')).toBe(true);
    expect(planIssue(sources, undefined, tool).pages.every((page) => page.action === 'process')).toBe(true);
  });

  test('a different engine or tool version invalidates everything, and dropped pages are counted', () => {
    expect(planIssue(sources, complete(), currentTool('tesseract 6.0.0')).pages.every((page) => page.action === 'process')).toBe(true);
    expect(planIssue(sources.slice(0, 2), complete(), tool).removed).toBe(1);
  });

  test('the best reading is the one with the most solid words, and near-ties keep the plainer method', () => {
    const reading = (method: number, words: number, solidWords: number, confidence: number | null) => ({ method, words, solidWords, confidence, text: `m${method}` });
    expect(chooseReading([reading(0, 0, 0, null), reading(1, 387, 60, 58.7), reading(2, 3, 1, 67)]).method).toBe(1);
    expect(chooseReading([reading(0, 400, 360, 90), reading(1, 410, 372, 90), reading(2, 150, 140, 95)]).method).toBe(0);
    expect(chooseReading([reading(0, 166, 120, 82.3), reading(1, 390, 150, 68.3), reading(2, 451, 400, 87.3)]).method).toBe(2);
    // Hundreds of low-confidence guesses must not beat a clean reading.
    expect(chooseReading([reading(0, 200, 180, 88), reading(1, 473, 90, 27.7)]).method).toBe(0);
    expect(chooseReading([reading(0, 0, 0, null), reading(1, 0, 0, null)]).method).toBe(0);
    expect(() => chooseReading([])).toThrow();
  });

  test('serialisation is byte-stable regardless of key order', () => {
    const shuffled = JSON.parse(JSON.stringify(complete(), ['pages', 'text', 'words', 'confidence', 'solidWords', 'sourceSha256', 'file', 'page', 'tool', 'engine', 'psm', 'oem', 'language', 'version', 'name', 'sourcePdfSha256', 'issueSlug', 'schemaVersion', 'thresholding'])) as OcrFile;
    expect(serialiseOcrFile(shuffled)).toBe(serialiseOcrFile(complete()));
    expect(serialiseOcrFile(complete()).endsWith('}\n')).toBe(true);
  });
});

describe('committed newsletter text', () => {
  test('every newsletter has a valid result file with one entry per page image, in order', () => {
    expect(pageManifest.length).toBe(102);
    for (const issue of archiveIssues) {
      const result = loadResult(issue.slug);
      expect(validateOcrFile(result)).toEqual([]);
      expect(result.issueSlug).toBe(issue.slug);
      const images = pageManifest.filter((page) => page.issueSlug === issue.slug);
      expect(result.pages.length).toBe(issue.pageCount);
      expect(result.pages.map((page) => page.page)).toEqual(images.map((page) => page.page));
      for (const entry of result.pages) {
        const image = images.find((page) => page.page === entry.page)!;
        expect(image.src.endsWith('/' + entry.file)).toBe(true);
        expect(entry.sourceSha256).toBe(image.sha256);
        expect(entry.sourceSha256).toBe(createHash('sha256').update(readFileSync(join(root, 'static', image.src))).digest('hex'));
        expect(result.sourcePdfSha256).toBe(image.sourcePdfSha256);
      }
    }
  });

  test('the check command passes on the committed data and fails on a stale copy', () => {
    const run = (...args: string[]) => Bun.spawnSync([process.execPath, join(root, 'tools/newsletter-ocr/ocr.ts'), '--check', ...args], { stdout: 'pipe', stderr: 'pipe' });
    const good = run();
    expect(good.exitCode).toBe(0);
    expect(good.stdout.toString()).toContain('OK: every page image has a current text entry.');

    const stale = loadResult('spring-2026');
    stale.pages[3]!.sourceSha256 = '0'.repeat(64);
    const directory = mkdtempSync(join(tmpdir(), 'ocr-stale-'));
    writeFileSync(join(directory, 'spring-2026.json'), serialiseOcrFile(stale));
    const bad = run('--issue', 'spring-2026', '--out', directory);
    expect(bad.exitCode).toBe(1);
    expect(bad.stdout.toString()).toContain('13/14 pages current');
  });

  test('every page that has words is marked with a plausible confidence', () => {
    for (const issue of archiveIssues) {
      for (const page of loadResult(issue.slug).pages) {
        if (page.words > 0) expect(page.confidence).toBeGreaterThan(20);
        expect(page.text.length).toBeGreaterThanOrEqual(page.words);
      }
    }
  });
});

const hasEngine = Bun.which('tesseract') !== null;
describe('OCR engine (runs only inside the devenv)', () => {
  test.skipIf(!hasEngine)('re-reading a page reproduces the committed text exactly', async () => {
    const committed = loadResult('spring-2026');
    if ((await engineVersion()) !== committed.tool.engine) return; // a deliberate engine upgrade needs a fresh run, not a test failure
    const entry = committed.pages.find((page) => page.page === 2)!;
    const reading = await recognise(join(root, 'static/archive/pages', entry.file), entry.thresholding);
    expect(reading).toEqual({ method: entry.thresholding, text: entry.text, confidence: entry.confidence, words: entry.words, solidWords: entry.solidWords });
  }, 60_000);
});
