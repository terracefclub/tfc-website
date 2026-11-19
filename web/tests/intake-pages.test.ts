import { afterAll, beforeAll, beforeEach, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { parseHTML } from 'linkedom';

// The public application and invitation pages: the literal markup the browser receives, the class-year
// rule on both sides, and every visible state (form, field errors, received, closed, accepted, invalid).
const secret = `synthetic-intake-secret-${crypto.randomUUID()}`;
const calls: Array<{ path: string; body: any }> = [];
const api = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
  const text = await request.text();
  calls.push({ path: new URL(request.url).pathname, body: text ? JSON.parse(text) : null });
  return Response.json({ received: true }, { status: 202 });
} });
let vite: ViteDevServer;
let render: typeof import('svelte/server').render;
const saved = { origin: process.env.CMS_ORIGIN, secret: process.env.LIFECYCLE_INTAKE_SECRET };

const realNow = Date.now;
let clockOffset = 0;
beforeAll(async () => {
  // Installed before the guard module loads, so it can be aged past its token life without waiting.
  Date.now = () => realNow() + clockOffset;
  process.env.CMS_ORIGIN = `http://127.0.0.1:${api.port}`;
  process.env.LIFECYCLE_INTAKE_SECRET = secret;
  vite = await createServer({ server: { middlewareMode: true }, logLevel: 'silent' });
  render = (await vite.ssrLoadModule('svelte/server')).render;
});
afterAll(async () => {
  Date.now = realNow;
  await vite?.close(); api.stop(true);
  for (const [name, value] of [['CMS_ORIGIN', saved.origin], ['LIFECYCLE_INTAKE_SECRET', saved.secret]] as const) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
});
beforeEach(() => { calls.length = 0; });

const applyModule = () => vite.ssrLoadModule('/src/routes/apply/+page.server.ts');
const applyPage = async () => (await vite.ssrLoadModule('/src/routes/apply/+page.svelte')).default;
const joinPage = async () => (await vite.ssrLoadModule('/src/routes/join/+page.svelte')).default;
const html = (component: any, props: Record<string, unknown>) => render(component, { props }).body as string;
const dom = (body: string) => parseHTML(`<html><body>${body}</body></html>`).document;

// ---- class year --------------------------------------------------------------------------------
test('no .svelte file puts braces inside a quoted attribute value (Svelte would parse them as expressions)', () => {
  const files: string[] = [];
  const walk = (dir: string) => { for (const name of readdirSync(dir)) { const path = join(dir, name); statSync(path).isDirectory() ? walk(path) : path.endsWith('.svelte') && files.push(path); } };
  walk(join(import.meta.dir, '../src'));
  expect(files.length).toBeGreaterThan(10);
  const offenders: string[] = [];
  for (const file of files) {
    const markup = readFileSync(file, 'utf8').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
    for (const match of markup.matchAll(/\s([\w:-]+)=(?:"([^"]*)"|'([^']*)')/g)) {
      const value = match[2] ?? match[3];
      if (/[{}]/.test(value)) offenders.push(`${file}: ${match[1]}="${value}"`);
    }
  }
  expect(offenders).toEqual([]);
});

test('the class-year input reaches the browser with the literal pattern [0-9]{4}', async () => {
  const body = html(await applyPage(), { data: { open: true, token: 'tok' }, form: null });
  expect(body).toContain('pattern="[0-9]{4}"');
  expect(body).not.toContain('pattern="[0-9]4"');
  const input = dom(body).querySelector('input[name="classYear"]')!;
  const pattern = input.getAttribute('pattern')!;
  expect(pattern).toBe('[0-9]{4}');
  const browserAccepts = (value: string) => new RegExp(`^(?:${pattern})$`, 'v').test(value);
  for (const year of ['2004', '1999', '1904']) expect(browserAccepts(year)).toBe(true);
  for (const bad of ['204', '20045', 'abcd', '20 4']) expect(browserAccepts(bad)).toBe(false);
  expect(input.getAttribute('maxlength')).toBe('4');
  expect(input.hasAttribute('required')).toBe(false);
});

