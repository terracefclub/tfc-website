import type { RequestHandler } from '@sveltejs/kit';
import { error, redirect } from '@sveltejs/kit';
import { authSettings, beginMemberLogin } from '$lib/server/member-auth';
import { memberAuthError } from '$lib/server/member-auth-error';

export const GET: RequestHandler = async ({ cookies, url }) => {
  let destination: string;
  try { destination = await beginMemberLogin(cookies, url.searchParams.get('returnTo')); }
  catch { return memberAuthError(503); }
  redirect(303, destination);
};

export const POST: RequestHandler = async ({ cookies, request, url }) => {
  let origin: string;
  try { origin = authSettings().origin; }
  catch { return memberAuthError(503); }
  if (request.headers.get('origin') !== origin) error(403, 'This account-switch request could not be verified.');
  let destination: string;
  try { destination = await beginMemberLogin(cookies, url.searchParams.get('returnTo'), true); }
  catch { return memberAuthError(503); }
  redirect(303, destination);
};
