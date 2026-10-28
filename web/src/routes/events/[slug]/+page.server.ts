import { error } from '@sveltejs/kit';
import { publishedContent } from '$lib/server/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(params.slug)) error(404, 'Event not found');
  const event = await publishedContent(source => source.event(params.slug));
  if (!event) error(404, 'Event not found');
  return { event };
};
