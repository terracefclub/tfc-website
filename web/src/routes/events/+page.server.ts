import { summarizeEvent } from '$lib/content';
import { publishedContent } from '$lib/server/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => publishedContent(async source => ({ preview: source.preview, events: (await source.events()).map(summarizeEvent) }));
