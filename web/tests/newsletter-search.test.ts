import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { gzipSync } from 'node:zlib';
import { Window } from 'happy-dom';
import { compile } from 'svelte/compiler';
import { createServer, type ViteDevServer } from 'vite';
import { archiveIssues } from '../src/lib/archive/content';
import { pagesForIssue } from '../src/lib/archive/reader';
import { createSearchIndex, groupByIssue, queryTokens, resultTarget, searchIndex, type SearchPayload, type SearchResult } from '../src/lib/archive/search';
import { buildSearchPayload, searchIndexBody } from '../src/lib/server/newsletter-search';

const payload: SearchPayload = {
  version: 1,
  pages: [
    { issue: 'fall-2023', page: 1, ocr: 'Dear Terrans,\nMother’s Musings: a Solarium open mic returns.', pdf: '' },
    { issue: 'fall-2023', page: 2, ocr: '', pdf: 'Crème brûlée and a berry pie for the Solarium Sessions crowd.' },
    { issue: 'fall-2023', page: 3, ocr: 'garbled s0larium', pdf: 'Nothing about the room here.' },
    { issue: 'summer-2024', page: 1, ocr: 'A quiche recipe with pesto, spinach and parmesan.', pdf: 'A quiche recipe with pesto, spinach and parmesan.' }
  ]
};
const index = createSearchIndex(payload);
const pageKey = (result: Pick<SearchResult, 'issue' | 'page'>) => `${result.issue}:${result.page}`;
const plain = (result: SearchResult) => result.snippet.map((part) => part.text).join('');

describe('search matching', () => {
  test('words are folded for matching only and capped', () => {
    expect(queryTokens('  Mother’s  CRÈME, a pie! pie ')).toEqual(['mothers', 'crème'.normalize('NFD').replace(/\p{M}/gu, ''), 'pie']);
    expect(queryTokens('a b')).toEqual([]);
    expect(queryTokens('one two three four five six seven eight')).toHaveLength(6);
  });

  test('every word must be present on the page, as a word prefix, ignoring case, accents and apostrophes', () => {
    expect(searchIndex(index, 'solar').map(pageKey)).toEqual(['fall-2023:1', 'fall-2023:2']);
    expect(searchIndex(index, 'solarium berry').map(pageKey)).toEqual(['fall-2023:2']);
    expect(searchIndex(index, 'creme brulee').map(pageKey)).toEqual(['fall-2023:2']);
    expect(searchIndex(index, 'MOTHERS musings').map(pageKey)).toEqual(['fall-2023:1']);
    expect(searchIndex(index, 'olarium')).toEqual([]);
    expect(searchIndex(index, 'nonexistent')).toEqual([]);
    expect(searchIndex(index, '')).toEqual([]);
    expect(searchIndex(index, '   ?!  ')).toEqual([]);
  });

  test('a page matches within one text source, preferring the PDF text, and OCR fills in when the PDF has none', () => {
    expect(searchIndex(index, 'quiche')[0]?.source).toBe('pdf');
    expect(searchIndex(index, 'musings')[0]?.source).toBe('ocr');
    expect(searchIndex(index, 'berry')[0]?.source).toBe('pdf');
    const both = createSearchIndex({ version: 1, pages: [{ issue: 'fall-2023', page: 7, ocr: 'pie pie pie pie', pdf: 'one pie' }] });
    expect(searchIndex(both, 'pie')[0]).toMatchObject({ source: 'pdf', snippet: [{ text: 'one ', hit: false }, { text: 'pie', hit: true }] });
    // 'garbled' exists only in OCR, 'room' only in the PDF layer of the same page: no cross-source match.
    expect(searchIndex(index, 'garbled room')).toEqual([]);
    expect(searchIndex(index, 'garbled')[0]?.page).toBe(3);
  });

  test('snippets are contiguous source text with the matches marked and ellipses at trimmed edges', () => {
    const long = Array.from({ length: 60 }, (_, number) => `word${number}`).join(' ') + ' Pesto ' + Array.from({ length: 60 }, (_, number) => `tail${number}`).join(' ');
    const longIndex = createSearchIndex({ version: 1, pages: [{ issue: 'fall-2023', page: 9, ocr: long, pdf: '' }] });
    const [result] = searchIndex(longIndex, 'pesto');
    expect(result?.snippet.filter((part) => part.hit).map((part) => part.text)).toEqual(['Pesto']);
    expect(plain(result!).startsWith('… ')).toBe(true);
    expect(plain(result!).endsWith(' …')).toBe(true);
    const body = plain(result!).replace(/^… /, '').replace(/ …$/, '');
    expect(long.replace(/\s+/g, ' ')).toContain(body);
    expect(body.split(' ').length).toBeLessThanOrEqual(8 + 1 + 14);
    // Newlines in OCR text collapse to single spaces; text is otherwise untouched.
    expect(plain(searchIndex(index, 'terrans')[0]!)).toBe('Dear Terrans, Mother’s Musings: a Solarium open mic returns.');
  });
});

