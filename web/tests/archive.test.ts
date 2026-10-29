import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { parseHTML } from 'linkedom';
import { createServer, type ViteDevServer } from 'vite';
import { pageAtReadingLine } from '../src/lib/archive/reader-position';
import { pagesForIssue } from '../src/lib/archive/reader';
import pageManifest from '../static/archive/pages/manifest.json';
import { archiveIssues, archiveStories, filterArchiveStories, issueBySlug, pdfPageUrl, storiesForIssue } from '../src/lib/archive/content';

const manifest = JSON.parse(readFileSync(join(import.meta.dir, '../static/archive/manifest.json'), 'utf8')) as Array<{
  file: string; issueId: string; page: number; sourceUrl: string; sha256: string; sourcePdfSha256: string;
}>;
let server: ViteDevServer;
let origin: string;

beforeAll(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' });
  await server.listen();
  origin = 'http://127.0.0.1:' + (server.httpServer?.address() as AddressInfo).port;
});

afterAll(async () => {
  await server?.close();
});

describe('curated archive provenance', () => {
  test('every selected image is a verified derivative of a public issue page', () => {
    const assets = new Map(manifest.map((item) => [item.file, item]));
    expect(archiveIssues.reduce((count, issue) => count + issue.pageCount, 0)).toBe(102);
    expect(new Set(archiveIssues.map((issue) => issue.slug)).size).toBe(archiveIssues.length);

    for (const issue of archiveIssues) {
      const cover = assets.get(issue.cover.replace('/archive/', ''));
      expect(cover?.issueId).toBe(issue.slug);
      expect(cover?.page).toBe(1);
      expect(new URL(issue.pdfUrl).hostname).toBe('princetonterraceclub.org');
    }

    for (const story of archiveStories) {
      const issue = issueBySlug(story.issueSlug);
      expect(issue).toBeDefined();
      expect(story.page).toBeGreaterThanOrEqual(1);
      expect(story.endPage ?? story.page).toBeLessThanOrEqual(issue!.pageCount);
      const image = assets.get(story.image.replace('/archive/', ''));
      expect(image?.issueId).toBe(story.issueSlug);
      expect(image?.page).toBe(story.page);
      expect(image?.sourceUrl).toBe(pdfPageUrl(issue!, story.page));
      expect(image?.sourcePdfSha256).toMatch(/^[a-f0-9]{64}$/);
      if (story.followingPage) {
        const following = assets.get(story.followingPage.image.replace('/archive/', ''));
        expect(following?.issueId).toBe(story.issueSlug);
        expect(following?.page).toBe(story.followingPage.page);
        expect(following?.sourceUrl).toBe(pdfPageUrl(issue!, story.followingPage.page));
      }
    }

    for (const item of manifest) {
      const content = readFileSync(join(import.meta.dir, '../static/archive', item.file));
      expect(createHash('sha256').update(content).digest('hex')).toBe(item.sha256);
    }
  });


  test('complete reader covers every page in order with verified responsive assets', () => {
    expect(pageManifest.length).toBe(102);
    expect(pageManifest.reduce((bytes, page) => bytes + page.bytes + page.smallBytes, 0)).toBeLessThan(60_000_000);
    for (const issue of archiveIssues) {
      const pages = pagesForIssue(issue);
      expect(pages.map((page) => page.page)).toEqual(Array.from({ length: issue.pageCount }, (_, index) => index + 1));
      for (const page of pages) {
        const record = pageManifest.find((item) => item.issueSlug === issue.slug && item.page === page.page)!;
        expect(record.sourcePdfSha256).toBe(manifest.find((item) => item.issueId === issue.slug)!.sourcePdfSha256);
        expect(page.width).toBeGreaterThanOrEqual(1600);
        expect(page.height).toBeGreaterThan(0);
        expect(Math.abs(record.width / record.height - record.smallWidth / record.smallHeight)).toBeLessThan(.004);
        for (const [url, hash, budget] of [[page.src, record.sha256, 1_500_000], [page.smallSrc, record.smallSha256, 180_000]] as const) {
          const asset = readFileSync(join(import.meta.dir, '../static', url));
          expect(asset.byteLength).toBeLessThan(budget);
          expect(createHash('sha256').update(asset).digest('hex')).toBe(hash);
        }
      }
    }
  });

  test('every issue is readable without an iframe, JavaScript, or leaving the site', async () => {
    for (const issue of archiveIssues) {
      const response = await fetch(origin + '/newsletter/' + issue.slug + '/');
      expect(response.status).toBe(200);
      const html = await response.text();
      const { document } = parseHTML(html);
      const pages = document.querySelectorAll('.reader-page');
      expect(pages.length).toBe(issue.pageCount);
      expect(document.querySelectorAll('.reader-page-text').length).toBe(issue.pageCount);
      expect(document.querySelector('iframe')).toBeNull();
      expect(document.querySelector('select[aria-label="Go to newsletter page"]')?.children.length).toBe(issue.pageCount);
      for (let index = 0; index < pages.length; index++) {
        expect(pages[index]?.id).toBe('page-' + (index + 1));
        expect(pages[index]?.querySelector('img')?.getAttribute('loading')).toBe('lazy');
        expect(pages[index]?.querySelector('img')?.getAttribute('srcset')).toContain('600w');
      }
      expect(html.length).toBeLessThan(300_000);
    }
  });

  test('reading position ignores the previous page behind the sticky controls', () => {
    const pages = [{ page: 27, bottom: 80 }, { page: 28, bottom: 1380 }, { page: 29, bottom: 2700 }];
    expect(pageAtReadingLine(pages, 96)).toBe(28);
    expect(pageAtReadingLine(pages, 1380)).toBe(29);
    expect(pageAtReadingLine(pages, 3000)).toBe(29);
    expect(pageAtReadingLine([], 96)).toBe(1);
  });

  test('topic and text searches cross issues and require every search word', () => {
    expect(filterArchiveStories('food', 'pie').map((story) => story.slug)).toEqual(['berry-citrus-pie']);
    expect(filterArchiveStories('music', 'solarium').map((story) => story.slug)).toEqual(['poetry-in-the-solarium', 'solarium-sessions']);
    expect(filterArchiveStories('all', 'summer pesto').map((story) => story.slug)).toEqual(['green-goddess-quiche']);
    expect(filterArchiveStories('people', '2045')).toEqual([]);
    expect(storiesForIssue('fall-2023').length).toBeGreaterThan(2);
  });

  test('page links cannot point beyond the verified PDF length', () => {
    const issue = issueBySlug('spring-2026')!;
    expect(pdfPageUrl(issue, 3)).toBe(issue.pdfUrl + '#page=3');
    expect(() => pdfPageUrl(issue, 0)).toThrow(RangeError);
    expect(() => pdfPageUrl(issue, 15)).toThrow(RangeError);
  });

  test('topic deep links and search render only matching source-backed pages', async () => {
    const response = await fetch(origin + '/newsletter/?topic=food&q=pie');
    expect(response.status).toBe(200);
    const { document } = parseHTML(await response.text());
    const cards = document.querySelectorAll('.archive-story-card');
    expect(cards.length).toBe(1);
    expect(cards[0]?.textContent).toContain('New England Berry');
    expect(cards[0]?.querySelector('.archive-source-link')?.getAttribute('href')).toContain('#page=28');
    expect(document.querySelector('.archive-topic-nav a[aria-current="true"]')?.textContent).toBe('Food & recipes');
    expect(document.querySelector('.archive-issues a[href="/newsletter/fall-2023/"]')).not.toBeNull();
  });

  test('issue guide exposes full PDF and page references; unknown issues return 404', async () => {
    const response = await fetch(origin + '/newsletter/fall-2023/');
    expect(response.status).toBe(200);
    const { document } = parseHTML(await response.text());
    expect(document.querySelectorAll('main').length).toBe(1);
    expect(document.querySelectorAll('h1').length).toBe(1);
    expect(document.querySelector('#berry-citrus-pie a[href$="#page=28"]')).not.toBeNull();
    expect(document.querySelector('.archive-detail-copy a[href$=".pdf"]')).not.toBeNull();
    expect((await fetch(origin + '/archive/fall-2023-p28.webp')).status).toBe(200);
    expect((await fetch(origin + '/newsletter/not-an-issue/')).status).toBe(404);
  });
});