const slots = Array.from({ length: 12 }, (_, index) => `intake-test-${index}`);
let issued: Promise<Record<string, string>> | undefined;
async function ready(client: string, extra: Record<string, string> = {}) {
  issued ??= (async () => {
    const { load } = await applyModule();
    const tokens = Object.fromEntries(slots.map((slot) => [slot, ((load as any)({ setHeaders: () => undefined, getClientAddress: () => slot }) as any).token as string]));
    await Bun.sleep(3100);
    return tokens;
  })();
  return { t: (await issued)[client], name: 'Pat Terran', affiliation: 'alumni', classYear: '2004', contactEmail: 'pat@terrace.invalid', note: '', website: '', ...extra };
}
const submit = async (client: string, values: Record<string, string>) => ((await applyModule()).actions as any).default({
  request: new Request('http://127.0.0.1/apply/', { method: 'POST', body: new URLSearchParams(values) }), getClientAddress: () => client, setHeaders: () => undefined,
});

test('the server accepts four-digit years from 1904 to 2200 and a blank class year', async () => {
  for (const [slot, classYear, expected] of [[0, '2004', 2004], [1, '1904', 1904], [2, '2200', 2200], [3, '', undefined], [4, '   ', undefined]] as const) {
    calls.length = 0;
    expect(await submit(slots[slot], await ready(slots[slot], { classYear }))).toEqual({ received: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].body.classYear).toBe(expected);
  }
}, 15_000);

test('the server rejects invalid years with a field error and keeps what was typed', async () => {
  for (const [slot, years] of [[5, ['1903', '2201', '20x4', '204']], [6, ['20045', '-204', '2.04', '٢٠٠٤']]] as const) {
    for (const classYear of years) {
      const result: any = await submit(slots[slot], await ready(slots[slot], { classYear, note: 'Keep me.' }));
      expect(result.status, classYear).toBe(400);
      expect(Object.keys(result.data.fieldErrors)).toEqual(['classYear']);
      expect(result.data.values).toEqual({ name: 'Pat Terran', affiliation: 'alumni', classYear: classYear.slice(0, 4), contactEmail: 'pat@terrace.invalid', note: 'Keep me.' });
      expect(JSON.stringify(result.data)).not.toContain('"t"');
    }
  }
  expect(calls).toHaveLength(0);
}, 15_000);

test('every field error is reported together, and the CMS is not called', async () => {
  const result: any = await submit(slots[7], await ready(slots[7], { name: '', affiliation: 'staff', classYear: '1800', contactEmail: 'nope', note: 'x'.repeat(1001) }));
  expect(result.status).toBe(400);
  expect(Object.keys(result.data.fieldErrors).sort()).toEqual(['affiliation', 'classYear', 'contactEmail', 'name', 'note']);
  expect(calls).toHaveLength(0);
}, 15_000);

test('a tripped honeypot gets exactly the fake-success shape, even with invalid fields', async () => {
  const result = await submit(slots[8], await ready(slots[8], { website: 'https://spam.invalid', name: '', affiliation: 'staff', classYear: 'abc', contactEmail: 'nope' }));
  expect(result).toEqual({ received: true });
  expect(Object.keys(result)).toEqual(['received']);
  expect(calls).toHaveLength(0);
}, 15_000);

test('too-fast and changed-network submissions keep their message and values, with no field errors', async () => {
  const { load } = await applyModule();
  const values = await ready(slots[9]);
  const fresh = (load as any)({ setHeaders: () => undefined, getClientAddress: () => slots[9] }).token;
  const fast: any = await submit(slots[9], { ...values, t: fresh });
  expect(fast.status).toBe(400);
  expect(fast.data.error).toBe('Please reload the page and send your application again.');
  expect(fast.data.values.name).toBe('Pat Terran');
  expect(fast.data.fieldErrors).toBeUndefined();
  const moved: any = await submit(slots[10], values); // a genuine token presented from another network
  expect(moved.status).toBe(400);
  expect(moved.data.error).toContain('Your connection changed');
  expect(moved.data.values.contactEmail).toBe('pat@terrace.invalid');
  expect(moved.data.fieldErrors).toBeUndefined();
  expect(calls).toHaveLength(0);
}, 15_000);

