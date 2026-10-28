import { error } from '@sveltejs/kit';
import { getEvent } from '$lib/content';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
  const event = getEvent(params.slug);
  if (!event) error(404, 'Sample event not found');
  return { event };
};
