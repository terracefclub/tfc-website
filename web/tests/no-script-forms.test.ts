import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createServer, type ViteDevServer } from 'vite';
import { parseHTML } from 'linkedom';
import { createApplyGuard } from '../src/lib/server/apply-guard';

// Every form is posted the way a browser without JavaScript does it: a form content type and
// `Accept: text/html`, straight through the SvelteKit request handler (hooks, load, action, render).
// Calling an action function directly misses failures that only appear when SvelteKit re-runs `load`.
const secret = `synthetic-intake-secret-${crypto.randomUUID()}`;
const goodToken = 'A'.repeat(43);
const usedToken = 'B'.repeat(43);
let redeemed: string[] = [];
let applied: Array<Record<string, unknown>> = [];
let applyStatus = 202;
let memberCalls: Array<{ path: string; method: string }> = [];
let nextNonce = '';
let nextChallenge = '';
let pair: Awaited<ReturnType<typeof generateKeyPair>>;
let jwk: Awaited<ReturnType<typeof exportJWK>>;
let issuer = '';
const saved = { ...process.env };
const emptyPage = { docs: [], page: 1, totalPages: 1, totalDocs: 0, hasNextPage: false, hasPrevPage: false };

const mock = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
  const path = new URL(request.url).pathname;
  if (path.endsWith('/.well-known/openid-configuration')) return Response.json({ issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/jwks`, revocation_endpoint: `${issuer}/revoke`, end_session_endpoint: `${issuer}/logout`, response_types_supported: ['code'], subject_types_supported: ['public'], id_token_signing_alg_values_supported: ['RS256'], code_challenge_methods_supported: ['S256'] });
  if (path.endsWith('/jwks')) return Response.json({ keys: [jwk] });
  if (path.endsWith('/revoke')) return new Response(null);
  if (path.endsWith('/token')) {
    const body = new URLSearchParams(await request.text());
    if (createHash('sha256').update(body.get('code_verifier') ?? '').digest('base64url') !== nextChallenge) return Response.json({ error: 'invalid_grant' }, { status: 400 });
    const idToken = await new SignJWT({ nonce: nextNonce }).setProtectedHeader({ alg: 'RS256', kid: 'fixture' }).setIssuer(issuer).setSubject('synthetic-member').setAudience('terrace-web').setIssuedAt().setExpirationTime('1m').sign(pair.privateKey);
    return Response.json({ access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', token_type: 'Bearer', expires_in: 60, id_token: idToken });
  }
  if (path === '/api/lifecycle/apply') { const body = await request.json() as Record<string, unknown>; if (applyStatus === 202) applied.push(body); return Response.json({ ok: true }, { status: applyStatus }); }
  if (path === '/api/lifecycle/redeem') {
    const { token } = await request.json() as { token: string };
    if (token === goodToken && !redeemed.includes(token)) { redeemed.push(token); return Response.json({ valid: true }); }
    return Response.json({ valid: false }, { status: 404 });
  }
  if (path.startsWith('/api/')) {
    if (request.headers.get('authorization') !== 'Bearer synthetic-access') return new Response(null, { status: 401 });
    memberCalls.push({ path, method: request.method });
    if (path === '/api/members/me') return Response.json({ user: { collection: 'members', id: 4, subject: 'synthetic-member', displayName: 'Synthetic Terran', roles: ['alumni'] } });
    if (path === '/api/lifecycle/erasure') return Response.json({ confirmationCode: 'synthetic-code', expiresAt: '2030-01-01T00:00:00Z' });
    return Response.json(request.method === 'GET' ? emptyPage : { doc: { id: 1 } });
  }
  return new Response(null, { status: 404 });
} });

interface App { server: ViteDevServer; origin: string }
const apps: App[] = [];
async function start(): Promise<App> {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'silent' });
  await server.listen();
  const app = { server, origin: `http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}` };
  apps.push(app);
  return app;
}
let app: App;
let cookie = '';

beforeAll(async () => {
  pair = await generateKeyPair('RS256');
  jwk = { ...await exportJWK(pair.publicKey), kid: 'fixture', alg: 'RS256', use: 'sig' };
  issuer = `http://127.0.0.1:${mock.port}/realms/terrace`;
  Object.assign(process.env, { LIFECYCLE_INTAKE_SECRET: secret, CMS_ORIGIN: `http://127.0.0.1:${mock.port}`, MEMBER_AUTH_ISSUER: issuer, MEMBER_AUTH_CLIENT_ID: 'terrace-web', MEMBER_AUTH_CLIENT_SECRET: 'synthetic-test-secret' });
  app = await start();
  process.env.MEMBER_AUTH_ORIGIN = app.origin;
  const login = await fetch(`${app.origin}/auth/login`, { redirect: 'manual' });
  const authorization = new URL(login.headers.get('location')!);
  nextNonce = authorization.searchParams.get('nonce')!;
  nextChallenge = authorization.searchParams.get('code_challenge')!;
  const transaction = login.headers.getSetCookie().find((value) => value.startsWith('terrace_login='))!.split(';')[0];
  const callback = await fetch(`${app.origin}/auth/callback?code=synthetic-code&state=${authorization.searchParams.get('state')}`, { headers: { Cookie: transaction }, redirect: 'manual' });
  cookie = callback.headers.getSetCookie().find((value) => value.startsWith('terrace_member='))!.split(';')[0];
}, 60000);
afterAll(async () => {
  for (const item of apps) await item.server.close();
  mock.stop(true);
  for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
  Object.assign(process.env, saved);
});

