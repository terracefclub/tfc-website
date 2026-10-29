import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { stat } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { createServer, type ViteDevServer } from 'vite';
import type { AddressInfo } from 'node:net';

let server: ViteDevServer;
let origin: string;

beforeAll(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'silent' });
  await server.listen();
  origin = `http://127.0.0.1:${(server.httpServer?.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await server?.close();
});

describe('rendered pages', () => {
  test('merchandise filters render server-side and hand off only to Terrace products', async () => {
    for (const [category, count] of [['all', 6], ['wear', 2], ['stick', 2], ['carry', 2], ['invalid', 6]] as const) {
      const response = await fetch(`${origin}/merchandise/?category=${category}`);
      expect(response.status).toBe(200);
      const { document } = parseHTML(await response.text());
      const cards = document.querySelectorAll('.shop-card');
      expect(cards.length).toBe(count);
      expect(document.querySelector('iframe')).toBeNull();
      expect(document.querySelector('input')).toBeNull();
      for (const card of cards) {
        const destination = new URL(card.querySelector('.shop-product-link')!.getAttribute('href')!);
        expect(destination.protocol).toBe('https:');
        expect(destination.hostname).toBe('www.redbubble.com');
        expect(destination.pathname).toMatch(/^\/i\/[^/]+\/[^/]+-by-terracefclub\/\d+\/[a-z0-9]+$/);
        const image = await fetch(new URL(card.querySelector('img')!.getAttribute('src')!, origin));
        expect(image.status).toBe(200);
        expect(image.headers.get('content-type')).toMatch(/^image\//);
      }
    }
  });

  test.each(['/', '/events/', '/events/supper-at-the-table/', '/newsletter/', '/donate/', '/merchandise/'])('%s has landmarks, one heading, named images, and safe links', async (path) => {
    const response = await fetch(`${origin}${path}`);
    expect(response.status).toBe(200);
    const html = await response.text();
    const { document } = parseHTML(html);
    expect(document.documentElement.getAttribute('lang')).toBe('en');
    expect(document.querySelectorAll('main').length).toBe(1);
    expect(document.querySelectorAll('h1').length).toBe(1);
    expect(document.querySelector('nav[aria-label="Primary navigation"]')).not.toBeNull();
    expect([...document.querySelectorAll('.header-inner > button, .header-inner > nav')].map((node) => node.tagName.toLowerCase())).toEqual(['button', 'nav']);
    expect([...document.querySelectorAll('img')].every((img) => img.hasAttribute('alt'))).toBe(true);
    for (const anchor of document.querySelectorAll('a')) {
      const href = anchor.getAttribute('href');
      expect(href).toBeTruthy();
      expect(href).not.toBe('#');
      if (anchor.getAttribute('target') === '_blank') {
        expect(anchor.getAttribute('rel')).toContain('noopener');
        expect(anchor.getAttribute('rel')).toContain('noreferrer');
      }
    }
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });

  test('the event preview is unmistakable and details never imply a live booking', async () => {
    const events = await (await fetch(`${origin}/events/`)).text();
    const detail = await (await fetch(`${origin}/events/supper-at-the-table/`)).text();
    const { document } = parseHTML(events);
    for (const date of document.querySelectorAll('.event-card time')) {
      expect(date.getAttribute('datetime')).toMatch(/^\d{4}-\d\d-\d\dT/);
      expect(date.querySelector('.sr-only')?.textContent).toMatch(/2026$/);
    }
    expect(events).toContain('sample content only');
    expect(document.querySelectorAll('.sample-label')).toHaveLength(3);
    for (const image of document.querySelectorAll('.event-photo img')) {
      expect(image.getAttribute('loading')).toBe('lazy');
      expect(Number(image.getAttribute('width'))).toBeGreaterThan(0);
      expect(Number(image.getAttribute('height'))).toBeGreaterThan(0);
    }
    for (const caption of document.querySelectorAll('.event-photo figcaption')) {
      expect(caption.querySelector('a')?.getAttribute('href')).toMatch(/^\/newsletter\/fall-2023\/#page-/);
    }
    expect(detail).toContain('not scheduled');
    expect(detail).toContain('official calendar');
  });

  test('the home page stays light enough for a simple static visit', async () => {
    const response = await fetch(origin);
    const html = await response.text();
    expect(Buffer.byteLength(html)).toBeLessThan(45_000);
    const { document } = parseHTML(html);
    const assets = new Set([...document.querySelectorAll('img')].map(image => image.getAttribute('src')!));
    for (const asset of assets) {
      expect(asset.startsWith('/')).toBe(true);
      const response = await fetch(new URL(asset, origin));
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toMatch(/^image\//);
      const size = (await stat(new URL(`../static${asset}`, import.meta.url))).size;
      expect(size).toBeLessThan(900_000);
    }
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
  });

  test('every homepage destination resolves, including archive issue and topic links', async () => {
    const { document } = parseHTML(await (await fetch(origin)).text());
    const links = new Set([...document.querySelectorAll('a[href]')]
      .map(anchor => anchor.getAttribute('href')!)
      .filter(href => href.startsWith('/')));
    for (const href of links) {
      const response = await fetch(new URL(href, origin), { redirect: 'manual' });
      if (href === '/members/') {
        expect(response.status).toBe(303);
        expect(response.headers.get('Location')).toBe('/auth/login?returnTo=%2Fmembers%2F');
      } else expect(response.status, href).toBe(200);
    }
  });
});

test('private routes never cache or reveal content before authentication', async () => {
  for (const path of ['/members/', '/members/stories/', '/members/people/']) {
    const response = await fetch(`${origin}${path}`, { redirect: 'manual' });
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe(`/auth/login?returnTo=${encodeURIComponent(path)}`);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  }
  const callback = await fetch(`${origin}/auth/callback?code=replayed&state=untrusted`);
  expect(callback.status).toBe(400);
  expect(callback.headers.get('Cache-Control')).toBe('private, no-store');
  expect(callback.headers.get('Referrer-Policy')).toBe('no-referrer');
  expect((await fetch(`${origin}/auth/logout`)).status).toBe(405);
});
