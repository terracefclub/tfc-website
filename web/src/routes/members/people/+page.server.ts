import type { PageServerLoad } from './$types';
import { list, pageNumber, type Profile } from '$lib/server/community';
export const load: PageServerLoad = async ({ locals, url }) => ({ profiles: await list<Profile>(locals, 'member-profiles', { page: pageNumber(url), sort: 'displayName', 'where[directoryVisible][equals]': 'true' }) });