test('an expired token keeps its message and values, with no field errors', async () => {
  const values = await ready(slots[11]);
  clockOffset = 31 * 60_000;
  try {
    const expired: any = await submit(slots[11], values);
    expect(expired.status).toBe(400);
    expect(expired.data.error).toBe('Please reload the page and send your application again.');
    expect(expired.data.values.name).toBe('Pat Terran');
    expect(expired.data.fieldErrors).toBeUndefined();
  } finally { clockOffset = 0; }
  expect(calls).toHaveLength(0);
}, 15_000);

// ---- apply page states ---------------------------------------------------------------------------
test('the application form has bound labels, one h1, a hidden honeypot and a useful head', async () => {
  const component = await applyPage();
  const body = html(component, { data: { open: true, token: 'tok' }, form: null });
  const document = dom(body);
  expect(document.querySelectorAll('h1')).toHaveLength(1);
  for (const id of ['name', 'affiliation', 'classYear', 'contactEmail', 'note']) {
    const control = document.querySelector(`[name="${id}"]`)!;
    expect(document.querySelector(`label[for="${control.id}"]`), id).not.toBeNull();
    expect(control.hasAttribute('aria-invalid')).toBe(false);
  }
  expect(document.querySelector('input[name="classYear"]')!.getAttribute('aria-describedby')).toBe('apply-classYear-help');
  const honeypot = document.querySelector('input[name="website"]')!;
  expect(honeypot.getAttribute('tabindex')).toBe('-1');
  expect(honeypot.closest('[aria-hidden="true"]')).not.toBeNull();
  expect(document.querySelector('input[name="t"]')!.getAttribute('value')).toBe('tok');
  const head = render(component, { props: { data: { open: true, token: 'tok' }, form: null } }).head as string;
  expect(head).toContain('<title>Request to join');
  expect(head).toContain('name="description"');
  expect(head).toContain('noindex');
});

test('a failed submit shows a summary, associates errors with fields and keeps the values', async () => {
  const form = { error: 'Please check the highlighted fields and try again.', fieldErrors: { classYear: 'Enter a four-digit year from 1904 to 2200, or leave this blank.' }, values: { name: 'Pat <b>Terran</b>', affiliation: 'current-member', classYear: '20x4', contactEmail: 'pat@terrace.invalid', note: 'Line one\nLine two' } };
  const document = dom(html(await applyPage(), { data: { open: true, token: 'tok' }, form }));
  const summary = document.querySelector('[role="alert"]')!;
  expect(summary.textContent).toContain('Please check the highlighted fields');
  expect(summary.querySelector('a')!.getAttribute('href')).toBe('#apply-classYear');
  const year = document.querySelector('#apply-classYear')!;
  expect(year.getAttribute('aria-invalid')).toBe('true');
  expect(year.getAttribute('aria-describedby')).toBe('apply-classYear-help apply-classYear-error');
  expect(document.querySelector('#apply-classYear-error')!.textContent).toContain('four-digit year');
  expect(year.getAttribute('value')).toBe('20x4');
  expect(document.querySelector('#apply-name')!.getAttribute('value')).toBe('Pat <b>Terran</b>');
  expect(document.querySelector('#apply-name')!.hasAttribute('aria-invalid')).toBe(false);
  expect(document.querySelector('#apply-affiliation option[value="current-member"]')!.hasAttribute('selected')).toBe(true);
  expect(document.querySelector('#apply-note')!.textContent).toBe('Line one\nLine two');
  expect(document.querySelectorAll('b')).toHaveLength(0); // typed markup is escaped, never rendered
  expect(document.querySelector('input[name="website"]')!.getAttribute('value')).toBeNull();
});

