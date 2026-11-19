// Route facts shared by the WordPress importer and the site's redirect consumer.

/** Existing top-level routes. A WordPress page already living at one of these paths is served in place. */
export const servedInPlace = ['/about', '/contact', '/donate', '/merchandise', '/shows-archive', '/newsletter', '/events', '/initiatives'] as const;

/** Paths the new site already serves, or reserves, that a WordPress URL must never be redirected over. */
export const reservedSourcePrefix = /^\/(?:members|auth|preview|api|admin|_app|events|newsletter|news|pages|donate)(?:\/|$)/i;
export const isReservedSource = (path: string) => reservedSourcePrefix.test(path) || (servedInPlace as readonly string[]).includes(path.toLowerCase());


/** Top-level routes the app serves itself that are not covered by the prefixes above. */
// These have no sub-routes, so only the exact path is the app's; a deeper old URL such as /about/history may redirect.
const otherRoutes = /^\/(?:apply|join|contact|about|merchandise|shows-archive|initiatives)\/?$/i;
/** True when a request path belongs to the app (or is reserved) and so must never be answered by a stored redirect. */
export const isAppRoute = (path: string) => isReservedSource(path) || otherRoutes.test(path);

/** Hosts the old WordPress site answered on (the importer's allowlist). Links to them inside bodies are old-site links. */
export const oldSiteHosts: ReadonlySet<string> = new Set(['princetonterraceclub.org', 'www.princetonterraceclub.org', 'terracefclub.org', 'www.terracefclub.org']);
