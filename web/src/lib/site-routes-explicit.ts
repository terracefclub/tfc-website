/**
 * Prefixes reserved on purpose, in addition to the routes derived from `src/routes` (see tools/route-manifest.ts): ones the
 * CMS or the platform owns (`/api`, `/admin`, `/_app`) and the collection roots where imported content lives, so even a path
 * the app does not serve yet is never redirected over. Everything else comes from the route tree.
 */
export const explicitReservedPrefixes: readonly string[] = ['/members', '/auth', '/preview', '/api', '/admin', '/_app', '/events', '/newsletter', '/news', '/pages', '/donate'];
