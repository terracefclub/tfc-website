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

/** Four digits from 1904 to 2200; the page sets a matching `pattern` so the browser agrees. */
function validClassYear(value: string): boolean { return /^\d{4}$/.test(value) && Number(value) >= 1904 && Number(value) <= 2200; }

const messages: Record<string, string> = {
  name: 'Enter your name (up to 120 characters).',
  affiliation: 'Choose whether you are a current member or alumnus or alumna.',
  classYear: 'Enter a four-digit year from 1904 to 2200, or leave this blank.',
  contactEmail: 'Enter an email address the club can reply to.',
  note: 'Keep this to 1000 characters or fewer.',
};

/** What the visitor typed, handed back so a failed submit never makes them retype. Never the token or honeypot. */
function echo(form: FormData) {
  const take = (name: string, max: number) => { const value = form.get(name); return typeof value === 'string' ? value.slice(0, max) : ''; };
  return { name: take('name', 120), affiliation: take('affiliation', 20), classYear: take('classYear', 4), contactEmail: take('contactEmail', 254), note: take('note', 1000) };
}

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
    if (verdict === 'rate-limited') return fail(429, { error: 'Too many applications from here. Please try again later.', values: echo(form) });
    if (verdict === 'moved') return fail(400, { error: 'Your connection changed while you filled this in. Please reload the page and send your application again.', values: echo(form) });
    if (verdict === 'too-fast' || verdict === 'expired') return fail(400, { error: 'Please reload the page and send your application again.', values: echo(form) });
    const values = echo(form);
    const fieldErrors: Record<string, string> = {};
    const field = (name: string, check: () => string | undefined) => { try { return check(); } catch { fieldErrors[name] = messages[name]; return undefined; } };
    const name = field('name', () => text(form, 'name', 120, true));
    const affiliation = field('affiliation', () => { const value = text(form, 'affiliation', 20, true); if (value !== 'current-member' && value !== 'alumni') throw new Error('invalid'); return value; });
    const classYear = field('classYear', () => { const value = text(form, 'classYear', 4, false); if (value !== undefined && !validClassYear(value)) throw new Error('invalid'); return value; });
    const email = field('contactEmail', () => { const value = text(form, 'contactEmail', 254, true)!; if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(value)) throw new Error('invalid'); return value; });
    const note = field('note', () => text(form, 'note', 1000, false));
    if (Object.keys(fieldErrors).length) return fail(400, { error: 'Please check the highlighted fields and try again.', fieldErrors, values });
    // Only what the review needs. No IP address, user agent or timing is forwarded or stored.
    const data = { name, affiliation, classYear: classYear ? Number(classYear) : undefined, contactEmail: email, note };
    try {
      const result = await intake('apply', data);
      if (result.status !== 202) return fail(400, { error: 'Please check the fields and try again.', values });
      applyGuard.spend(String(form.get('t')));
    } catch { return fail(503, { error: 'Applications are temporarily unavailable. Nothing was saved; please try again shortly.', values }); }
    return { received: true };
  },
};
