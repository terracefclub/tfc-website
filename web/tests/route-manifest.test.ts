import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildManifest, manifestFiles, scanRoutes, staleManifests } from '../tools/route-manifest';
import { isAppRoute, isReservedSource } from '../src/lib/site-routes';

describe('route manifest', () => {
  test('both generated copies match the actual route tree (CI fails when a route was added without regenerating)', () => {
    expect(staleManifests()).toEqual([]);
    expect(manifestFiles.length).toBe(2);
  });
  test('every real route is reserved: /join and /apply can never get a redirect row', () => {
    for (const path of ['/join', '/apply', '/JOIN', '/about', '/members/account', '/news/anything', '/newsletter/2024', '/api/x', '/preview/source/live']) expect(isReservedSource(path)).toBe(true);
    for (const path of ['/join/', '/something-else', '/about/history', '/membership/dues']) expect(isReservedSource(path.replace(/\/$/, ''))).toBe(path === '/join/');
    expect(isAppRoute('/join')).toBe(true);
  });
  test('scanning derives exact routes, dynamic prefixes and ignores route groups', () => {
    const root = mkdtempSync(join(tmpdir(), 'routes-'));
    try {
      const file = (path: string) => { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), ''); };
      file('+page.svelte'); file('brand-new/+page.svelte'); file('(group)/inside/+page.svelte'); file('shop/[id]/+page.svelte'); file('docs/[...rest]/+page.svelte');
      file('feed.xml/+server.ts'); file('lib-only/helper.ts'); file('tools/+layout.svelte');
      expect(scanRoutes(root)).toEqual({ exact: ['/', '/brand-new', '/feed.xml', '/inside'], prefixes: ['/docs', '/shop'] });
      file('[slug]/+page.svelte');
      expect(() => scanRoutes(root)).toThrow('top-level dynamic route');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  test('the explicit reserved prefixes stay in the manifest even though the app does not serve them', () => {
    expect(buildManifest().prefixes).toEqual(expect.arrayContaining(['/api', '/admin', '/_app', '/members', '/pages']));
  });
});
