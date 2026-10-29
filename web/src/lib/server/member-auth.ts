import * as oidc from 'openid-client';
import type { Cookies } from '@sveltejs/kit';
import { ExpiringStore, safeMemberReturn } from './member-session';
import { memberApi, MemberApiError } from './member-api';

const pending = new ExpiringStore<{ verifier: string; state: string; nonce: string; returnTo: string }>(5 * 60_000);
type Session = { subject: string; accessToken: string; refreshToken: string; expiresAt: number; refresh?: Promise<void> };
const sessions = new ExpiringStore<Session>(8 * 60 * 60_000);
const sessionCookie = 'terrace_member';
const loginCookie = 'terrace_login';
let clientPromise: Promise<oidc.Configuration> | undefined;

export function authSettings() {
  const issuerValue = process.env.MEMBER_AUTH_ISSUER;
  const clientId = process.env.MEMBER_AUTH_CLIENT_ID;
  const secret = process.env.MEMBER_AUTH_CLIENT_SECRET;
  const originValue = process.env.MEMBER_AUTH_ORIGIN;
  if (!issuerValue || !clientId || !secret || !originValue) throw new MemberApiError(503);
  const issuer = new URL(issuerValue);
  const origin = new URL(originValue);
  for (const url of [issuer, origin]) {
    if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === '127.0.0.1'))) throw new MemberApiError(503);
  }
  if (origin.pathname !== '/' || !/^\/realms\/[^/]+$/.test(issuer.pathname)) throw new MemberApiError(503);
  return { issuer, clientId, secret, origin: origin.origin, secure: origin.protocol === 'https:' };
}

async function client() {
  if (!clientPromise) {
    const settings = authSettings();
    clientPromise = oidc.discovery(settings.issuer, settings.clientId, { client_secret: settings.secret, id_token_signed_response_alg: 'RS256' }, oidc.ClientSecretPost(settings.secret), {
      timeout: 5,
      execute: [...(settings.issuer.protocol === 'http:' ? [oidc.allowInsecureRequests] : []), oidc.enableNonRepudiationChecks],
    }).catch(() => { clientPromise = undefined; throw new MemberApiError(503); });
  }
  return clientPromise;
}

function cookieOptions(path: string, maxAge: number) { return { path, maxAge, httpOnly: true, sameSite: 'lax' as const, secure: authSettings().secure }; }

export async function beginMemberLogin(cookies: Cookies, returnTo: string | null): Promise<string> {
  const config = await client();
  const settings = authSettings();
  const verifier = oidc.randomPKCECodeVerifier();
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  pending.delete(cookies.get(loginCookie));
  const id = pending.put({ verifier, state, nonce, returnTo: safeMemberReturn(returnTo, settings.origin) });
  cookies.set(loginCookie, id, cookieOptions('/auth', 300));
  return oidc.buildAuthorizationUrl(config, { redirect_uri: `${settings.origin}/auth/callback`, scope: 'openid profile', code_challenge: await oidc.calculatePKCECodeChallenge(verifier), code_challenge_method: 'S256', state, nonce }).href;
}

async function currentMember(accessToken: string): Promise<NonNullable<App.Locals['member']>> {
  const body = await memberApi<{ user?: Record<string, unknown> }>({ memberAccessToken: accessToken }, '/api/members/me');
  const user = body.user;
  const roles = Array.isArray(user?.roles) ? user.roles.filter((role): role is 'current-member' | 'alumni' => role === 'current-member' || role === 'alumni') : [];
  if (!user || user.collection !== 'members' || !Number.isSafeInteger(user.id) || Number(user.id) <= 0 || typeof user.subject !== 'string' || typeof user.displayName !== 'string' || !roles.length) throw new MemberApiError(403);
  return { id: Number(user.id), subject: user.subject, displayName: user.displayName, roles };
}

export async function completeMemberLogin(cookies: Cookies, url: URL): Promise<string> {
  const transaction = pending.take(cookies.get(loginCookie));
  cookies.delete(loginCookie, { path: '/auth' });
  if (!transaction) throw new MemberApiError(400);
  const settings = authSettings();
  if (url.origin !== settings.origin || url.pathname !== '/auth/callback') throw new MemberApiError(400);
  const config = await client();
  let tokens: Awaited<ReturnType<typeof oidc.authorizationCodeGrant>>;
  try { tokens = await oidc.authorizationCodeGrant(config, url, { pkceCodeVerifier: transaction.verifier, expectedState: transaction.state, expectedNonce: transaction.nonce, idTokenExpected: true }); }
  catch { throw new MemberApiError(400); }
  if (!tokens.refresh_token || !tokens.expires_in || tokens.expires_in > 65) throw new MemberApiError(403);
  let subject: string;
  try {
    const member = await currentMember(tokens.access_token);
    subject = member.subject;
    if (member.subject !== tokens.claims()?.sub) throw new MemberApiError(403);
  }
  catch (failure) {
    await oidc.tokenRevocation(config, tokens.refresh_token, { token_type_hint: 'refresh_token' }).catch(() => undefined);
    throw failure;
  }
  sessions.delete(cookies.get(sessionCookie));
  const id = sessions.put({ subject, accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt: Date.now() + tokens.expires_in * 1000 });
  cookies.set(sessionCookie, id, cookieOptions('/', 8 * 60 * 60));
  return transaction.returnTo;
}

export async function resolveMemberSession(cookies: Cookies): Promise<{ member: NonNullable<App.Locals['member']>; accessToken: string } | null> {
  const id = cookies.get(sessionCookie);
  const session = sessions.get(id);
  if (!session) { if (id) cookies.delete(sessionCookie, { path: '/' }); return null; }
  try {
    if (session.expiresAt <= Date.now() + 10_000) {
      if (!session.refresh) session.refresh = (async () => {
        const tokens = await oidc.refreshTokenGrant(await client(), session.refreshToken);
        if (!tokens.expires_in || tokens.expires_in > 65 || !tokens.refresh_token) throw new MemberApiError(401);
        session.accessToken = tokens.access_token;
        session.refreshToken = tokens.refresh_token;
        session.expiresAt = Date.now() + tokens.expires_in * 1000;
      })().finally(() => { session.refresh = undefined; });
      await session.refresh;
    }
    const member = await currentMember(session.accessToken);
    if (member.subject !== session.subject) throw new MemberApiError(401);
    return { member, accessToken: session.accessToken };
  } catch (failure) {
    if (failure instanceof MemberApiError && failure.status === 503) throw failure;
    sessions.delete(id);
    cookies.delete(sessionCookie, { path: '/' });
    return null;
  }
}

export async function endMemberSession(cookies: Cookies): Promise<string> {
  const session = sessions.take(cookies.get(sessionCookie));
  cookies.delete(sessionCookie, { path: '/' });
  pending.delete(cookies.get(loginCookie));
  cookies.delete(loginCookie, { path: '/auth' });
  const config = await client();
  if (session) await oidc.tokenRevocation(config, session.refreshToken, { token_type_hint: 'refresh_token' }).catch(() => undefined);
  const settings = authSettings();
  return oidc.buildEndSessionUrl(config, { client_id: settings.clientId, post_logout_redirect_uri: `${settings.origin}/` }).href;
}