async function post(target: App, path: string, fields: Record<string, string>, headers: Record<string, string> = {}) {
  const response = await fetch(`${target.origin}${path}`, {
    method: 'POST', redirect: 'manual', body: new URLSearchParams(fields),
    headers: { Accept: 'text/html', Origin: target.origin, ...headers },
  });
  const html = await response.text();
  return { response, html, document: parseHTML(html).document };
}
const clientAddress = '127.0.0.1';
/** A token the server accepts as genuinely issued to this client, aged so the minimum fill time has passed. */
const issued = (age = 10_000, from = clientAddress) => createApplyGuard(() => secret, { now: () => Date.now() - age }).issue(from);
const application = (token: string, extra: Record<string, string> = {}) => ({ t: token, name: 'Pat Terran', affiliation: 'alumni', classYear: '2004', contactEmail: 'pat@example.invalid', note: 'Hello', website: '', ...extra });

describe('/apply/ without JavaScript', () => {
  test('a valid application stores once and shows the success page, with no stored values echoed', async () => {
    const before = applied.length;
    const { response, html, document } = await post(app, '/apply/', application(issued()));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(document.querySelector('.intake-done[role="status"]')!.textContent).toContain('Your request was received');
    expect(html).not.toContain('Pat Terran');
    expect(html).not.toContain('pat@example.invalid');
    expect(applied.length).toBe(before + 1);
    expect(applied.at(-1)).toMatchObject({ name: 'Pat Terran', contactEmail: 'pat@example.invalid' });
  });
  test('a spent token is treated as a script and nothing more is stored', async () => {
    const token = issued();
    await post(app, '/apply/', application(token));
    const before = applied.length;
    const { response, document } = await post(app, '/apply/', application(token));
    expect(response.status).toBe(200);
    expect(document.querySelector('.intake-done')).not.toBeNull();
    expect(applied.length).toBe(before);
  });
  test('validation failures return 400 with inline errors and preserved values', async () => {
    const before = applied.length;
    const { response, document } = await post(app, '/apply/', application(issued(), { name: '', classYear: '19x4', contactEmail: 'not-an-email', note: 'Keep this text' }));
    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(document.querySelector('.intake-alert[role="alert"]')!.textContent).toContain('highlighted fields');
    for (const id of ['name', 'classYear', 'contactEmail']) expect(document.querySelector(`#apply-${id}-error`)).not.toBeNull();
    expect(document.querySelector('#apply-classYear')!.getAttribute('value')).toBe('19x4');
    expect(document.querySelector('#apply-note')!.textContent).toBe('Keep this text');
    expect(applied.length).toBe(before);
  });
  test('a failed intake keeps the visitor on the form with their values', async () => {
    applyStatus = 400;
    try {
      const { response, document } = await post(app, '/apply/', application(issued()));
      expect(response.status).toBe(400);
      expect(document.querySelector('.intake-alert')!.textContent).toContain('check the fields');
      expect(document.querySelector('#apply-name')!.getAttribute('value')).toBe('Pat Terran');
    } finally { applyStatus = 202; }
  });
  test('honeypot keeps the fake success and stores nothing', async () => {
    const guards = await start();
    const before = applied.length;
    const { response, document } = await post(guards, '/apply/', application(issued(), { website: 'http://spam.invalid' }));
    expect(response.status).toBe(200);
    expect(document.querySelector('.intake-done')).not.toBeNull();
    expect(applied.length).toBe(before);
  });
  test('too fast and a changed network show the reload message with a 400', async () => {
    const guards = await start();
    const fast = await post(guards, '/apply/', application(issued(0)));
    expect(fast.response.status).toBe(400);
    expect(fast.document.querySelector('.intake-alert')!.textContent).toContain('reload the page');
    const moved = await post(guards, '/apply/', application(issued(10_000, '203.0.113.9')));
    expect(moved.response.status).toBe(400);
    expect(moved.document.querySelector('.intake-alert')!.textContent).toContain('connection changed');
    expect(moved.document.querySelector('#apply-name')!.getAttribute('value')).toBe('Pat Terran');
  });
  test('the page itself renders with the same headers and a signed token', async () => {
    const response = await fetch(`${app.origin}/apply/`, { headers: { Accept: 'text/html' } });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(parseHTML(await response.text()).document.querySelector('input[name="t"]')!.getAttribute('value')).toMatch(/^\d+\.[\w-]+\.[\w-]+\.[\w-]+$/);
  });
  test('rate limited submissions return 429 with the limited message and preserved values', async () => {
    const limited = await start();
    let last = { response: new Response(), document: parseHTML('').document };
    for (let index = 0; index < 6; index++) last = await post(limited, '/apply/', application(issued(), { name: '' }));
    expect(last.response.status).toBe(429);
    expect(last.document.querySelector('.intake-alert')!.textContent).toContain('Too many applications');
    expect(last.document.querySelector('#apply-note')!.textContent).toBe('Hello');
  }, 30000);
  test('a closed form answers 503 on submit and shows the closed state', async () => {
    const closed = await start();
    const token = issued();
    delete process.env.LIFECYCLE_INTAKE_SECRET;
    try {
      const { response, document } = await post(closed, '/apply/', application(token));
      expect(response.status).toBe(503);
      expect(document.querySelector('.intake-card')!.textContent).toContain('Not open yet');
      const page = await fetch(`${closed.origin}/apply/`, { headers: { Accept: 'text/html' } });
      expect(page.status).toBe(200);
      expect(await page.text()).toContain('Not open yet');
    } finally { process.env.LIFECYCLE_INTAKE_SECRET = secret; }
  }, 30000);
});

