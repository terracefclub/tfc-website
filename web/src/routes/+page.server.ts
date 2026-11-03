import { summarizeEvent } from '$lib/content';
import { publishedContent } from '$lib/server/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => publishedContent(async source => {
  const [events, newsletters, initiatives] = await Promise.all([source.events(), source.newsletters(), source.initiatives()]);
  return { preview: source.preview, events: events.slice(0, 3).map(summarizeEvent), newsletters: newsletters.slice(0, 1).map(({ title, url }) => ({ title, url })), initiatives: initiatives.slice(0, 3) };
});
