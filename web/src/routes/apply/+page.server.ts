import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { applyGuard, clientAddressConfigured, intakeSecret } from '$lib/server/apply-guard';
import { intake } from '$lib/server/lifecycle';

const headers = { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' } as const;

export const load: PageServerLoad = ({ setHeaders, getClientAddress }) => {
  setHeaders(headers);
  try { intakeSecret(); if (!clientAddressConfigured()) throw new Error('proxy'); return { open: true, token: applyGuard.issue(getClientAddress()) }; }
  catch { return { open: false, token: '' }; }
};

function text(form: FormData, name: string, max: number, required: boolean): string | undefined {
  const value = form.get(name);
  if (value !== null && typeof value !== 'string') throw new Error('invalid');
  const trimmed = (value ?? '').trim();
  if (trimmed.length > max || required && !trimmed) throw new Error('invalid');
  return trimmed || undefined;
}

export const actions: Actions = {
  default: async ({ request, getClientAddress, setHeaders }) => {
    setHeaders(headers);
    const form = await request.formData();
    let verdict: ReturnType<typeof applyGuard.check>;
    try { if (!clientAddressConfigured()) throw new Error('proxy'); verdict = applyGuard.check({ token: form.get('t'), honeypot: form.get('website'), client: getClientAddress() }); }
    catch { return fail(503, { error: 'Applications are not open right now. Please check back soon.' }); }
    // A tripped honeypot gets the same answer as success, so a script learns nothing.
    if (verdict === 'bot') return { received: true };
    if (verdict === 'rate-limited') return fail(429, { error: 'Too many applications from here. Please try again later.' });
    if (verdict === 'moved') return fail(400, { error: 'Your connection changed while you filled this in. Please reload the page and send your application again.' });
    if (verdict === 'too-fast' || verdict === 'expired') return fail(400, { error: 'Please reload the page and send your application again.' });
    let data: Record<string, unknown>;
    try {
      const affiliation = text(form, 'affiliation', 20, true);
      if (affiliation !== 'current-member' && affiliation !== 'alumni') throw new Error('invalid');
      const classYear = text(form, 'classYear', 4, false);
      if (classYear !== undefined && (!/^\d{4}$/.test(classYear) || Number(classYear) < 1904 || Number(classYear) > 2200)) throw new Error('invalid');
      const email = text(form, 'contactEmail', 254, true)!;
      if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(email)) throw new Error('invalid');
      // Only what the review needs. No IP address, user agent or timing is forwarded or stored.
      data = { name: text(form, 'name', 120, true), affiliation, classYear: classYear ? Number(classYear) : undefined, contactEmail: email, note: text(form, 'note', 1000, false) };
    } catch { return fail(400, { error: 'Please check the highlighted fields and try again.' }); }
    try {
      const result = await intake('apply', data);
      if (result.status !== 202) return fail(400, { error: 'Please check the fields and try again.' });
      applyGuard.spend(String(form.get('t')));
    } catch { return fail(503, { error: 'Applications are temporarily unavailable. Nothing was saved; please try again shortly.' }); }
    return { received: true };
  },
};