describe('result to page mapping', () => {
  test('the open issue uses the existing in-page navigation; others deep-link to the page anchor', () => {
    expect(resultTarget({ issue: 'fall-2023', page: 27 }, 'fall-2023')).toEqual({ href: '/newsletter/fall-2023/#page-27', sameIssue: true });
    expect(resultTarget({ issue: 'spring-2026', page: 9 }, 'fall-2023')).toEqual({ href: '/newsletter/spring-2026/#page-9', sameIssue: false });
  });

  test('results group by newsletter in index order', () => {
    const shared = createSearchIndex({ version: 1, pages: [
      { issue: 'fall-2023', page: 1, ocr: 'pie', pdf: '' }, { issue: 'fall-2023', page: 4, ocr: 'pie', pdf: '' }, { issue: 'summer-2024', page: 2, ocr: '', pdf: 'pie' }
    ] });
    const groups = groupByIssue(searchIndex(shared, 'pie'));
    expect(groups.map((group) => group.issue)).toEqual(['fall-2023', 'summer-2024']);
    expect(groups[0]?.results.map((result) => result.page)).toEqual([1, 4]);
  });
});

describe('the committed newsletter text', () => {
  const payloadReal = buildSearchPayload();
  const realIndex = createSearchIndex(payloadReal);

  test('the index has exactly one entry for every page of every newsletter, in order', () => {
    expect(payloadReal.pages).toHaveLength(102);
    for (const issue of archiveIssues) {
      const entries = payloadReal.pages.filter((page) => page.issue === issue.slug);
      expect(entries.map((entry) => entry.page)).toEqual(Array.from({ length: issue.pageCount }, (_, offset) => offset + 1));
      expect(entries.some((entry) => entry.ocr.trim())).toBe(true);
    }
  });

  test('searches find pages that only OCR can read and pages that only the PDF text layer can', () => {
    const find = (query: string) => searchIndex(realIndex, query);
    const montreal = find('montreal').find((result) => pageKey(result) === 'spring-2026:9');
    expect(montreal?.source).toBe('ocr');
    expect(find('quiche').map(pageKey)).toContain('summer-2024:17');
    expect(find('applejack').map(pageKey)).toContain('fall-2023:27');
    expect(find('rice salad').map(pageKey)).toContain('fall-2025:32');
  });

  test('every result points at a real page and shows only text that is on that page', () => {
    const sourceText = new Map(payloadReal.pages.map((page) => [pageKey(page), { ocr: page.ocr, pdf: page.pdf }]));
    for (const query of ['terrace', 'pie', 'solarium sessions', 'recipe', 'reunions', 'officers', 'dear terrans']) {
      const results = searchIndex(realIndex, query);
      expect(results.length).toBeGreaterThan(0);
      for (const result of results) {
        const issue = archiveIssues.find((item) => item.slug === result.issue)!;
        expect(pagesForIssue(issue).some((page) => page.page === result.page)).toBe(true);
        const text = sourceText.get(pageKey(result))![result.source].replace(/\s+/g, ' ');
        expect(text).toContain(plain(result).replace(/^… /, '').replace(/ …$/, ''));
        expect(result.snippet.some((part) => part.hit)).toBe(true);
      }
    }
  });

  test('the payload stays small enough to load on demand', () => {
    const { body } = searchIndexBody();
    const raw = Buffer.byteLength(body);
    const gzip = gzipSync(body).byteLength;
    console.log(`search index: ${raw} bytes raw, ${gzip} bytes gzip`);
    expect(raw).toBeLessThan(250_000);
    expect(gzip).toBeLessThan(80_000);
  });
});

describe('index endpoint', () => {
  let server: ViteDevServer;
  let origin: string;
  beforeAll(async () => {
    server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' });
    await server.listen();
    origin = 'http://127.0.0.1:' + (server.httpServer?.address() as AddressInfo).port;
  });
  afterAll(async () => { await server?.close(); });

  test('serves the index as revalidated JSON and answers a matching ETag with 304', async () => {
    const response = await fetch(origin + '/newsletter/search-index.json', { redirect: 'manual' });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('cache-control')).toBe('public, no-cache');
    const etag = response.headers.get('etag')!;
    expect(etag).toMatch(/^"[a-f0-9]{32}"$/);
    expect(((await response.json()) as SearchPayload).pages).toHaveLength(102);
    const again = await fetch(origin + '/newsletter/search-index.json', { headers: { 'if-none-match': etag } });
    expect(again.status).toBe(304);
  });

  test('the reader markup carries no search box without JavaScript, and its size is unchanged', async () => {
    const html = await (await fetch(origin + '/newsletter/fall-2023/')).text();
    expect(html).not.toContain('reader-search-input');
    expect(html.length).toBeLessThan(300_000);
  });
});

