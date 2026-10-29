import type { RequestHandler } from '@sveltejs/kit';
import { error, redirect } from '@sveltejs/kit';
import { beginMemberLogin } from '$lib/server/member-auth';

export const GET: RequestHandler = async ({ cookies, url }) => {
  let destination: string;
  try { destination = await beginMemberLogin(cookies, url.searchParams.get('returnTo')); }
  catch { error(503, 'Member sign-in is temporarily unavailable. Please try again shortly.'); }
  redirect(303, destination);
}
