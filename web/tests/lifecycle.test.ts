import { afterAll, beforeAll, beforeEach, expect, test } from 'bun:test';
import { createServer, type ViteDevServer } from 'vite';
import { parseHTML } from 'linkedom';
import { clientAddressConfigured, createApplyGuard, network } from '../src/lib/server/apply-guard';

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
const authEnv = { MEMBER_AUTH_ISSUER: 'http://127.0.0.1:8999/realms/terrace', MEMBER_AUTH_CLIENT_ID: 'terrace-web', MEMBER_AUTH_CLIENT_SECRET: 'synthetic', MEMBER_AUTH_ORIGIN: 'http://127.0.0.1:4999' };

beforeAll(async () => {
  process.env.CMS_ORIGIN = `http://127.0.0.1:${api.port}`;
  process.env.LIFECYCLE_INTAKE_SECRET = secret;
  Object.assign(process.env, authEnv);
  vite = await createServer({ server: { middlewareMode: true }, logLevel: 'silent' });
  render = (await vite.ssrLoadModule('svelte/server')).render;
});
afterAll(async () => {
  for (const name of Object.keys(authEnv)) delete process.env[name];
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
  const token = instance.issue('a');
  advance(10_000);
  expect(instance.check({ token, honeypot: '', client: 'a' })).toBe('ok');
  expect(instance.check({ token, honeypot: 'http://spam.invalid', client: 'a' })).toBe('bot');
  expect(instance.check({ token, honeypot: null, client: 'a' })).toBe('ok');
  expect(instance.check({ token, honeypot: undefined, client: 'a' })).toBe('ok');
});

test('the guard enforces a minimum fill time and a short token life', () => {
  const { instance, advance } = guard();
  const token = instance.issue('a');
  advance(500);
  expect(instance.check({ token, honeypot: '', client: 'a' })).toBe('too-fast');
  advance(10_000);
  expect(instance.check({ token, honeypot: '', client: 'a' })).toBe('ok');
  advance(31 * 60_000);
  expect(instance.check({ token, honeypot: '', client: 'a' })).toBe('expired');
});

test('a token is bound to the client network; a visitor whose address moved is told, not dropped', () => {
  const { instance, advance } = guard();
  const token = instance.issue('203.0.113.7');
  advance(10_000);
  expect(instance.check({ token, honeypot: '', client: '203.0.113.200' })).toBe('ok'); // same /24
  expect(instance.check({ token, honeypot: '', client: '198.51.100.7' })).toBe('moved'); // a genuine token from elsewhere
  const v6 = instance.issue('2001:db8:1:2:aaaa::1');
  advance(10_000);
  expect(instance.check({ token: v6, honeypot: '', client: '2001:db8:1:2:bbbb::9' })).toBe('ok'); // same /64
  expect(instance.check({ token: v6, honeypot: '', client: '2001:db8:1:3::1' })).toBe('moved');
  // A forged token is still silently a bot, whatever the client.
  const [stamp, nonce, mac] = token.split('.');
  expect(instance.check({ token: `${stamp}.${nonce}.${mac}.${'x'.repeat(43)}`, honeypot: '', client: '198.51.100.7' })).toBe('bot');
  expect(instance.check({ token: `${stamp}.${nonce}.${'x'.repeat(43)}.${'x'.repeat(43)}`, honeypot: '', client: '203.0.113.7' })).toBe('bot');
});

test('addresses in one network share a rate-limit bucket, as they share a token', () => {
  const { instance, advance } = guard({ limit: 2 });
  const tokens = ['2001:db8:1:2::1', '2001:db8:1:2:ffff::9', '2001:db8:1:2:abcd::5'].map((client) => instance.issue(client));
  advance(10_000);
  const send = (index: number, client: string) => instance.check({ token: tokens[index], honeypot: '', client });
  expect([send(0, '2001:db8:1:2::1'), send(1, '2001:db8:1:2:ffff::9'), send(2, '2001:db8:1:2:abcd::5')]).toEqual(['ok', 'ok', 'rate-limited']);
  // A different /64 is a different bucket.
  const other = instance.issue('2001:db8:1:3::1');
  advance(10_000);
  expect(instance.check({ token: other, honeypot: '', client: '2001:db8:1:3::1' })).toBe('ok');
});

