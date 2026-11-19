// Route facts shared by the WordPress importer and the site's redirect consumer.
import { appExactRoutes, appRoutePrefixes } from './route-manifest';

/** Existing top-level routes. A WordPress page already living at one of these paths is served in place. */
export const servedInPlace = ['/about', '/contact', '/donate', '/merchandise', '/shows-archive', '/newsletter', '/events', '/initiatives'] as const;

/**
 * Paths the new site serves or reserves, which a WordPress URL must never be redirected over. They come from the route
 * manifest, generated from the actual SvelteKit route tree (`tools/route-manifest.ts`; CI fails when it is stale) plus the
 * explicit reserved prefixes. A static route is reserved at its exact path only (a deeper old URL such as `/about/history`
 * may redirect); a route with sub-routes or a dynamic segment reserves everything below it.
 */
export const isReservedSource = (path: string) => {
  const lower = path.toLowerCase();
  return appExactRoutes.includes(lower) || (servedInPlace as readonly string[]).includes(lower) || appRoutePrefixes.some(prefix => lower === prefix || lower.startsWith(prefix + '/'));
};
/** True when a request path belongs to the app (or is reserved) and so must never be answered by a stored redirect. */
export const isAppRoute = isReservedSource;

/** Hosts the old WordPress site answered on (the importer's allowlist). Links to them inside bodies are old-site links. */
export const oldSiteHosts: ReadonlySet<string> = new Set(['princetonterraceclub.org', 'www.princetonterraceclub.org', 'terracefclub.org', 'www.terracefclub.org']);
