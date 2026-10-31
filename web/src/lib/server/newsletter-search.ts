import { createHash } from 'node:crypto';
import { archiveIssues } from '$lib/archive/content';
import pdfPages from '$lib/archive/pages.json';
import type { IndexedPage, SearchPayload } from '$lib/archive/search';

import fall2023 from '$lib/archive/ocr/fall-2023.json';
import fall2025 from '$lib/archive/ocr/fall-2025.json';
import spring2026 from '$lib/archive/ocr/spring-2026.json';
import summer2024 from '$lib/archive/ocr/summer-2024.json';

// Imported explicitly so the same module works under Vite and `bun test`. The OCR job writes one file per
// archive issue; tests/newsletter-search.test.ts fails if an issue in content.ts has no file here.
type OcrFile = { issueSlug: string; pages: Array<{ page: number; text: string }> };
const ocrFiles: OcrFile[] = [fall2023, fall2025, spring2026, summer2024];

/** One entry per page in archive order: OCR text and PDF text-layer text, both exactly as extracted. */
export function buildSearchPayload(): SearchPayload {
  const ocr = new Map<string, string>();
  for (const file of ocrFiles) for (const page of file.pages) ocr.set(`${file.issueSlug}:${page.page}`, page.text);
  const pdf = new Map(pdfPages.map((page) => [`${page.issueSlug}:${page.page}`, page.text]));
  const pages: IndexedPage[] = [];
  for (const issue of archiveIssues) {
    for (let page = 1; page <= issue.pageCount; page++) {
      pages.push({ issue: issue.slug, page, ocr: ocr.get(`${issue.slug}:${page}`) ?? '', pdf: pdf.get(`${issue.slug}:${page}`) ?? '' });
    }
  }
  return { version: 1, pages };
}

let cached: { body: string; etag: string } | undefined;
export function searchIndexBody(): { body: string; etag: string } {
  if (!cached) {
    const body = JSON.stringify(buildSearchPayload());
    cached = { body, etag: `"${createHash('sha256').update(body).digest('hex').slice(0, 32)}"` };
  }
  return cached;
}
