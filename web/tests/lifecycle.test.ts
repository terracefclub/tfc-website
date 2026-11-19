import { afterAll, beforeAll, beforeEach, expect, test } from 'bun:test';
import { createServer, type ViteDevServer } from 'vite';
import { parseHTML } from 'linkedom';
import { createApplyGuard } from '../src/lib/server/apply-guard';

const secret = `synthetic-intake-secret-${crypto.randomUUID()}`;
const member = { id: 11, subject: 'synthetic-member', displayName: 'Synthetic Terran', roles: ['alumni'] as const };
const locals = { member, memberAccessToken: 'synthetic-access' };
const calls: Array<{ path: string; method: string; body: any; headers: Headers }> = [];
let respond: (request: Request, body: any, path: string) => Response | undefined = () => undefined;
const api = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
  const url = new URL(request.url);
  const text = request.method === 'GET' ? '' : await request.text();
  const body = text ? JSON.parse(text) : null;
  calls.push({ path: url.pathname, method: request.method, body, headers: request.headers });
  return respond(request, body, url.pathname) ?? Response.json({ doc: { id: 1 } });
} });
let vite: ViteDevServer;
let render: typeof import('svelte/server').render;
const saved = { origin: process.env.CMS_ORIGIN, secret: process.env.LIFECYCLE_INTAKE_SECRET };

beforeAll(async () => {
  process.env.CMS_ORIGIN = `http://127.0.0.1:${api.port}`;
  process.env.LIFECYCLE_INTAKE_SECRET = secret;
  vite = await createServer({ server: { middlewareMode: true }, logLevel: 'silent' });
  render = (await vite.ssrLoadModule('svelte/server')).render;
});
afterAll(async () => {
  await vite?.close(); api.stop(true);
  for (const [name, value] of [['CMS_ORIGIN', saved.origin], ['LIFECYCLE_INTAKE_SECRET', saved.secret]] as const) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
});
beforeEach(() => { calls.length = 0; respond = () => undefined; });

// ---- spam guard ---------------------------------------------------------------------------
function guard(overrides: Parameters<typeof createApplyGuard>[1] = {}) {
  let time = 1_800_000_000_000;
  const instance = createApplyGuard(() => secret, { now: () => time, ...overrides });
  return { instance, advance: (ms: number) => { time += ms; } };
}

test('the guard accepts a human-paced submission and rejects a filled honeypot', () => {
  const { instance, advance } = guard();
  const token = instance.issue();
  advance(10_000);
  expect(instance.check({ token, honeypot: '', client: 'a' })).toBe('ok');
  expect(instance.check({ token, honeypot: 'http://spam.invalid', client: 'a' })).toBe('bot');
  expect(instance.check({ token, honeypot: null, client: 'a' })).toBe('ok');
  expect(instance.check({ token, honeypot: undefined, client: 'a' })).toBe('ok');
});

test('the guard enforces a minimum fill time and a maximum token age', () => {
  const { instance, advance } = guard();
  const token = instance.issue();
  advance(500);
  expect(instance.check({ token, honeypot: '', client: 'a' })).toBe('too-fast');
  advance(10_000);
  expect(instance.check({ token, honeypot: '', client: 'a' })).toBe('ok');
  advance(3 * 60 * 60_000);
  expect(instance.check({ token, honeypot: '', client: 'a' })).toBe('expired');
});

test('forged, tampered, future-dated or missing timing tokens are treated as bots', () => {
  const { instance, advance } = guard();
  const token = instance.issue();
  advance(10_000);
  const [stamp, mac] = token.split('.');
  const other = createApplyGuard(() => `other-${secret}`, { now: () => 1_800_000_000_000 }).issue();
  for (const bad of [undefined, null, 42, '', 'x', `${stamp}`, `${stamp}.`, `${Number(stamp) - 20_000}.${mac}`, `${stamp}.${mac}.extra`, other, `${Number(stamp) + 99_000_000}.${mac}`]) {
    expect(instance.check({ token: bad, honeypot: '', client: `c-${String(bad)}` })).toBe('bot');
  }
});

