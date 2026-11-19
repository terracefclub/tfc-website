import { error } from '@sveltejs/kit';
import { publishedContent } from '$lib/server/content';
import { renderPublishedBody } from '$lib/server/render';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(params.slug)) error(404, 'Not found');
  const document = await publishedContent(source => source.page(params.slug));
  if (!document) error(404, 'Not found');
  const { bodyHtml, ...page } = document;
  return { page, bodyHtml: await renderPublishedBody(bodyHtml), url: url.origin + url.pathname };
};
