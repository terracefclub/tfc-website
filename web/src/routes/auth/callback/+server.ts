import type { RequestHandler } from '@sveltejs/kit';
import { error, redirect } from '@sveltejs/kit';
import { completeMemberLogin } from '$lib/server/member-auth';
import { MemberApiError } from '$lib/server/member-api';

export const GET: RequestHandler = async ({ cookies, url }) => {
  let destination: string;
  try { destination = await completeMemberLogin(cookies, url); }
  catch (failure) {
    if (failure instanceof MemberApiError && failure.status === 403) error(403, 'A Terrace member or alumni approval is needed to join. Please contact the club.');
    if (failure instanceof MemberApiError && failure.status === 503) error(503, 'Member sign-in is temporarily unavailable.');
    error(400, 'This sign-in link expired or could not be verified. Please start sign-in again.');
  }
  redirect(303, destination);
}
