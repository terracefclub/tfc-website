import { searchIndexBody } from '$lib/server/newsletter-search';
import type { RequestHandler } from './$types';

// Fetched by the newsletter reader only when a visitor starts searching.
export const trailingSlash = 'never';

export const GET: RequestHandler = ({ request }) => {
  const { body, etag } = searchIndexBody();
  // Revalidate on every use: the content changes only with a deploy, and a 304 costs almost nothing.
  const headers = { etag, 'cache-control': 'public, no-cache' };
  if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
  return new Response(body, { headers: { ...headers, 'content-type': 'application/json; charset=utf-8' } });
};