test('client networks normalise IPv4, IPv4-mapped and abbreviated IPv6 addresses', () => {
  expect(network('203.0.113.99')).toBe('203.0.113.0/24');
  expect(network('::ffff:203.0.113.99')).toBe('203.0.113.0/24');
  expect(network('2001:db8::1')).toBe('2001:0db8:0000:0000::/64');
  expect(network('2001:DB8:0:0:1:2:3:4')).toBe('2001:0db8:0000:0000::/64');
  expect(network('::ffff:cb00:7163')).toBe('203.0.113.0/24'); // hex-form IPv4-mapped
  expect(network('0:0:0:0:0:ffff:cb00:71ff')).toBe('203.0.113.0/24');
  expect(network('::ffff:cb00:7163')).not.toBe(network('::ffff:c633:6407'));
  expect(network('::1')).toBe('0000:0000:0000:0000::/64');
  expect(network('apply-test-3')).toBe('apply-test-3');
});

test('a spent token cannot be replayed, but a rejected attempt does not spend it', () => {
  const { instance, advance } = guard();
  const token = instance.issue('a');
  advance(10_000);
  expect(instance.check({ token, honeypot: '', client: 'a' })).toBe('ok');
  expect(instance.check({ token, honeypot: '', client: 'a' })).toBe('ok'); // not yet accepted, so a corrected resubmission works
  instance.spend(token);
  expect(instance.check({ token, honeypot: '', client: 'a' })).toBe('bot');
});

test('forged, tampered, future-dated or missing timing tokens are treated as bots', () => {
  const { instance, advance } = guard();
  const token = instance.issue('a');
  advance(10_000);
  const [stamp, nonce, mac, base] = token.split('.');
  const other = createApplyGuard(() => `other-${secret}`, { now: () => 1_800_000_000_000 }).issue('a');
  for (const bad of [undefined, null, 42, '', 'x', `${stamp}`, `${stamp}.${nonce}`, `${stamp}.${nonce}.`, `${Number(stamp) - 20_000}.${nonce}.${mac}.${base}`, `${stamp}.${nonce}.${mac}`, `${stamp}.${nonce}.${mac}.${base}.extra`, `${stamp}.short.${mac}.${base}`, other, `${Number(stamp) + 99_000_000}.${nonce}.${mac}.${base}`]) {
    expect(instance.check({ token: bad, honeypot: '', client: `c-${String(bad)}` })).toBe('bot');
  }
});

test('the guard rate-limits per client and overall, resets after the window, and bounds memory', () => {
  const { instance, advance } = guard({ limit: 3, globalLimit: 5, maxClients: 2, windowMs: 60_000 });
  const tokens: Record<string, string> = Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((name) => [name, instance.issue(name)]));
  advance(10_000);
  const send = (client: string) => instance.check({ token: tokens[client], honeypot: '', client });
  expect([send('a'), send('a'), send('a'), send('a')]).toEqual(['ok', 'ok', 'ok', 'rate-limited']);
  expect(send('b')).toBe('ok');
  expect(send('b')).toBe('ok');
  expect(send('c')).toBe('rate-limited'); // overall limit of five reached
  advance(61_000);
  expect(send('a')).toBe('ok');
  for (const client of ['d', 'e', 'f', 'g']) send(client);
});

test('client addresses behind a proxy must be configured before the form opens in production', () => {
  expect(clientAddressConfigured({ NODE_ENV: 'production' })).toBe(false);
  expect(clientAddressConfigured({ NODE_ENV: 'production', ADDRESS_HEADER: 'X-Forwarded-For', XFF_DEPTH: '1' })).toBe(true);
  expect(clientAddressConfigured({ NODE_ENV: 'production', LIFECYCLE_DIRECT_CLIENTS: '1' })).toBe(true);
  expect(clientAddressConfigured({})).toBe(true);
});