describe('search box in the reader', () => {
  // Svelte's browser runtime looks these up as globals while mounting.
  const domGlobals = ['Element', 'HTMLElement', 'HTMLInputElement', 'HTMLMediaElement', 'HTMLSelectElement', 'HTMLTextAreaElement', 'HTMLFormElement', 'Node', 'Text', 'Comment', 'DocumentFragment', 'Event', 'MouseEvent', 'KeyboardEvent', 'MutationObserver'] as const;
  const keys = ['window', 'document', 'navigator', 'fetch', ...domGlobals] as const;
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const outDir = new URL('../.test-artifacts/', import.meta.url);
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  test('typing debounces one search, lists matches by newsletter and page, and Enter or a click jumps with the reader', async () => {
    for (const key of keys) saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    const browser = new Window({ url: 'http://localhost/newsletter/fall-2023/' });
    let fetches = 0;
    const body = searchIndexBody().body;
    Object.assign(globalThis, { window: browser, document: browser.document, navigator: browser.navigator });
    for (const key of domGlobals) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: (browser as unknown as Record<string, unknown>)[key] });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: async () => { fetches += 1; return new Response(body, { headers: { 'content-type': 'application/json' } }); } });
    await mkdir(outDir, { recursive: true });
    try {
      const src = (name: string) => new URL(`../src/lib/archive/${name}`, import.meta.url).href;
      const source = (await readFile(new URL('../src/lib/archive/NewsletterSearch.svelte', import.meta.url), 'utf8'))
        .replace("from './content'", `from '${src('content.ts')}'`).replace("from './search-client'", `from '${src('search-client.ts')}'`).replace("from './search'", `from '${src('search.ts')}'`);
      const compiled = compile(source, { filename: 'NewsletterSearch.svelte', generate: 'client', compatibility: { componentApi: 4 } });
      const file = new URL('NewsletterSearch.mjs', outDir);
      // Under Bun, `svelte` resolves to its server build where onMount does nothing; the browser build is needed here.
      const clientIndex = new URL('../node_modules/svelte/src/index-client.js', import.meta.url).href;
      await writeFile(file, compiled.js.code.replace(/from ['"]svelte['"]/, `from '${clientIndex}'`));
      const { default: NewsletterSearch } = await import(file.href);
      const { tick } = await import('svelte');
      const jumps: number[] = [];
      const component = new NewsletterSearch({ target: browser.document.body, props: { currentIssue: 'fall-2023', onjump: (page: number) => jumps.push(page) } });
      await tick();

      const input = browser.document.querySelector('input[type="search"]') as unknown as HTMLInputElement;
      const label = browser.document.querySelector(`label[for="${input.id}"]`);
      expect(label?.textContent).toContain('Find a word');
      expect(browser.document.querySelector('form')?.getAttribute('role')).toBe('search');
      expect(browser.document.querySelector('[role="status"]')?.getAttribute('aria-live')).toBe('polite');

      const type = (value: string) => { input.value = value; input.dispatchEvent(new browser.Event('input', { bubbles: true }) as unknown as Event); };
      type('a'); type('ap'); type('applejack');
      await wait(60);
      expect(browser.document.querySelector('.reader-search-results')).toBeNull(); // still debouncing
      await wait(450);
      await tick();
      expect(fetches).toBe(1);
      const list = browser.document.querySelector('ul[aria-label="Search results"]')!;
      const links = [...list.querySelectorAll('a')];
      expect(links.length).toBeGreaterThan(0);
      expect(list.querySelector('h4')?.textContent).toBe('Fall 2023');
      expect(links[0]?.getAttribute('href')).toMatch(/^\/newsletter\/fall-2023\/#page-\d+$/);
      expect(list.querySelector('mark')?.textContent?.toLowerCase()).toContain('applejack');
      expect(browser.document.querySelector('[role="status"]')?.textContent).toMatch(/pages? match/);

      const page = Number(links[0]!.getAttribute('href')!.split('#page-')[1]);
      const click = new browser.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
      links[0]!.dispatchEvent(click);
      expect(click.defaultPrevented).toBe(true);
      expect(jumps).toEqual([page]);

      browser.document.querySelector('form')!.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true }));
      await wait(30);
      expect(jumps).toEqual([page, page]);

      type('zzzzqx');
      await wait(450);
      await tick();
      expect(browser.document.querySelector('[role="status"]')?.textContent).toContain('No pages match');
      expect(browser.document.querySelector('ul[aria-label="Search results"]')).toBeNull();
      expect(fetches).toBe(1);
      component.$destroy();
    } finally {
      await rm(outDir, { recursive: true, force: true });
      await browser.happyDOM.abort();
      for (const key of keys) {
        const descriptor = saved.get(key);
        if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete (globalThis as Record<string, unknown>)[key];
      }
    }
  });
});
