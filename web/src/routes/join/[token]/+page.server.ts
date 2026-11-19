import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { intake, IntakeError, tokenShape } from '$lib/server/lifecycle';

// The link carries a secret: never cache it, never send it as a referrer, never index it.
const headers = { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow', 'referrer-policy': 'no-referrer' } as const;
type Check = { valid: boolean; role?: 'current-member' | 'alumni'; name?: string };

export const load: PageServerLoad = async ({ params, setHeaders }) => {
  setHeaders(headers);
  if (!tokenShape.test(params.token)) return { state: 'invalid' as const };
  try {
    const result = await intake<Check>('redeem', { token: params.token });
    return result.body?.valid ? { state: 'ready' as const, role: result.body.role!, name: result.body.name ?? '' } : { state: 'invalid' as const };
  } catch (failure) { return { state: failure instanceof IntakeError ? 'unavailable' as const : 'invalid' as const }; }
};

export const actions: Actions = {
  default: async ({ params, setHeaders }) => {
    setHeaders(headers);
    if (!tokenShape.test(params.token)) return fail(404, { state: 'invalid' as const });
    try {
      const result = await intake<Check>('redeem', { token: params.token, consume: true });
      return result.body?.valid ? { state: 'accepted' as const } : fail(404, { state: 'invalid' as const });
    } catch { return fail(503, { state: 'unavailable' as const }); }
  },
};
