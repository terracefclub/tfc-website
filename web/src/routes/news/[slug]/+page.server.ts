import { error } from '@sveltejs/kit';
import { publishedContent } from '$lib/server/content';
import { renderPublishedBody } from '$lib/server/render';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
  // Invalid, missing and unpublished slugs are the same 404, so a draft's existence is not disclosed.
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(params.slug)) error(404, 'Not found');
  const view = await publishedContent(source => source.post(params.slug));
  if (!view) error(404, 'Not found');
  const { bodyHtml, ...post } = view.post;
  return { post, previous: view.previous, next: view.next, bodyHtml: await renderPublishedBody(bodyHtml), url: url.origin + url.pathname };
};
