import { error } from '@sveltejs/kit';
import { publishedContent } from '$lib/server/content';
import type { PageServerLoad } from './$types';

const pageSize = 12;

export const load: PageServerLoad = async ({ url }) => {
  const raw = url.searchParams.get('page');
  const requested = raw !== null && /^[1-9]\d{0,3}$/.test(raw) ? Number(raw) : 1;
  const result = await publishedContent(source => source.posts(requested, pageSize));
  if (requested > 1 && !result.docs.length) error(404, 'Page not found');
  return { ...result, path: url.pathname, origin: url.origin };
};
