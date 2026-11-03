import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { previewEditorLink, publishedPreviewCookie } from '$lib/server/local-preview';
import { resolveMemberSession } from '$lib/server/member-auth';

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
  } else response = await resolve(event);
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