test('the guard rate-limits per client and overall, resets after the window, and bounds memory', () => {
  const { instance, advance } = guard({ limit: 3, globalLimit: 5, maxClients: 2, windowMs: 60_000 });
  const token = instance.issue();
  advance(10_000);
  const send = (client: string) => instance.check({ token, honeypot: '', client });
  expect([send('a'), send('a'), send('a'), send('a')]).toEqual(['ok', 'ok', 'ok', 'rate-limited']);
  expect(send('b')).toBe('ok');
  expect(send('b')).toBe('ok');
  expect(send('c')).toBe('rate-limited'); // overall limit of five reached
  advance(61_000);
  expect(send('a')).toBe('ok');
  // More distinct clients than the cap never grows the table beyond it.
  for (const client of ['d', 'e', 'f', 'g']) send(client);
});

// ---- apply route --------------------------------------------------------------------------
async function applyModule() { return await vite.ssrLoadModule('/src/routes/apply/+page.server.ts'); }
const sent = (values: Record<string, string>) => new Request('http://127.0.0.1/apply', { method: 'POST', body: new URLSearchParams(values) });
const headersOf = () => ({ setHeaders: () => undefined });
let issued: Promise<string> | undefined;
async function readyForm(extra: Record<string, string> = {}) {
  // One real wait covers every test: the signed token stays valid for two hours.
  issued ??= (async () => { const { load } = await applyModule(); const { token } = (load as any)({ setHeaders: () => undefined }); await Bun.sleep(3100); return token as string; })();
  const token = await issued;
  return { t: token, name: 'Pat Terran', affiliation: 'alumni', classYear: '2004', contactEmail: 'pat@terrace.invalid', note: 'Hello.', website: '', ...extra };
}
let sequence = 0;
const client = () => `apply-test-${++sequence}`;

test('a valid application reaches the CMS with the secret and only the fields the review needs', async () => {
  const { actions } = await applyModule();
  const values = await readyForm();
  respond = () => Response.json({ received: true }, { status: 202 });
  const result: any = await (actions as any).default({ request: sent(values), getClientAddress: client, ...headersOf() });
  expect(result).toEqual({ received: true });
  expect(calls).toHaveLength(1);
  expect(calls[0].path).toBe('/api/lifecycle/apply');
  expect(calls[0].headers.get('x-terrace-intake')).toBe(secret);
  expect(calls[0].headers.get('authorization')).toBeNull();
  expect(calls[0].body).toEqual({ name: 'Pat Terran', affiliation: 'alumni', classYear: 2004, contactEmail: 'pat@terrace.invalid', note: 'Hello.' });
}, 15_000);

test('the honeypot, a too-fast submit and invalid input never reach the CMS', async () => {
  const { actions, load } = await applyModule();
  const action = (values: Record<string, string>, who = client()) => (actions as any).default({ request: sent(values), getClientAddress: () => who, ...headersOf() });
  const values = await readyForm();
  expect(await action({ ...values, website: 'https://spam.invalid' })).toEqual({ received: true }); // silently dropped
  const fresh = (load as any)({ setHeaders: () => undefined }).token;
  expect((await action({ ...values, t: fresh })).status).toBe(400); // too fast
  for (const bad of [{ name: '' }, { affiliation: 'staff' }, { classYear: '1800' }, { classYear: 'abcd' }, { contactEmail: 'nope' }, { note: 'x'.repeat(1001) }, { name: 'n'.repeat(121) }, { t: 'forged' }]) {
    const result: any = await action({ ...values, ...bad });
    expect(result.status === 400 || result.received === true).toBe(true);
  }
  expect(calls).toHaveLength(0);
}, 15_000);

test('rate limiting stops a client after the allowed number of attempts', async () => {
  const { actions } = await applyModule();
  const values = await readyForm();
  respond = () => Response.json({ received: true }, { status: 202 });
  const who = client();
  const statuses: unknown[] = [];
  for (let attempt = 0; attempt < 7; attempt++) {
    const result: any = await (actions as any).default({ request: sent(values), getClientAddress: () => who, ...headersOf() });
    statuses.push(result.status ?? 'ok');
  }
  expect(statuses).toEqual(['ok', 'ok', 'ok', 'ok', 'ok', 429, 429]);
  expect(calls).toHaveLength(5);
}, 15_000);

