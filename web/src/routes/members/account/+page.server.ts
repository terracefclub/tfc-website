import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { memberApi, MemberApiError } from '$lib/server/member-api';
import { endMemberSession } from '$lib/server/member-auth';

export const load: PageServerLoad = () => ({});

const message = (error: unknown) => error instanceof MemberApiError && error.status === 401 ? 'Your sign-in has expired. Sign in again to continue.' : 'That could not be completed right now. Nothing was erased.';

export const actions: Actions = {
  // Step one only issues a short-lived code; nothing is erased until it is confirmed.
  requestErasure: async ({ locals }) => {
    try {
      const result = await memberApi<{ confirmationCode: string; expiresAt: string }>(locals, '/api/lifecycle/erasure', { method: 'POST', body: JSON.stringify({ step: 'request' }) });
      return { confirmationCode: result.confirmationCode, expiresAt: result.expiresAt };
    } catch (error) { return fail(error instanceof MemberApiError && error.status === 401 ? 401 : 503, { error: message(error) }); }
  },
  confirmErasure: async ({ locals, request, cookies }) => {
    const form = await request.formData();
    const code = form.get('code');
    const typed = form.get('confirm');
    if (typeof code !== 'string' || typeof typed !== 'string' || typed.trim().toLowerCase() !== 'erase my data') return fail(400, { error: 'Type “erase my data” to confirm.', confirmationCode: typeof code === 'string' ? code : undefined });
    try {
      await memberApi(locals, '/api/lifecycle/erasure', { method: 'POST', body: JSON.stringify({ step: 'confirm', token: code }) });
    } catch (error) { return fail(error instanceof MemberApiError && error.status === 400 ? 400 : 503, { error: error instanceof MemberApiError && error.status === 400 ? 'That confirmation expired or was already used. Start again.' : message(error) }); }
    let destination = '/';
    try { destination = await endMemberSession(cookies); } catch { /* the CMS already refuses this account */ }
    redirect(303, destination);
  },
};