// ---- apply route --------------------------------------------------------------------------
async function applyModule() { return await vite.ssrLoadModule('/src/routes/apply/+page.server.ts'); }
const sent = (values: Record<string, string>, headers: Record<string, string> = {}) => new Request('http://127.0.0.1/apply', { method: 'POST', body: new URLSearchParams(values), headers });
const headersOf = () => ({ setHeaders: () => undefined });
// Tokens are bound to a client, so each test client gets its own, issued once and aged by one real wait.
const slots = Array.from({ length: 12 }, (_, index) => `apply-test-${index}`);
let issued: Promise<Record<string, string>> | undefined;
async function ready(client: string, extra: Record<string, string> = {}) {
  issued ??= (async () => {
    const { load } = await applyModule();
    const tokens = Object.fromEntries(slots.map((slot) => [slot, ((load as any)({ setHeaders: () => undefined, getClientAddress: () => slot }) as any).token as string]));
    await Bun.sleep(3100);
    return tokens;
  })();
  return { t: (await issued)[client], name: 'Pat Terran', affiliation: 'alumni', classYear: '2004', contactEmail: 'pat@terrace.invalid', note: 'Hello.', website: '', ...extra };
}
const run = async (client: string, values: Record<string, string>, headers: Record<string, string> = {}) => ((await applyModule()).actions as any).default({ request: sent(values, headers), getClientAddress: () => client, ...headersOf() });

test('a valid application reaches the CMS with the secret and only the fields the review needs', async () => {
  respond = () => Response.json({ received: true }, { status: 202 });
  const result: any = await run(slots[0], await ready(slots[0]));
  expect(result).toEqual({ received: true });
  expect(calls).toHaveLength(1);
  expect(calls[0].path).toBe('/api/lifecycle/apply');
  expect(calls[0].headers.get('x-terrace-intake')).toBe(secret);
  expect(calls[0].headers.get('authorization')).toBeNull();
  expect(calls[0].body).toEqual({ name: 'Pat Terran', affiliation: 'alumni', classYear: 2004, contactEmail: 'pat@terrace.invalid', note: 'Hello.' });
  // The accepted token is spent: replaying it is dropped without reaching the CMS.
  calls.length = 0;
  expect(await run(slots[0], await ready(slots[0]))).toEqual({ received: true });
  expect(calls).toHaveLength(0);
}, 15_000);

test('the honeypot, a too-fast submit, a stolen token and invalid input never reach the CMS', async () => {
  const { load } = await applyModule();
  const values = await ready(slots[1]);
  expect(await run(slots[1], { ...values, website: 'https://spam.invalid' })).toEqual({ received: true }); // silently dropped
  const fresh = (load as any)({ setHeaders: () => undefined, getClientAddress: () => slots[1] }).token;
  expect(((await run(slots[1], { ...values, t: fresh })) as any).status).toBe(400); // too fast
  expect(((await run(slots[2], values)) as any).status).toBe(400); // a genuine token from another network: a visible soft error, not fake success
  for (const bad of [{ name: '' }, { affiliation: 'staff' }, { classYear: '1800' }, { classYear: 'abcd' }, { contactEmail: 'nope' }, { note: 'x'.repeat(1001) }, { name: 'n'.repeat(121) }, { t: 'forged' }]) {
    const result: any = await run(slots[1], { ...values, ...bad });
    expect([400, 429].includes(result.status) || result.received === true).toBe(true); // 429 once this client's allowance is used
  }
  expect(calls).toHaveLength(0);
}, 15_000);

test('a corrected resubmission after a validation error still works', async () => {
  respond = () => Response.json({ received: true }, { status: 202 });
  const values = await ready(slots[3]);
  expect(((await run(slots[3], { ...values, contactEmail: 'nope' })) as any).status).toBe(400);
  expect(await run(slots[3], values)).toEqual({ received: true });
  expect(calls).toHaveLength(1);
}, 15_000);

