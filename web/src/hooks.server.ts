import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { previewEditorLink, publishedPreviewCookie } from '$lib/server/local-preview';
import { resolveMemberSession } from '$lib/server/member-auth';
import { mediaOriginOf } from '$lib/render-body';
import { contentMode } from '$lib/server/content';
import { sharedRedirectResolver } from '$lib/server/redirects';

export const handle: Handle = async ({ event, resolve }) => {
  const editorSignIn = dev && previewEditorLink(event.url.origin, env);
  if (editorSignIn) {
    event.locals.localPreview = { editorSignIn, published: event.cookies.get(publishedPreviewCookie) === '1' };
  }
  event.locals.member = null;
  event.locals.memberAccessToken = null;
  const privatePath = /^\/members(?:\/|$)/.test(event.url.pathname) || /^\/members(?:\/|$)/.test(event.route.id ?? '');
  const authPath = event.url.pathname.startsWith('/auth/') || (event.route.id ?? '').startsWith('/auth/');
  let response: Response;
  if (privatePath) {
    try {
      const session = await resolveMemberSession(event.cookies);
      if (session) {
        event.locals.member = session.member;
        event.locals.memberAccessToken = session.accessToken;
        response = await resolve(event);
      } else {
        response = new Response(null, { status: 303, headers: { Location: `/auth/login?returnTo=${encodeURIComponent(event.url.pathname + event.url.search)}` } });
      }
    } catch {
      response = new Response('The member space is temporarily unavailable. Please try again shortly.', { status: 503 });
    }
  } else {
    // Old WordPress URLs: only a path that matches no route is looked up, so a stored redirect can never shadow a page.
    // The query string is dropped (stored sources have none). Any CMS problem falls through to the normal 404.
    const hit = event.route.id === null && (event.request.method === 'GET' || event.request.method === 'HEAD') && env.CMS_ORIGIN && contentMode(event.locals.localPreview, env) === 'cms'
      ? await sharedRedirectResolver(env.CMS_ORIGIN).resolve(event.url.pathname).catch(() => null)
      : null;
    response = hit
      ? new Response(null, { status: hit.status, headers: { Location: hit.location, 'Cache-Control': 'public, max-age=300' } })
      : await resolve(event);
  }
  // Imported bodies are re-sanitized before rendering; this adds a browser-side backstop for those routes without
  // touching script or style policy: no plugins, no framing, no base rewriting, and images only from this site or the media origin.
  if (/^\/(?:news|pages)(?:\/|$)/.test(event.route.id ?? '')) {
    const origin = mediaOriginOf(env.CMS_PUBLIC_ORIGIN);
    const media = origin ? ` ${origin}` : '';
    response.headers.set('Content-Security-Policy', `base-uri 'none'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:${media}`);
  }
  if (privatePath || authPath || event.locals.localPreview) {
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    response.headers.append('Vary', 'Cookie');
  }
  response.headers.set('X-Content-Type-Options', 'nosniff');
  if (!response.headers.has('Referrer-Policy')) response.headers.set('Referrer-Policy', authPath ? 'no-referrer' : 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return response;
};
