import type { RequestHandler } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { completeMemberLogin } from '$lib/server/member-auth';
import { MemberApiError } from '$lib/server/member-api';
import { memberAuthError } from '$lib/server/member-auth-error';

export const GET: RequestHandler = async ({ cookies, url }) => {
  let destination: string;
  try { destination = await completeMemberLogin(cookies, url); }
  catch (failure) {
    if (failure instanceof MemberApiError && failure.status === 403) return memberAuthError(403);
    if (failure instanceof MemberApiError && failure.status === 503) return memberAuthError(503);
    return memberAuthError(400);
  }
  redirect(303, destination);
}
