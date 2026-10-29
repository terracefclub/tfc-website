import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import type { Cookies } from '@sveltejs/kit';
import { ExpiringStore, safeMemberReturn } from '../src/lib/server/member-session';
import { memberApi } from '../src/lib/server/member-api';
import { authSettings, beginMemberLogin, completeMemberLogin, resolveMemberSession, endMemberSession } from '../src/lib/server/member-auth';

let provider: ReturnType<typeof Bun.serve>;
let issuer: string;
let pair: Awaited<ReturnType<typeof generateKeyPair>>;
let jwk: Awaited<ReturnType<typeof exportJWK>>;
let nextNonce = '';
let nextChallenge = '';
let malformed: '' | 'nonce' | 'signature' | 'audience' | 'expired' = '';
let approved = true;
let revoked = 0;
let nextExpiry = 60;
let refreshed = 0;
let upstreamStatus = 200;
let largeBody = false;
let redirected = false;
const previous = { ...process.env };
const authOrigin = 'https://members.terrace.invalid';
function jar() {
  const values = new Map<string, string>();
  const options = new Map<string, Record<string, unknown>>();
  return { values, options, cookies: {
    get: (name: string) => values.get(name),
    set: (name: string, value: string, config: Record<string, unknown>) => { values.set(name, value); options.set(name, config); },
    delete: (name: string) => { values.delete(name); },
  } as unknown as Cookies };
}
async function begin(cookies: Cookies) {
  const location = new URL(await beginMemberLogin(cookies, '/members/stories/?page=2'));
  nextNonce = location.searchParams.get('nonce')!;
  nextChallenge = location.searchParams.get('code_challenge')!;
  return new URL(`${authOrigin}/auth/callback?code=synthetic-code&state=${location.searchParams.get('state')}`);
}
beforeAll(async () => {
  pair = await generateKeyPair('RS256');
  jwk = { ...await exportJWK(pair.publicKey), kid: 'fixture', alg: 'RS256', use: 'sig' };
  provider = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path.endsWith('/.well-known/openid-configuration')) return Response.json({ issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/jwks`, revocation_endpoint: `${issuer}/revoke`, end_session_endpoint: `${issuer}/logout`, response_types_supported: ['code'], subject_types_supported: ['public'], id_token_signing_alg_values_supported: ['RS256'], code_challenge_methods_supported: ['S256'] });
    if (path.endsWith('/jwks')) return Response.json({ keys: [jwk] });
    if (path.endsWith('/revoke')) { revoked++; return new Response(null); }
    if (path.endsWith('/token')) {
      const body = new URLSearchParams(await request.text());
      if (body.get('grant_type') === 'refresh_token') { refreshed++; return Response.json({ access_token: 'synthetic-refreshed', refresh_token: 'synthetic-rotation', token_type: 'Bearer', expires_in: 60 }); }
      if (createHash('sha256').update(body.get('code_verifier') ?? '').digest('base64url') !== nextChallenge) return Response.json({ error: 'invalid_grant' }, { status: 400 });
      const token = await new SignJWT({ nonce: malformed === 'nonce' ? 'wrong-nonce' : nextNonce })
        .setProtectedHeader({ alg: 'RS256', kid: 'fixture' }).setIssuer(issuer).setSubject('synthetic-member')
        .setAudience(malformed === 'audience' ? 'other-client' : 'terrace-web').setIssuedAt()
        .setExpirationTime(malformed === 'expired' ? Math.floor(Date.now() / 1000) - 100 : '1m')
        .sign(malformed === 'signature' ? (await generateKeyPair('RS256')).privateKey : pair.privateKey);
      return Response.json({ access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', token_type: 'Bearer', expires_in: nextExpiry, id_token: token });
    }
    if (path.startsWith('/api/')) {
      if (request.headers.get('cookie') || !request.headers.get('authorization')?.startsWith('Bearer synthetic-')) return new Response(null, { status: 401 });
      if (redirected) return Response.redirect('https://untrusted.invalid', 302);
      if (largeBody) return new Response('x'.repeat(1024 * 1024 + 1));
      if (upstreamStatus !== 200) return new Response('private upstream diagnostics', { status: upstreamStatus });
      return Response.json({ user: approved ? { collection: 'members', id: 4, subject: 'synthetic-member', displayName: 'Synthetic Terran', roles: ['alumni'] } : null });
    }
    return new Response(null, { status: 404 });
  } });
  issuer = `http://127.0.0.1:${provider.port}/realms/terrace`;
  process.env.MEMBER_AUTH_ISSUER = issuer;
  process.env.MEMBER_AUTH_CLIENT_ID = 'terrace-web';
  process.env.MEMBER_AUTH_CLIENT_SECRET = 'synthetic-test-secret';
  process.env.MEMBER_AUTH_ORIGIN = authOrigin;
  process.env.CMS_ORIGIN = `http://127.0.0.1:${provider.port}`;
});
afterAll(() => { provider.stop(); for (const key of ['MEMBER_AUTH_ISSUER', 'MEMBER_AUTH_CLIENT_ID', 'MEMBER_AUTH_CLIENT_SECRET', 'MEMBER_AUTH_ORIGIN', 'CMS_ORIGIN']) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } });

