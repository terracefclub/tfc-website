import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { intake, tokenShape } from '$lib/server/lifecycle';

// The one-time token travels in the URL fragment, which browsers never send to a server, and then in
// a POST body, so it stays out of access logs and referrers. The no-store, noindex and no-referrer policy for this
// route is set once, in hooks.server.ts (see routePolicy); a header set here as well would throw when SvelteKit
// re-runs `load` after a no-script POST, after the token was already consumed.
export const load: PageServerLoad = () => ({});

export const actions: Actions = {
  default: async ({ request }) => {
    const token = (await request.formData()).get('token');
    if (typeof token !== 'string' || !tokenShape.test(token.trim())) return fail(404, { state: 'invalid' as const });
    try {
      const result = await intake<{ valid: boolean }>('redeem', { token: token.trim(), consume: true });
      return result.body?.valid ? { state: 'accepted' as const } : fail(404, { state: 'invalid' as const });
    } catch { return fail(503, { state: 'unavailable' as const }); }
  },
};