test('an unconfigured or failing CMS fails closed with a generic message and no detail', async () => {
  const { actions, load } = await applyModule();
  const values = await readyForm();
  respond = () => new Response('private upstream detail: db password', { status: 500 });
  const failed: any = await (actions as any).default({ request: sent(values), getClientAddress: client, ...headersOf() });
  expect(failed.status).toBe(503);
  expect(JSON.stringify(failed)).not.toContain('private upstream');
  respond = () => new Response(null, { status: 403 });
  expect(((await (actions as any).default({ request: sent(values), getClientAddress: client, ...headersOf() })) as any).status).toBe(503);
  delete process.env.LIFECYCLE_INTAKE_SECRET;
  try {
    expect(((load as any)({ setHeaders: () => undefined }))).toEqual({ open: false, token: '' });
    expect(((await (actions as any).default({ request: sent(values), getClientAddress: client, ...headersOf() })) as any).status).toBe(503);
  } finally { process.env.LIFECYCLE_INTAKE_SECRET = secret; }
}, 15_000);

test('the application page renders a hidden honeypot and the page is not indexable or cacheable', async () => {
  const { load } = await applyModule();
  const headers: Record<string, string> = {};
  const data = (load as any)({ setHeaders: (value: Record<string, string>) => Object.assign(headers, value) });
  expect(headers['cache-control']).toBe('private, no-store');
  expect(headers['x-robots-tag']).toContain('noindex');
  const component = (await vite.ssrLoadModule('/src/routes/apply/+page.svelte')).default;
  const { document } = parseHTML(render(component, { props: { data, form: null } }).body);
  expect(document.querySelector('input[name="website"]')?.getAttribute('tabindex')).toBe('-1');
  expect(document.querySelector('input[name="website"]')?.closest('[aria-hidden="true"]')).not.toBeNull();
  expect(document.querySelector('input[name="t"]')?.getAttribute('value')).toBe(data.token);
  expect(document.querySelectorAll('input[type=password]')).toHaveLength(0);
});

// ---- redeem route -------------------------------------------------------------------------
const token = 'A'.repeat(43);
async function joinModule() { return await vite.ssrLoadModule('/src/routes/join/[token]/+page.server.ts'); }

test('a link is checked without being used up, then redeemed once, with referrer and cache protection', async () => {
  const { load, actions } = await joinModule();
  const headers: Record<string, string> = {};
  respond = (_request, body) => Response.json({ valid: true, role: 'alumni', name: 'Pat' }, { status: 200 });
  expect(await (load as any)({ params: { token }, setHeaders: (value: Record<string, string>) => Object.assign(headers, value) })).toEqual({ state: 'ready', role: 'alumni', name: 'Pat' });
  expect(headers['referrer-policy']).toBe('no-referrer');
  expect(headers['cache-control']).toBe('private, no-store');
  expect(calls[0].body).toEqual({ token });
  expect(calls[0].headers.get('x-terrace-intake')).toBe(secret);
  expect(await (actions as any).default({ params: { token }, setHeaders: () => undefined })).toEqual({ state: 'accepted' });
  expect(calls[1].body).toEqual({ token, consume: true });
  respond = () => Response.json({ valid: false }, { status: 404 });
  const again: any = await (actions as any).default({ params: { token }, setHeaders: () => undefined });
  expect(again.status).toBe(404);
});

test('malformed tokens never reach the CMS; outages are not reported as invalid links', async () => {
  const { load, actions } = await joinModule();
  for (const bad of ['short', 'A'.repeat(44), '../../etc/passwd', 'A'.repeat(42) + '!', '']) {
    expect(await (load as any)({ params: { token: bad }, setHeaders: () => undefined })).toEqual({ state: 'invalid' });
    expect(((await (actions as any).default({ params: { token: bad }, setHeaders: () => undefined })) as any).status).toBe(404);
  }
  expect(calls).toHaveLength(0);
  respond = () => new Response(null, { status: 500 });
  expect(await (load as any)({ params: { token }, setHeaders: () => undefined })).toEqual({ state: 'unavailable' });
  expect(((await (actions as any).default({ params: { token }, setHeaders: () => undefined })) as any).status).toBe(503);
});