test('opaque storage expires, consumes once, and caps active sessions', () => {
  let now = 1000;
  const store = new ExpiringStore<string>(100, 1, () => now);
  const id = store.put('server-only');
  expect(id).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(() => store.put('overflow')).toThrow();
  expect(store.take(id)).toBe('server-only');
  expect(store.take(id)).toBeUndefined();
  const expired = store.put('expired'); now += 101;
  expect(store.get(expired)).toBeUndefined();
  expect(store.put('new')).toBeTruthy();
});
test('return URLs stay within member space after URL normalization', () => {
  for (const path of ['https://evil.invalid', '//evil.invalid', '/members/../../admin', '/members/..%2f../admin', '/members\\evil', '/auth/login', '/members\n']) {
    expect(safeMemberReturn(path, authOrigin)).not.toContain('evil');
    if (!path.includes('%2f')) expect(safeMemberReturn(path, authOrigin)).toBe('/members/');
  }
  expect(safeMemberReturn('/members/stories/?page=2#story', authOrigin)).toBe('/members/stories/?page=2#story');
});
test('configuration is absent-safe and requires TLS outside loopback', () => {
  const saved = process.env.MEMBER_AUTH_ORIGIN;
  delete process.env.MEMBER_AUTH_ORIGIN; expect(() => authSettings()).toThrow();
  process.env.MEMBER_AUTH_ORIGIN = 'http://terrace.invalid'; expect(() => authSettings()).toThrow();
  process.env.MEMBER_AUTH_ORIGIN = saved;
});
test('authorization uses state, nonce and PKCE; cookie is opaque and protected; replay fails', async () => {
  const session = jar(); const callback = await begin(session.cookies);
  expect(nextNonce).toBeTruthy(); expect(nextChallenge).toHaveLength(43);
  expect(session.options.get('terrace_login')).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/auth', maxAge: 300 });
  expect(await completeMemberLogin(session.cookies, callback)).toBe('/members/stories/?page=2');
  expect(session.values.get('terrace_member')).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(session.options.get('terrace_member')).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
  expect((await resolveMemberSession(session.cookies))?.member.id).toBe(4);
  await expect(completeMemberLogin(session.cookies, callback)).rejects.toMatchObject({ status: 400 });
  const logout = new URL(await endMemberSession(session.cookies));
  expect(logout.searchParams.has('id_token_hint')).toBe(false);
  expect(session.values.has('terrace_member')).toBe(false);
  expect(await resolveMemberSession(session.cookies)).toBeNull();
  expect(revoked).toBeGreaterThan(0);
});
test('wrong state is rejected and consumes the transaction', async () => {
  const session = jar(); const callback = await begin(session.cookies); callback.searchParams.set('state', 'wrong');
  await expect(completeMemberLogin(session.cookies, callback)).rejects.toMatchObject({ status: 400 });
  expect(session.values.has('terrace_member')).toBe(false);
  await expect(completeMemberLogin(session.cookies, callback)).rejects.toMatchObject({ status: 400 });
});
test.each(['nonce', 'signature', 'audience', 'expired'] as const)('rejects invalid ID token %s', async (failure) => {
  malformed = failure; const session = jar(); const callback = await begin(session.cookies);
  try { await expect(completeMemberLogin(session.cookies, callback)).rejects.toMatchObject({ status: 400 }); expect(session.values.has('terrace_member')).toBe(false); }
  finally { malformed = ''; }
});
test('unapproved identities cannot obtain sessions and their refresh token is revoked', async () => {
  approved = false; const session = jar(); const callback = await begin(session.cookies); const before = revoked;
  try { await expect(completeMemberLogin(session.cookies, callback)).rejects.toMatchObject({ status: 403 }); expect(revoked).toBe(before + 1); expect(session.values.has('terrace_member')).toBe(false); }
  finally { approved = true; }
});
test('near-expiry sessions refresh once and removal of approval ends the session', async () => {
  nextExpiry = 1; const session = jar(); const callback = await begin(session.cookies); await completeMemberLogin(session.cookies, callback); nextExpiry = 60;
  const before = refreshed;
  const results = await Promise.all([resolveMemberSession(session.cookies), resolveMemberSession(session.cookies)]);
  expect(results.every(value => value?.member.id === 4)).toBe(true); expect(refreshed).toBe(before + 1);
  approved = false;
  try { expect(await resolveMemberSession(session.cookies)).toBeNull(); expect(session.values.has('terrace_member')).toBe(false); }
  finally { approved = true; }
});
test('CMS helper rejects unapproved routes and normalization escapes', async () => {
  for (const path of ['/api/users', '/api/members/../users', '/api/members/%2e%2e/users', '//evil.invalid/api/members', '/api/members\\..\\users']) {
    await expect(memberApi({ memberAccessToken: 'synthetic-access' }, path)).rejects.toMatchObject({ status: 400 });
  }
  await expect(memberApi({ memberAccessToken: null }, '/api/member-stories')).rejects.toMatchObject({ status: 401 });
  expect(await memberApi({ memberAccessToken: 'synthetic-access' }, '/api/member-stories', { headers: { Cookie: 'must-not-be-forwarded' } })).toHaveProperty('user');
});
test('CMS helper bounds responses, rejects redirects and sanitizes upstream failures', async () => {
  const call = () => memberApi({ memberAccessToken: 'synthetic-access' }, '/api/members/me');
  for (const status of [401, 403, 422, 429, 500]) { upstreamStatus = status; await expect(call()).rejects.toMatchObject({ status: status === 500 ? 503 : status, message: 'The member service could not complete this request.' }); }
  upstreamStatus = 200;
  largeBody = true; await expect(call()).rejects.toMatchObject({ status: 503 }); largeBody = false;
  redirected = true; await expect(call()).rejects.toMatchObject({ status: 503 }); redirected = false;
});

