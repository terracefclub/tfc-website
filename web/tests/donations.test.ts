import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createServer, type ViteDevServer } from 'vite';
import type { AddressInfo } from 'node:net';
import { donationConfig } from '../src/lib/server/donations';

const once = { id: 'aid-once', fund: 'financial-aid', frequency: 'once', recipient: 'Synthetic test recipient', url: 'https://buy.stripe.com/test_terraceSynthetic' };
const monthly = { ...once, id: 'club-monthly', fund: 'club-support', frequency: 'monthly', monthlyAmountCents: 2500 };
const config = (values: unknown, mode = 'test') => donationConfig({ DONATIONS_MODE: mode, DONATION_CHECKOUTS_JSON: JSON.stringify(values) });

describe('hosted donation boundary', () => {
  test('is disabled until configured and distinguishes test from live links', () => {
    expect(donationConfig({}).mode).toBe('disabled');
    expect(config([once, monthly]).checkouts).toHaveLength(2);
    expect(config([once], 'live').mode).toBe('disabled');
    expect(config([{ ...once, url: 'https://buy.stripe.com/terraceSynthetic' }]).mode).toBe('disabled');
    expect(config([{ ...once, url: 'https://buy.stripe.com/terraceSynthetic' }], 'live').mode).toBe('live');
  });

  test.each([
    'http://buy.stripe.com/test_a', 'https://buy.stripe.com.evil.invalid/test_a',
    'https://stripe.com/test_a', 'https://example.invalid/test_a',
    'https://user:password@buy.stripe.com/test_a', 'https://buy.stripe.com:444/test_a',
    'https://buy.stripe.com/test_a?prefilled_email=private@example.invalid',
    'https://buy.stripe.com/test_a#fragment', 'javascript:alert(1)',
    'https://buy.stripe.com/test_a/extra', 'https://buy.stripe.com/%74est_a'
  ])('rejects unapproved checkout destination %s', url => {
    expect(config([{ ...once, url }]).checkouts).toHaveLength(0);
  });

  test('rejects mismatched terms, duplicates, unknown funds and malformed configuration', () => {
    for (const value of [
      [], [once, once], [{ ...once, fund: 'unknown' }], [{ ...once, frequency: 'weekly' }],
      [{ ...once, recipient: '' }], [{ ...once, recipient: 'A\nB' }],
      [{ ...monthly, monthlyAmountCents: -1 }], [{ ...monthly, monthlyAmountCents: 0.5 }],
      [{ ...monthly, monthlyAmountCents: 1_000_001 }], [{ ...monthly, monthlyAmountCents: undefined }],
      [{ ...once, monthlyAmountCents: 2500 }], [{ ...once, id: '../elsewhere' }],
      { once }, Array(11).fill(once)
    ]) expect(config(value).mode).toBe('disabled');
    expect(donationConfig({ DONATIONS_MODE: 'test', DONATION_CHECKOUTS_JSON: '{invalid' }).mode).toBe('disabled');
  });
});

let server: ViteDevServer;
let origin: string;
const oldMode = process.env.DONATIONS_MODE;
const oldOptions = process.env.DONATION_CHECKOUTS_JSON;

beforeAll(async () => {
  process.env.DONATIONS_MODE = 'test';
  process.env.DONATION_CHECKOUTS_JSON = JSON.stringify([once, monthly]);
  server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' });
  await server.listen();
  origin = `http://127.0.0.1:${(server.httpServer!.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await server?.close();
  if (oldMode === undefined) delete process.env.DONATIONS_MODE; else process.env.DONATIONS_MODE = oldMode;
  if (oldOptions === undefined) delete process.env.DONATION_CHECKOUTS_JSON; else process.env.DONATION_CHECKOUTS_JSON = oldOptions;
});

test('HTTP giving page discloses test status, recipient and recurring amount without card fields', async () => {
  const response = await fetch(`${origin}/donate/`);
  const html = await response.text();
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(html).toContain('Test checkout · no real donations.');
  expect(html).toContain('Synthetic test recipient');
  expect(html).toContain('$25.00 USD / month');
  expect(html).not.toContain('name="card');
  expect(html).not.toContain('buy.stripe.com');
});

test('HTTP handoff selects only configured options and never follows donor-supplied URLs', async () => {
  const response = await fetch(`${origin}/donate/checkout/?option=aid-once&url=https://example.invalid&amount=1`, { redirect: 'manual' });
  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe(once.url);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  for (const query of ['', '?option=unknown', '?option=aid-once&option=club-monthly', '?option=https://example.invalid']) {
    const denied = await fetch(`${origin}/donate/checkout/${query}`, { redirect: 'manual' });
    expect(denied.status).toBe(404);
    expect(denied.headers.get('location')).toBeNull();
  }
});
