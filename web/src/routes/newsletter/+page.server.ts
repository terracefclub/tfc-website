import { publishedContent } from '$lib/server/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => publishedContent(async source => ({ newsletters: await source.newsletters() }));
