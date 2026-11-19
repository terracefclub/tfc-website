import { env } from '$env/dynamic/private';
import { donationConfig } from '$lib/server/donations';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
  const config = donationConfig(env);
  return { mode: config.mode, checkouts: config.checkouts.map(({ url: _url, ...checkout }) => checkout) };
};