test('the invitation page states what happens next and that no account exists yet', async () => {
  const component = (await vite.ssrLoadModule('/src/routes/join/[token]/+page.svelte')).default;
  const view = (data: any, form: any = null) => parseHTML(`<html><body>${render(component, { props: { data, form } }).body}</body></html>`).document.documentElement.textContent ?? '';
  expect(view({ state: 'ready', role: 'alumni', name: 'Pat' })).toContain('Accept your invitation');
  expect(view({ state: 'ready', role: 'alumni', name: 'Pat' }, { state: 'accepted' })).toContain('operator');
  expect(view({ state: 'invalid' })).toContain('not valid');
});

// ---- member data: export, erasure, reports ----------------------------------------------------
async function exportModule() { return await vite.ssrLoadModule('/src/routes/members/account/export/+server.ts'); }

test('export requires a signed-in member and forwards only that session to the CMS', async () => {
  const { POST } = await exportModule();
  for (const anonymous of [{ member: null, memberAccessToken: null }, { member, memberAccessToken: null }]) {
    await expect((POST as any)({ locals: anonymous })).rejects.toMatchObject({ status: 401 });
  }
  expect(calls).toHaveLength(0);
  respond = () => Response.json({ format: 'terrace-member-export/1', member: { id: 11 } });
  const response: Response = await (POST as any)({ locals });
  expect(calls[0].path).toBe('/api/lifecycle/export');
  expect(calls[0].headers.get('authorization')).toBe('Bearer synthetic-access');
  expect(calls[0].headers.get('x-terrace-intake')).toBeNull();
  expect(response.headers.get('content-disposition')).toContain('attachment');
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect((await response.json()).format).toBe('terrace-member-export/1');
});

test('export surfaces refusals and outages without upstream detail, and allows larger files than ordinary calls', async () => {
  const { POST } = await exportModule();
  for (const [upstream, expected] of [[401, 401], [403, 403], [500, 503]] as const) {
    respond = () => new Response('private detail', { status: upstream });
    await expect((POST as any)({ locals })).rejects.toMatchObject({ status: expected });
  }
  const big = { stories: Array.from({ length: 30 }, () => 'x'.repeat(50_000)) };
  respond = () => Response.json(big);
  expect(((await (POST as any)({ locals })) as Response).status).toBe(200);
});

test('erasure is two steps, needs the typed confirmation, and ends the session afterwards', async () => {
  const { actions } = await vite.ssrLoadModule('/src/routes/members/account/+page.server.ts');
  respond = (_request, body) => body.step === 'request' ? Response.json({ confirmationCode: 'C'.repeat(43), expiresAt: '2030-01-01T00:00:00Z' }, { status: 201 }) : Response.json({ erased: true });
  const requested: any = await (actions as any).requestErasure({ locals });
  expect(requested.confirmationCode).toBe('C'.repeat(43));
  expect(calls.map((call) => call.body.step)).toEqual(['request']);
  const form = (values: Record<string, string>) => new Request('http://127.0.0.1/members/account', { method: 'POST', body: new URLSearchParams(values) });
  const cookies = { get: () => undefined, delete: () => undefined };
  const wrong: any = await (actions as any).confirmErasure({ locals, cookies, request: form({ code: 'C'.repeat(43), confirm: 'yes' }) });
  expect(wrong.status).toBe(400);
  expect(calls).toHaveLength(1);
  let redirected: any;
  try { await (actions as any).confirmErasure({ locals, cookies, request: form({ code: 'C'.repeat(43), confirm: 'Erase my data' }) }); } catch (thrown) { redirected = thrown; }
  expect(redirected).toMatchObject({ status: 303 });
  expect(calls[1].body).toEqual({ step: 'confirm', token: 'C'.repeat(43) });
  respond = () => new Response(null, { status: 400 });
  const expired: any = await (actions as any).confirmErasure({ locals, cookies, request: form({ code: 'C'.repeat(43), confirm: 'erase my data' }) });
  expect(expired.status).toBe(400);
  expect(expired.data.error).toContain('expired');
});

test('erasure fails closed for a signed-out session and reports an expired sign-in', async () => {
  const { actions } = await vite.ssrLoadModule('/src/routes/members/account/+page.server.ts');
  const result: any = await (actions as any).requestErasure({ locals: { member: null, memberAccessToken: null } });
  expect(result.status).toBe(401);
  expect(calls).toHaveLength(0);
});

