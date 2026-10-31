// Client-side full-text search over the text read from the newsletter pages (OCR of the page images and the
// text layer of the original PDFs). Pure functions only; nothing here fetches or touches the DOM.

export type IndexedPage = { issue: string; page: number; ocr: string; pdf: string };
export type SearchPayload = { version: 1; pages: IndexedPage[] };
export type SnippetPart = { text: string; hit: boolean };
export type SearchResult = { issue: string; page: number; source: 'ocr' | 'pdf'; snippet: SnippetPart[] };

type Word = { start: number; end: number; folded: string };
type Source = { kind: 'ocr' | 'pdf'; text: string; words: Word[] };
type Doc = { issue: string; page: number; sources: Source[] };
export type SearchIndex = { docs: Doc[] };

const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
export const MAX_QUERY_TOKENS = 6;
export const SNIPPET_WORDS_BEFORE = 8;
export const SNIPPET_WORDS_AFTER = 14;

/** Lower-case, accent-free, apostrophe-free form used for matching only; displayed text is never altered. */
export function foldWord(word: string): string {
  return word.normalize('NFD').replace(/\p{M}+/gu, '').toLocaleLowerCase('en').replace(/['’]/g, '');
}

export function queryTokens(query: string): string[] {
  const tokens = [...query.matchAll(WORD)].map((match) => foldWord(match[0])).filter((token) => token.length >= 2);
  return [...new Set(tokens)].slice(0, MAX_QUERY_TOKENS);
}

function wordsOf(text: string): Word[] {
  return [...text.matchAll(WORD)].map((match) => ({ start: match.index!, end: match.index! + match[0].length, folded: foldWord(match[0]) }));
}

export function createSearchIndex(payload: SearchPayload): SearchIndex {
  if (payload?.version !== 1 || !Array.isArray(payload.pages)) throw new Error('Unsupported search index');
  return {
    docs: payload.pages.map((page) => ({
      issue: page.issue,
      page: page.page,
      // The PDF text layer comes first so that equal matches prefer the born-digital text over OCR.
      sources: ([{ kind: 'pdf', text: page.pdf }, { kind: 'ocr', text: page.ocr }] as const)
        .filter((source) => source.text.trim())
        .map((source) => ({ kind: source.kind, text: source.text, words: wordsOf(source.text) }))
    }))
  };
}

const matches = (word: Word, token: string) => word.folded.startsWith(token);

function containsAll(source: Source, tokens: string[]): boolean {
  return tokens.every((token) => source.words.some((word) => matches(word, token)));
}

function snippetFor(source: Source, tokens: string[]): SnippetPart[] {
  const first = source.words.findIndex((word) => matches(word, tokens[0]!));
  const from = Math.max(0, first - SNIPPET_WORDS_BEFORE);
  const to = Math.min(source.words.length - 1, first + SNIPPET_WORDS_AFTER);
  const parts: SnippetPart[] = [];
  const push = (text: string, hit: boolean) => {
    const clean = text.replace(/\s+/g, ' ');
    if (!clean) return;
    const last = parts.at(-1);
    if (last && last.hit === hit) last.text += clean;
    else parts.push({ text: clean, hit });
  };
  const last = source.words.length - 1;
  if (from > 0) push('… ', false);
  // Text before the first word or after the last one (quotes, final punctuation) belongs to the snippet only at the page edges.
  else push(source.text.slice(0, source.words[0]!.start), false);
  for (let index = from; index <= to; index++) {
    const word = source.words[index]!;
    if (index > from) push(source.text.slice(source.words[index - 1]!.end, word.start), false);
    push(source.text.slice(word.start, word.end), tokens.some((token) => matches(word, token)));
  }
  if (to < last) push(' …', false);
  else push(source.text.slice(source.words[last]!.end), false);
  const head = parts[0];
  if (head && from === 0) head.text = head.text.trimStart();
  const tail = parts.at(-1);
  if (tail && to === last) tail.text = tail.text.trimEnd();
  return parts.filter((part) => part.text);
}

/**
 * Pages whose text contains every query word (as a word prefix), in index order (newsletter, then page).
 * A page is matched within a single text source, so a snippet always shows contiguous text from one source.
 */
export function searchIndex(index: SearchIndex, query: string): SearchResult[] {
  const tokens = queryTokens(query);
  if (!tokens.length) return [];
  const results: SearchResult[] = [];
  for (const doc of index.docs) {
    // Sources are ordered PDF text layer first: it is cleaner than OCR, so OCR is used only when the PDF text has no match.
    const source = doc.sources.find((candidate) => containsAll(candidate, tokens));
    if (source) results.push({ issue: doc.issue, page: doc.page, source: source.kind, snippet: snippetFor(source, tokens) });
  }
  return results;
}

/** Where a result leads: the existing in-page navigation for the open issue, a normal deep link otherwise. */
export function resultTarget(result: Pick<SearchResult, 'issue' | 'page'>, currentIssue: string): { href: string; sameIssue: boolean } {
  return { href: `/newsletter/${result.issue}/#page-${result.page}`, sameIssue: result.issue === currentIssue };
}

export function groupByIssue(results: SearchResult[]): Array<{ issue: string; results: SearchResult[] }> {
  const groups: Array<{ issue: string; results: SearchResult[] }> = [];
  for (const result of results) {
    const last = groups.at(-1);
    if (last?.issue === result.issue) last.results.push(result);
    else groups.push({ issue: result.issue, results: [result] });
  }
  return groups;
}
