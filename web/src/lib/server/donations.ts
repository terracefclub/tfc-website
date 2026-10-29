import type { DonationCheckout } from '$lib/donations';

export type DonationConfig = { mode: 'disabled' | 'test' | 'live'; checkouts: DonationCheckout[] };
const unavailable: DonationConfig = { mode: 'disabled', checkouts: [] };

export function donationConfig(env: Record<string, string | undefined>): DonationConfig {
  const mode = env.DONATIONS_MODE;
  const raw = env.DONATION_CHECKOUTS_JSON;
  if ((mode !== 'test' && mode !== 'live') || !raw || raw.length > 8192) return unavailable;
  try {
    const values: unknown = JSON.parse(raw);
    if (!Array.isArray(values) || values.length < 1 || values.length > 10) return unavailable;
    const ids = new Set<string>();
    const checkouts: DonationCheckout[] = [];
    for (const value of values) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return unavailable;
      const { id, fund, frequency, recipient, url: address, monthlyAmountCents } = value;
      if (typeof id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(id) || ids.has(id)) return unavailable;
      if (fund !== 'financial-aid' && fund !== 'club-support') return unavailable;
      if (frequency !== 'once' && frequency !== 'monthly') return unavailable;
      if (typeof recipient !== 'string' || recipient.trim().length < 2 || recipient.length > 120 || /[\u0000-\u001f\u007f]/.test(recipient)) return unavailable;
      if (typeof address !== 'string' || address.length > 250) return unavailable;
      const url = new URL(address);
      if (url.protocol !== 'https:' || url.hostname !== 'buy.stripe.com' || url.port || url.username || url.password || url.search || url.hash || !/^\/[a-zA-Z0-9_]+$/.test(url.pathname)) return unavailable;
      if ((mode === 'test') !== url.pathname.startsWith('/test_')) return unavailable;
      if (frequency === 'monthly' && (!Number.isInteger(monthlyAmountCents) || monthlyAmountCents < 100 || monthlyAmountCents > 1_000_000)) return unavailable;
      if (frequency === 'once' && monthlyAmountCents !== undefined) return unavailable;
      ids.add(id);
      checkouts.push({ id, fund, frequency, recipient: recipient.trim(), url: url.href, ...(frequency === 'monthly' ? { monthlyAmountCents } : {}) });
    }
    return { mode, checkouts };
  } catch {
    return unavailable;
  }
}