test('reports send only a target type, id and reason for stories, groups and mentorship messages', async () => {
  const modules = {
    story: await vite.ssrLoadModule('/src/routes/members/stories/+page.server.ts'),
    group: await vite.ssrLoadModule('/src/routes/members/groups/+page.server.ts'),
    'mentorship-request': await vite.ssrLoadModule('/src/routes/members/mentorship/+page.server.ts'),
  };
  for (const [targetType, module] of Object.entries(modules)) {
    calls.length = 0;
    const request = new Request('http://127.0.0.1/members/x', { method: 'POST', body: new URLSearchParams({ id: '8', reason: 'harassment', status: 'hidden', targetAuthor: '3' }) });
    expect(((await (module.actions as any).report({ locals, request })) as any).success).toBeDefined();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ path: '/api/moderation-reports', method: 'POST', body: { targetType, targetId: 8, reason: 'harassment' } });
    expect(Object.keys(calls[0].body).sort()).toEqual(['reason', 'targetId', 'targetType']);
    calls.length = 0;
    for (const bad of <Record<string, string>[]>[{ id: '8', reason: 'spam' }, { id: '0', reason: 'privacy' }, { reason: 'privacy' }]) {
      expect(((await (module.actions as any).report({ locals, request: new Request('http://127.0.0.1/x', { method: 'POST', body: new URLSearchParams(bad) }) })) as any).status).toBe(400);
    }
    expect(calls).toHaveLength(0);
  }
});

test('report forms appear on groups, mentorship messages received, and stories, never on your own content', async () => {
  const groups = (await vite.ssrLoadModule('/src/routes/members/groups/+page.svelte')).default;
  const list = (docs: unknown[]) => ({ docs, page: 1, totalPages: 1, totalDocs: docs.length, hasNextPage: false, hasPrevPage: false });
  const html = render(groups, { props: { data: { member, memberships: [], groups: list([{ id: 1, owner: 22, ownerName: 'Other', name: 'Theirs', description: 'd' }, { id: 2, owner: 11, ownerName: 'Me', name: 'Mine', description: 'd' }]) }, form: null } }).body;
  const forms = parseHTML(html).document.querySelectorAll('form[action="?/report"]');
  expect(forms).toHaveLength(1);
  expect(forms[0].querySelector('input[name="id"]')?.getAttribute('value')).toBe('1');
  const mentorship = (await vite.ssrLoadModule('/src/routes/members/mentorship/+page.svelte')).default;
  const request = (id: number, requester: number, mentor: number) => ({ id, requester, mentor, requesterName: 'R', mentorName: 'M', message: 'hi', status: 'pending' });
  const page = render(mentorship, { props: { data: { member, mine: null, offers: list([]), requests: list([request(1, 22, 11), request(2, 11, 22)]) }, form: null } }).body;
  const reports = parseHTML(page).document.querySelectorAll('form[action="?/report"]');
  expect(reports).toHaveLength(1);
  expect(reports[0].querySelector('input[name="id"]')?.getAttribute('value')).toBe('1');
});

test('the member CMS helper allows lifecycle and moderation paths only, and not traversal', async () => {
  const { memberApi } = await vite.ssrLoadModule('/src/lib/server/member-api.ts');
  for (const path of ['/api/lifecycle/export', '/api/moderation-reports']) await (memberApi as any)(locals, path);
  for (const path of ['/api/lifecycleX/export', '/api/member-applications', '/api/member-invitations', '/api/message-outbox', '/api/data-requests', '/api/member-offboardings', '/api/lifecycle/../users']) {
    await expect((memberApi as any)(locals, path)).rejects.toMatchObject({ status: 400 });
  }
});

test('private lifecycle pages stay behind the member session', async () => {
  const hooks = await vite.ssrLoadModule('/src/hooks.server.ts');
  const response: Response = await (hooks.handle as any)({
    event: { url: new URL('http://127.0.0.1/members/account/'), route: { id: '/members/account' }, cookies: { get: () => undefined, delete: () => undefined }, locals: {} },
    resolve: async () => new Response('private', { status: 200 }),
  });
  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toContain('/auth/login');
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
