import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type GuardResult = 'ok' | 'bot' | 'too-fast' | 'expired' | 'rate-limited';
export interface GuardOptions {
  now?: () => number;
  /** Attempts per client within the window. */
  limit?: number;
  windowMs?: number;
  /** Attempts across all clients within the window. */
  globalLimit?: number;
  /** A human needs a moment to fill the form; anything faster is a script. */
  minFillMs?: number;
  maxAgeMs?: number;
  /** Bounds memory: when this many clients are tracked the oldest windows are dropped. */
  maxClients?: number;
}

/**
 * Spam resistance for the public application form without any third-party service: a rate limit
 * (per client and overall), a hidden honeypot field, and a signed start-time token that proves how
 * long the form was open. Nothing about the visitor is stored beyond a salted hash held in memory
 * for the length of the window.
 */
export function createApplyGuard(secret: () => string, options: GuardOptions = {}) {
  const now = options.now ?? Date.now;
  const limit = options.limit ?? 5;
  const windowMs = options.windowMs ?? 60 * 60_000;
  const globalLimit = options.globalLimit ?? 60;
  const minFillMs = options.minFillMs ?? 3000;
  const maxAgeMs = options.maxAgeMs ?? 30 * 60_000;
  const maxClients = options.maxClients ?? 5000;
  const clients = new Map<string, { count: number; resets: number }>();
  let all = { count: 0, resets: 0 };
  // Tokens already used, until they would have expired anyway. A token is single use.
  const used = new Map<string, number>();
  const key = () => createHash('sha256').update(`apply-form\0${secret()}`).digest();
  // The signature covers the client too, so a token issued to one visitor is useless to another.
  const bind = (client: string) => createHash('sha256').update(client).digest('base64url').slice(0, 22);
  const mac = (stamp: string, nonce: string, client: string) => createHmac('sha256', key()).update(`${stamp}.${nonce}.${bind(client)}`).digest('base64url');

  function limited(client: string): boolean {
    const time = now();
    if (all.resets <= time) all = { count: 0, resets: time + windowMs };
    if (all.count >= globalLimit) return true;
    for (const [id, entry] of clients) if (entry.resets <= time) clients.delete(id);
    const id = createHash('sha256').update(`${client}\0${secret()}`).digest('base64url');
    const entry = clients.get(id) ?? { count: 0, resets: time + windowMs };
    if (entry.count >= limit) return true;
    if (!clients.has(id) && clients.size >= maxClients) clients.delete(clients.keys().next().value as string);
    entry.count += 1;
    all.count += 1;
    clients.set(id, entry);
    return false;
  }

  return {
    issue(client: string): string { const stamp = String(now()); const nonce = randomBytes(12).toString('base64url'); return `${stamp}.${nonce}.${mac(stamp, nonce, client)}`; },
    /** Mark a token spent once its submission was accepted, so it cannot be replayed. */
    spend(token: string): void {
      const [stamp, nonce] = token.split('.');
      const time = now();
      for (const [id, expires] of used) if (expires <= time) used.delete(id);
      if (used.size >= maxClients * 2) used.delete(used.keys().next().value as string);
      if (stamp && nonce) used.set(nonce, Number(stamp) + maxAgeMs);
    },
    check(input: { token: unknown; honeypot: unknown; client: string }): GuardResult {
      if (limited(input.client)) return 'rate-limited';
      if (typeof input.honeypot === 'string' ? input.honeypot !== '' : input.honeypot != null) return 'bot';
      if (typeof input.token !== 'string') return 'bot';
      const [stamp, nonce, signature, extra] = input.token.split('.');
      if (!stamp || !nonce || !signature || extra !== undefined || !/^\d{10,16}$/.test(stamp) || !/^[A-Za-z0-9_-]{16}$/.test(nonce)) return 'bot';
      const expected = Buffer.from(mac(stamp, nonce, input.client));
      const given = Buffer.from(signature);
      if (expected.length !== given.length || !timingSafeEqual(expected, given)) return 'bot';
      const age = now() - Number(stamp);
      if (age < 0) return 'bot';
      if (used.has(nonce)) return 'bot';
      if (age < minFillMs) return 'too-fast';
      if (age > maxAgeMs) return 'expired';
      return 'ok';
    },
  };
}

export function intakeSecret(): string {
  const value = process.env.LIFECYCLE_INTAKE_SECRET;
  if (!value || value.length < 32) throw new Error('Applications are not configured.');
  return value;
}

export const applyGuard = createApplyGuard(intakeSecret);

/**
 * Behind a proxy the socket address is the proxy's, which would put every visitor in one rate-limit
 * bucket. adapter-node reads the real address only from ADDRESS_HEADER (with XFF_DEPTH for
 * X-Forwarded-For); in production the form stays closed until that is configured, or the operator
 * states there is no proxy with LIFECYCLE_DIRECT_CLIENTS=1.
 */
export function clientAddressConfigured(env: Record<string, string | undefined> = process.env): boolean {
  if (env.NODE_ENV !== 'production') return true;
  return Boolean(env.ADDRESS_HEADER) || env.LIFECYCLE_DIRECT_CLIENTS === '1';
}