test('rate limiting stops a client after the allowed number of attempts, whatever proxy headers say', async () => {
  respond = () => Response.json({ received: true }, { status: 202 });
  const values = await ready(slots[4]);
  const statuses: unknown[] = [];
  for (let attempt = 0; attempt < 7; attempt++) {
    // A forged X-Forwarded-For must not give each request a fresh identity: only getClientAddress counts.
    const result: any = await run(slots[4], { ...values, contactEmail: 'nope' }, { 'x-forwarded-for': `203.0.113.${attempt}`, forwarded: `for=198.51.100.${attempt}`, 'x-real-ip': `192.0.2.${attempt}` });
    statuses.push(result.status ?? 'ok');
  }
  expect(statuses).toEqual([400, 400, 400, 400, 400, 429, 429]);
  expect(calls).toHaveLength(0);
}, 15_000);

test('an unconfigured or failing CMS fails closed with a generic message and no detail', async () => {
  const { load } = await applyModule();
  const values = await ready(slots[5]);
  respond = () => new Response('private upstream detail: db password', { status: 500 });
  const failed: any = await run(slots[5], values);
  expect(failed.status).toBe(503);
  expect(JSON.stringify(failed)).not.toContain('private upstream');
  respond = () => new Response(null, { status: 403 });
  expect(((await run(slots[5], values)) as any).status).toBe(503);
  delete process.env.LIFECYCLE_INTAKE_SECRET;
  try {
    expect((load as any)({ setHeaders: () => undefined, getClientAddress: () => slots[5] })).toEqual({ open: false, token: '' });
    expect(((await run(slots[5], values)) as any).status).toBe(503);
  } finally { process.env.LIFECYCLE_INTAKE_SECRET = secret; }
  // Production without a configured client-address header closes the form instead of sharing one bucket.
  const oldEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    expect((load as any)({ setHeaders: () => undefined, getClientAddress: () => slots[5] })).toEqual({ open: false, token: '' });
    calls.length = 0;
    const closed: any = await run(slots[5], values);
    expect(closed.status).toBe(503); // the action refuses too, not only the page
    expect(calls).toHaveLength(0);
    process.env.ADDRESS_HEADER = 'X-Forwarded-For';
    expect((load as any)({ setHeaders: () => undefined, getClientAddress: () => slots[5] }).open).toBe(true);
  } finally { process.env.NODE_ENV = oldEnv; delete process.env.ADDRESS_HEADER; }
}, 15_000);