describe('/join/ without JavaScript', () => {
  const policy = (response: Response) => {
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  };
  test('the page renders with its privacy headers', async () => {
    const response = await fetch(`${app.origin}/join/`, { headers: { Accept: 'text/html' } });
    expect(response.status).toBe(200);
    policy(response);
  });
  test('a valid token is consumed exactly once and shows the accepted state', async () => {
    const { response, html, document } = await post(app, '/join/', { token: goodToken });
    expect(response.status).toBe(200);
    policy(response);
    expect(document.querySelector('.intake-done[role="status"]')!.textContent).toContain('Invitation accepted');
    expect(html).not.toContain(goodToken);
    expect(redeemed).toEqual([goodToken]);
  });
  test('the same token again is refused with a paste field and is not consumed twice', async () => {
    const { response, document } = await post(app, '/join/', { token: goodToken });
    expect(response.status).toBe(404);
    policy(response);
    expect(document.querySelector('.intake-alert')!.textContent).toContain('not valid');
    expect(document.querySelector('input[name="token"]')).not.toBeNull();
    expect(redeemed).toEqual([goodToken]);
  });
  test('an unknown or malformed token is refused', async () => {
    for (const token of [usedToken, 'short', '']) {
      const { response, document } = await post(app, '/join/', { token });
      expect(response.status).toBe(404);
      expect(document.querySelector('.intake-error')!.textContent).toContain('not accepted');
    }
  });
  test('an unavailable service answers 503 without using the token up', async () => {
    const before = redeemed.length;
    delete process.env.LIFECYCLE_INTAKE_SECRET;
    try {
      const { response, document } = await post(app, '/join/', { token: 'C'.repeat(43) });
      expect(response.status).toBe(503);
      expect(document.querySelector('.intake-alert')!.textContent).toContain('has not been used up');
    } finally { process.env.LIFECYCLE_INTAKE_SECRET = secret; }
    expect(redeemed.length).toBe(before);
  });
});