test('attacker-shaped input is escaped in attributes, the textarea and the error summary', async () => {
  const evil = '"><script>alert(1)</script><img src=x onerror=alert(2)>';
  const form = { error: `Problem ${evil}`, fieldErrors: { name: evil, contactEmail: evil, note: evil }, values: { name: evil, affiliation: 'alumni', classYear: '', contactEmail: evil, note: evil } };
  const body = html(await applyPage(), { data: { open: true, token: 'tok' }, form });
  expect(body).not.toContain('<script>alert');
  expect(body).not.toContain('<img src=x');
  expect(body).toContain('&lt;script>'); // `<` and `"` are escaped, which is all that is needed to stay inside the text or attribute
  expect(body).toMatch(/id="apply-name"[^>]*value="&quot;>&lt;script>/);
  const document = dom(body);
  expect(document.querySelectorAll('script')).toHaveLength(0);
  expect(document.querySelectorAll('img[onerror]')).toHaveLength(0);
  expect(document.querySelector('#apply-name')!.getAttribute('value')).toBe(evil);
  expect(document.querySelector('#apply-contactEmail')!.getAttribute('value')).toBe(evil);
  expect(body).toMatch(/<textarea[^>]*id="apply-note"[^>]*>">&lt;script>alert\(1\)&lt;\/script>&lt;img/); // browsers decode entities inside a textarea
  expect(document.querySelector('[role="alert"]')!.textContent).toContain(evil);
});

test('a network change error stays visible with the visitor\'s values and asks for a reload', async () => {
  const form = { error: 'Your connection changed while you filled this in. Please reload the page and send your application again.', values: { name: 'Pat', affiliation: 'alumni', classYear: '', contactEmail: 'pat@terrace.invalid', note: '' } };
  const document = dom(html(await applyPage(), { data: { open: true, token: 'tok' }, form }));
  expect(document.querySelector('[role="alert"]')!.textContent).toContain('reload the page');
  expect(document.querySelector('#apply-name')!.getAttribute('value')).toBe('Pat');
});

test('the received and closed states are styled cards, not bare prose', async () => {
  const component = await applyPage();
  const received = dom(html(component, { data: { open: true, token: 'tok' }, form: { received: true } }));
  expect(received.querySelector('.intake-card.intake-done[role="status"]')!.textContent).toContain('Your request was received');
  expect(received.querySelector('form')).toBeNull();
  expect(received.querySelectorAll('h1')).toHaveLength(1);
  const closed = dom(html(component, { data: { open: false, token: '' }, form: null }));
  expect(closed.querySelector('.intake-card')!.textContent).toContain('Not open yet');
  expect(closed.querySelector('a[href="/contact/"]')).not.toBeNull();
  expect(closed.querySelector('form')).toBeNull();
});

// ---- join page states ----------------------------------------------------------------------------
test('the invitation page has a labelled paste field without script and one h1', async () => {
  const component = await joinPage();
  const body = html(component, { data: {}, form: null });
  const document = dom(body);
  expect(document.querySelectorAll('h1')).toHaveLength(1);
  const field = document.querySelector('input[name="token"]')!;
  expect(document.querySelector(`label[for="${field.id}"]`)).not.toBeNull();
  expect(field.getAttribute('aria-describedby')).toBe('join-token-help');
  expect(field.hasAttribute('aria-invalid')).toBe(false);
  expect(document.querySelector('form[method="POST"]')).not.toBeNull();
  const head = render(component, { props: { data: {}, form: null } }).head as string;
  expect(head).toContain('name="robots" content="noindex, nofollow"');
  expect(head).toContain('name="referrer" content="no-referrer"');
  expect(head).toContain('name="description"');
});

test('the invalid, unavailable and accepted invitation states are styled and associated', async () => {
  const component = await joinPage();
  const invalid = dom(html(component, { data: {}, form: { state: 'invalid' } }));
  expect(invalid.querySelector('.intake-alert[role="alert"]')!.textContent).toContain('not valid');
  expect(invalid.querySelector('input[name="token"]')!.getAttribute('aria-invalid')).toBe('true');
  expect(invalid.querySelector('input[name="token"]')!.getAttribute('aria-describedby')).toBe('join-token-help join-token-error');
  expect(invalid.querySelector('a[href="/apply/"]')).not.toBeNull();
  const unavailable = dom(html(component, { data: {}, form: { state: 'unavailable' } }));
  expect(unavailable.querySelector('.intake-alert[role="alert"]')!.textContent).toContain('has not been used up');
  const accepted = dom(html(component, { data: {}, form: { state: 'accepted' } }));
  expect(accepted.querySelector('.intake-done[role="status"]')!.textContent).toContain('operator');
  expect(accepted.querySelector('.intake-aside li')).not.toBeNull();
  expect(accepted.querySelector('a[href="/members/"]')).not.toBeNull();
  expect(accepted.querySelector('form')).toBeNull();
});
