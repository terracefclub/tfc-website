import { publishedContent } from '$lib/server/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => publishedContent(async source => {
  const [events, newsletters, initiatives] = await Promise.all([source.events(), source.newsletters(), source.initiatives()]);
  return { preview: source.preview, events: events.slice(0, 3), newsletters, initiatives };
});
