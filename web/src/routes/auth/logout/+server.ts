import type { RequestHandler } from '@sveltejs/kit';
import { error, redirect } from '@sveltejs/kit';
import { authSettings, endMemberSession } from '$lib/server/member-auth';

export const POST: RequestHandler = async ({ cookies, request }) => {
  if (request.headers.get('origin') !== authSettings().origin) error(403, 'This sign-out request could not be verified.');
  let destination: string;
  try { destination = await endMemberSession(cookies); }
  catch { destination = '/'; }
  redirect(303, destination);
}