describe('member forms without JavaScript', () => {
  const memberPost = (path: string, fields: Record<string, string>) => post(app, path, fields, { Cookie: cookie });
  const cases: Array<[string, Record<string, string>, string]> = [
    ['/members/profile/', { displayName: 'Pat', directoryVisible: 'on' }, 'Profile saved'],
    ['/members/stories/?/share', { title: 'T', body: 'B', audience: 'community' }, 'Your story is shared'],
    ['/members/stories/?/edit', { id: '1', title: 'T', body: 'B', audience: 'community' }, 'Your story is updated'],
    ['/members/stories/?/remove', { id: '1' }, 'Your story is removed'],
    ['/members/stories/?/report', { id: '1', reason: 'other' }, 'Your report was sent'],
    ['/members/groups/?/create', { name: 'G', description: 'D' }, 'Your group is open'],
    ['/members/groups/?/edit', { group: '1', name: 'G', description: 'D' }, 'Your group is updated'],
    ['/members/groups/?/join', { group: '1' }, 'You joined the group'],
    ['/members/groups/?/leave', { membership: '1' }, 'You left the group'],
    ['/members/groups/?/report', { id: '1', reason: 'other' }, 'Your report was sent'],
    ['/members/mentorship/?/offer', { displayName: 'Pat', optIn: 'on' }, 'open to mentorship'],
    ['/members/mentorship/?/request', { mentor: '2', message: 'Hello' }, 'Your request is saved'],
    ['/members/mentorship/?/respond', { id: '1', status: 'accepted' }, 'Your response is saved'],
    ['/members/mentorship/?/withdraw', { id: '1' }, 'Your request is withdrawn'],
    ['/members/mentorship/?/report', { id: '1', reason: 'other' }, 'Your report was sent'],
  ];
  for (const [path, fields, expected] of cases) {
    test(`${path} renders its result with a 200`, async () => {
      const { response, html } = await memberPost(path, fields);
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(response.headers.get('x-robots-tag')).toContain('noindex');
      expect(html).toContain(expected);
    });
  }
  test('a rejected member form returns its failure status and message', async () => {
    const { response, html } = await memberPost('/members/groups/?/create', { name: '', description: '' });
    expect(response.status).toBe(400);
    expect(html).toContain('Please check the fields');
  });
  test('the export download is a private attachment', async () => {
    const response = await fetch(`${app.origin}/members/account/export`, { method: 'POST', headers: { Cookie: cookie, Origin: app.origin }, redirect: 'manual' });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('attachment');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  test('/members/account requests erasure, and refuses an unconfirmed erase', async () => {
    const step = await memberPost('/members/account/?/requestErasure', {});
    expect(step.response.status).toBe(200);
    expect(step.html).toContain('Step 2 of 2');
    const wrong = await memberPost('/members/account/?/confirmErasure', { code: 'synthetic-code', confirm: 'no' });
    expect(wrong.response.status).toBe(400);
    expect(wrong.html).toContain('Type');
    const confirmed = await memberPost('/members/account/?/confirmErasure', { code: 'synthetic-code', confirm: 'Erase my data' });
    expect(confirmed.response.status).toBe(303);
    expect(confirmed.response.headers.get('cache-control')).toBe('private, no-store');
  });
  test('without a session a member form post is sent to sign in and calls nothing', async () => {
    const before = memberCalls.length;
    const { response } = await post(app, '/members/groups/?/create', { name: 'G', description: 'D' });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('/auth/login');
    expect(memberCalls.length).toBe(before);
  });
});