test('explicit account switching ends the prior local session and creates a fresh forced login', async () => {
  const session = jar();
  const callback = await begin(session.cookies);
  await completeMemberLogin(session.cookies, callback);
  const ordinary = new URL(await beginMemberLogin(session.cookies, '/members/'));
  expect(ordinary.searchParams.has('prompt')).toBe(false);
  const previousTransaction = session.values.get('terrace_login');
  const before = revoked;
  const switched = new URL(await beginMemberLogin(session.cookies, '/members/', true));
  expect(switched.searchParams.get('prompt')).toBe('login');
  for (const key of ['state', 'nonce', 'code_challenge']) expect(switched.searchParams.get(key)).not.toBe(ordinary.searchParams.get(key));
  expect(session.values.get('terrace_login')).not.toBe(previousTransaction);
  expect(session.values.has('terrace_member')).toBe(false);
  expect(await resolveMemberSession(session.cookies)).toBeNull();
  expect(revoked).toBe(before + 1);
});

test('denied HTTP callbacks show generic account recovery without exposing authentication material', async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'silent' });
  await server.listen();
  const origin = `http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}`;
  process.env.MEMBER_AUTH_ORIGIN = origin;
  approved = false;
  try {
    const login = await fetch(`${origin}/auth/login`, { redirect: 'manual' });
    expect(login.status).toBe(303);
    expect(login.headers.get('Referrer-Policy')).toBe('no-referrer');
    const authorization = new URL(login.headers.get('location')!);
    expect(authorization.searchParams.has('prompt')).toBe(false);
    nextNonce = authorization.searchParams.get('nonce')!;
    nextChallenge = authorization.searchParams.get('code_challenge')!;
    const cookie = login.headers.getSetCookie().find(value => value.startsWith('terrace_login='))!.split(';')[0];
    const callback = await fetch(`${origin}/auth/callback?code=synthetic-code&state=${authorization.searchParams.get('state')}`, { headers: { Cookie: cookie, Accept: 'text/html' } });
    const html = await callback.text();
    expect(callback.status).toBe(403);
    expect(callback.headers.get('Cache-Control')).toBe('private, no-store');
    expect(callback.headers.get('Referrer-Policy')).toBe('strict-origin');
    expect(html).toContain('This account needs Terrace approval');
    expect(html).toContain('method="POST" action="/auth/login"');
    for (const sensitive of ['synthetic-code', authorization.searchParams.get('state')!, 'synthetic-access', 'synthetic-refresh', 'synthetic-test-secret', 'private upstream diagnostics']) expect(html).not.toContain(sensitive);
    const retry = await fetch(`${origin}/auth/login`, { method: 'POST', headers: { Origin: origin }, redirect: 'manual' });
    expect(new URL(retry.headers.get('location')!).searchParams.get('prompt')).toBe('login');
    approved = true;
    const authorization2 = new URL(retry.headers.get('location')!);
    nextNonce = authorization2.searchParams.get('nonce')!;
    nextChallenge = authorization2.searchParams.get('code_challenge')!;
    const transactionCookie = retry.headers.getSetCookie().find(value => value.startsWith('terrace_login='))!.split(';')[0];
    const accepted = await fetch(`${origin}/auth/callback?code=synthetic-code&state=${authorization2.searchParams.get('state')}`, { headers: { Cookie: transactionCookie }, redirect: 'manual' });
    expect(accepted.status).toBe(303);
    expect(accepted.headers.get('Referrer-Policy')).toBe('no-referrer');
    const memberCookie = accepted.headers.getSetCookie().find(value => value.startsWith('terrace_member='))!.split(';')[0];
    const before = revoked;
    const getSwitch = await fetch(`${origin}/auth/login?switchAccount=1`, { headers: { Cookie: memberCookie }, redirect: 'manual' });
    expect(getSwitch.status).toBe(303);
    expect(new URL(getSwitch.headers.get('location')!).searchParams.has('prompt')).toBe(false);
    expect(getSwitch.headers.getSetCookie().some(value => value.startsWith('terrace_member='))).toBe(false);
    expect(revoked).toBe(before);
    for (const attemptedOrigin of ['https://untrusted.invalid', '']) {
      const rejected = await fetch(`${origin}/auth/login`, { method: 'POST', headers: { Cookie: memberCookie, ...(attemptedOrigin ? { Origin: attemptedOrigin } : {}) }, redirect: 'manual' });
      expect(rejected.status).toBe(403);
      expect(rejected.headers.getSetCookie().some(value => value.startsWith('terrace_member='))).toBe(false);
      expect(revoked).toBe(before);
    }
    const validSwitch = await fetch(`${origin}/auth/login`, { method: 'POST', headers: { Cookie: memberCookie, Origin: origin }, redirect: 'manual' });
    expect(validSwitch.status).toBe(303);
    expect(new URL(validSwitch.headers.get('location')!).searchParams.get('prompt')).toBe('login');
    expect(validSwitch.headers.getSetCookie().some(value => value.startsWith('terrace_member=;'))).toBe(true);
    expect(revoked).toBe(before + 1);
  } finally { approved = true; process.env.MEMBER_AUTH_ORIGIN = authOrigin; await server.close(); }
});