test('the application page renders a hidden honeypot and the page is not indexable or cacheable', async () => {
  const { load } = await applyModule();
  const headers: Record<string, string> = {};
  const data = (load as any)({ setHeaders: (value: Record<string, string>) => Object.assign(headers, value), getClientAddress: () => 'page' });
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
async function joinModule() { return await vite.ssrLoadModule('/src/routes/join/+page.server.ts'); }
const joinRequest = (values: Record<string, string>) => new Request('http://127.0.0.1/join/', { method: 'POST', body: new URLSearchParams(values) });

test('the token is redeemed once from a POST body, never from the URL, with referrer and cache protection', async () => {
  const { load, actions } = await joinModule();
  const headers: Record<string, string> = {};
  expect(await (load as any)({ setHeaders: (value: Record<string, string>) => Object.assign(headers, value) })).toEqual({});
  expect(headers['referrer-policy']).toBe('no-referrer');
  expect(headers['cache-control']).toBe('private, no-store');
  expect(calls).toHaveLength(0); // loading the page, as a link scanner would, uses nothing up
  respond = () => Response.json({ valid: true, role: 'alumni', name: 'Pat' });
  expect(await (actions as any).default({ request: joinRequest({ token }), setHeaders: () => undefined })).toEqual({ state: 'accepted' });
  expect(calls[0].body).toEqual({ token, consume: true });
  expect(calls[0].path).toBe('/api/lifecycle/redeem');
  expect(calls[0].headers.get('x-terrace-intake')).toBe(secret);
  respond = () => Response.json({ valid: false }, { status: 404 });
  expect(((await (actions as any).default({ request: joinRequest({ token }), setHeaders: () => undefined })) as any).status).toBe(404);
});

test('malformed tokens never reach the CMS; outages are not reported as invalid links', async () => {
  const { actions } = await joinModule();
  for (const bad of ['short', 'A'.repeat(44), '../../etc/passwd', 'A'.repeat(42) + '!', '']) {
    expect(((await (actions as any).default({ request: joinRequest({ token: bad }), setHeaders: () => undefined })) as any).status).toBe(404);
  }
  expect(((await (actions as any).default({ request: joinRequest({}), setHeaders: () => undefined })) as any).status).toBe(404);
  expect(calls).toHaveLength(0);
  respond = () => new Response(null, { status: 500 });
  expect(((await (actions as any).default({ request: joinRequest({ token }), setHeaders: () => undefined })) as any).status).toBe(503);
});

test('the invitation page offers a paste field without script, and says what happens next', async () => {
  const component = (await vite.ssrLoadModule('/src/routes/join/+page.svelte')).default;
  const view = (form: any = null) => parseHTML(`<html><body>${render(component, { props: { data: {}, form } }).body}</body></html>`).document;
  expect(view().querySelector('input[name="token"]')).not.toBeNull();
  expect(view({ state: 'accepted' }).documentElement.textContent).toContain('operator');
  expect(view({ state: 'invalid' }).documentElement.textContent).toContain('not valid');
});

// ---- member data: export, erasure, reports ----------------------------------------------------
const exportRequest = (origin: string | null = 'http://127.0.0.1:4999') => new Request('http://127.0.0.1:4999/members/account/export', { method: 'POST', headers: origin ? { origin } : {} });
async function exportModule() { return await vite.ssrLoadModule('/src/routes/members/account/export/+server.ts'); }

test('export requires a signed-in member and forwards only that session to the CMS', async () => {
  const { POST } = await exportModule();
  for (const anonymous of [{ member: null, memberAccessToken: null }, { member, memberAccessToken: null }]) {
    await expect((POST as any)({ locals: anonymous, request: exportRequest() })).rejects.toMatchObject({ status: 401 });
  }
  expect(calls).toHaveLength(0);
  respond = () => Response.json({ format: 'terrace-member-export/1', member: { id: 11 } });
  const response: Response = await (POST as any)({ locals, request: exportRequest() });
  expect(calls[0].path).toBe('/api/lifecycle/export');
  expect(calls[0].headers.get('authorization')).toBe('Bearer synthetic-access');
  expect(calls[0].headers.get('x-terrace-intake')).toBeNull();
  expect(response.headers.get('content-disposition')).toContain('attachment');
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect((await response.json()).format).toBe('terrace-member-export/1');
});

test('export refuses a request without a matching origin before contacting the CMS', async () => {
  const { POST } = await exportModule();
  for (const origin of [null, 'https://attacker.invalid', 'http://127.0.0.1:4998']) await expect((POST as any)({ locals, request: exportRequest(origin) })).rejects.toMatchObject({ status: 403 });
  expect(calls).toHaveLength(0);
});

test('export surfaces refusals and outages without upstream detail, and allows larger files than ordinary calls', async () => {
  const { POST } = await exportModule();
  for (const [upstream, expected] of [[401, 401], [403, 403], [500, 503]] as const) {
    respond = () => new Response('private detail', { status: upstream });
    await expect((POST as any)({ locals, request: exportRequest() })).rejects.toMatchObject({ status: expected });
  }
  const big = { stories: Array.from({ length: 30 }, () => 'x'.repeat(50_000)) };
  respond = () => Response.json(big);
  expect(((await (POST as any)({ locals, request: exportRequest() })) as Response).status).toBe(200);
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
