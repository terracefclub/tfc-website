import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => {
  if (!locals.member) redirect(303, `/auth/login?returnTo=${encodeURIComponent(url.pathname + url.search)}`);
  return { member: locals.member };
};
