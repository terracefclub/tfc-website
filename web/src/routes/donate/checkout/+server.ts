import { env } from '$env/dynamic/private';
import { donationConfig } from '$lib/server/donations';
import type { RequestHandler } from './$types';

export const trailingSlash = 'always';

export const GET: RequestHandler = ({ url }) => {
  const config = donationConfig(env);
  const ids = url.searchParams.getAll('option');
  const checkout = ids.length === 1 && config.checkouts.find(option => option.id === ids[0]);
  const headers = { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' };
  if (!checkout) return new Response('This giving option is unavailable. Return to /donate/ for current options.', { status: 404, headers });
  return new Response(null, { status: 303, headers: { ...headers, location: checkout.url } });
};
