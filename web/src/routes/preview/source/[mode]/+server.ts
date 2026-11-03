import { error, redirect } from '@sveltejs/kit';
import { publishedPreviewCookie } from '$lib/server/local-preview';
import type { RequestHandler } from './$types';

export const trailingSlash = 'always';

export const POST: RequestHandler = ({ locals, url, request, params, cookies }) => {
  if (!locals.localPreview || !['published', 'samples'].includes(params.mode)) error(404);
  if (request.headers.get('origin') !== url.origin) error(403);
  const options = { path: '/', httpOnly: true, sameSite: 'strict', secure: false } as const;
  if (params.mode === 'published') cookies.set(publishedPreviewCookie, '1', options);
  else cookies.delete(publishedPreviewCookie, options);
  redirect(303, '/events/');
};
