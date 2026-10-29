import { publishedContent } from '$lib/server/content';
import { archiveTopics } from '$lib/archive/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => publishedContent(async source => {
  const requestedTopic = url.searchParams.get('topic');
  const topic = archiveTopics.find((item) => item.id === requestedTopic)?.id ?? 'all';
  return {
    newsletters: await source.newsletters(),
    topic,
    query: (url.searchParams.get('q') ?? '').slice(0, 100)
  };
});
