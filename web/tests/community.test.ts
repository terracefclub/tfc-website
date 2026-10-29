import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createServer, type ViteDevServer } from 'vite';
import { parseHTML } from 'linkedom';

let vite: ViteDevServer;
let render: typeof import('svelte/server').render;
const member = { id: 11, subject: 'synthetic-member', displayName: 'Synthetic Terran', roles: ['alumni'] };
const list = (docs: unknown[] = []) => ({ docs, page: 1, totalPages: 1, totalDocs: docs.length, hasNextPage: false, hasPrevPage: false });
const hostile = '<img src=x onerror="alert(1)"><script>alert(1)</script>';
const calls: Array<{ path: string; method: string; body: any }> = [];
let apiStatus = 200;
const oldOrigin = process.env.CMS_ORIGIN;
const api = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
  const url = new URL(request.url);
  const body = request.method === 'GET' ? null : await request.json();
  calls.push({ path: url.pathname, method: request.method, body });
  if (request.headers.get('authorization') !== 'Bearer synthetic-access') return new Response(null, { status: 401 });
  if (apiStatus !== 200) return Response.json({ error: 'Private upstream diagnostic' }, { status: apiStatus });
  return Response.json(request.method === 'GET' ? list() : { doc: { id: 1 } });
} });

beforeAll(async () => {
  process.env.CMS_ORIGIN = `http://127.0.0.1:${api.port}`;
  vite = await createServer({ server: { middlewareMode: true }, logLevel: 'silent' });
  render = (await vite.ssrLoadModule('svelte/server')).render;
});
afterAll(async () => {
  await vite?.close(); api.stop(true);
  if (oldOrigin === undefined) delete process.env.CMS_ORIGIN; else process.env.CMS_ORIGIN = oldOrigin;
});

test('member story, profile and mentorship text render as text, never executable markup', async () => {
  for (const [route, data] of [
    ['stories', { member, group: null, groups: [], stories: list([{ id: 1, author: 22, authorName: hostile, title: hostile, body: hostile, audience: 'community', createdAt: '2026-01-01T00:00:00Z' }]) }],
    ['people', { member, profiles: list([{ id: 1, member: 22, displayName: hostile, bio: hostile, interests: hostile, directoryVisible: true }]) }],
    ['mentorship', { member, mine: null, offers: list([{ id: 1, member: 22, displayName: hostile, topics: hostile, about: hostile, optIn: true }]), requests: list() }],
  ] as const) {
    const component = (await vite.ssrLoadModule(`/src/routes/members/${route}/+page.svelte`)).default;
    const html = render(component, { props: { data, form: null } }).body;
    const { document } = parseHTML(html);
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('img[onerror]')).toBeNull();
    expect(Array.from(document.querySelectorAll('h2,p')).map((element) => element.textContent).join('')).toContain('<script>alert(1)</script>');
  }
});

test('profile action sends explicit sharing consent and rejects invalid input before the CMS', async () => {
  const { actions } = await vite.ssrLoadModule('/src/routes/members/profile/+page.server.ts');
  const locals = { member, memberAccessToken: 'synthetic-access' };
  const submit = (values: Record<string, string>) => actions.default({ locals, request: new Request('http://127.0.0.1/members/profile/', { method: 'POST', body: new URLSearchParams(values) }) });
  calls.length = 0;
  expect((await submit({ displayName: 'A Terran', classYear: '2004', bio: 'Food and music', interests: '' })).success).toBeDefined();
  const first = calls.find((call) => call.method === 'POST');
  expect(first?.body.directoryVisible).toBe(false);
  expect(first?.body).not.toHaveProperty('member');
  calls.length = 0;
  const invalid = await submit({ displayName: 'A Terran', classYear: '2004.5' });
  expect(invalid.status).toBe(400);
  expect(calls).toHaveLength(0);
});

test('story form validates audience and forwards only the selected fields', async () => {
  const { actions } = await vite.ssrLoadModule('/src/routes/members/stories/+page.server.ts');
  const locals = { member, memberAccessToken: 'synthetic-access' };
  const submit = (values: Record<string, string>) => actions.share({ locals, request: new Request('http://127.0.0.1/members/stories/', { method: 'POST', body: new URLSearchParams(values) }) });
  calls.length = 0;
  expect((await submit({ title: 'Hello', body: 'A story', audience: 'group', group: '7', author: '999' })).success).toBeDefined();
  expect(calls[0].body).toEqual({ title: 'Hello', body: 'A story', audience: 'group', group: 7 });
  calls.length = 0;
  expect((await submit({ title: 'Hello', body: 'A story', audience: 'group' })).status).toBe(400);
  expect((await submit({ title: 'Hello', body: 'x'.repeat(10001), audience: 'community' })).status).toBe(400);
  expect(calls).toHaveLength(0);
});

test('mentorship preferences default to off and an incoming response cannot change participants', async () => {
  const { actions } = await vite.ssrLoadModule('/src/routes/members/mentorship/+page.server.ts');
  const locals = { member, memberAccessToken: 'synthetic-access' };
  const request = (values: Record<string, string>) => new Request('http://127.0.0.1/members/mentorship/', { method: 'POST', body: new URLSearchParams(values) });
  calls.length = 0;
  expect((await actions.offer({ locals, request: request({ displayName: 'A Terran', topics: 'Music' }) })).success).toBeDefined();
  expect(calls.find((call) => call.method === 'POST')?.body.optIn).toBe(false);
  calls.length = 0;
  expect((await actions.respond({ locals, request: request({ id: '3', status: 'accepted', reply: 'Happy to talk.', requester: '999', mentor: '999' }) })).success).toBeDefined();
  expect(calls[0]).toEqual({ path: '/api/mentorship-requests/3', method: 'PATCH', body: { status: 'accepted', reply: 'Happy to talk.' } });
});


test('group forms cannot submit another member identity and reject malformed identifiers', async () => {
  const { actions } = await vite.ssrLoadModule('/src/routes/members/groups/+page.server.ts');
  const locals = { member, memberAccessToken: 'synthetic-access' };
  const request = (values: Record<string, string>) => new Request('http://127.0.0.1/members/groups/', { method: 'POST', body: new URLSearchParams(values) });
  calls.length = 0;
  expect((await actions.join({ locals, request: request({ group: '7', member: '999' }) })).success).toBeDefined();
  expect(calls[0].body).toEqual({ group: 7 });
  calls.length = 0;
  expect((await actions.create({ locals, request: request({ name: 'Kitchen', description: 'Recipes', owner: '999' }) })).success).toBeDefined();
  expect(calls[0].body).toEqual({ name: 'Kitchen', description: 'Recipes' });
  calls.length = 0;
  expect((await actions.leave({ locals, request: request({ membership: '../2' }) })).status).toBe(400);
  expect(calls).toHaveLength(0);
});

test('upstream denials and write rate limits become safe actionable form errors', async () => {
  const { actions } = await vite.ssrLoadModule('/src/routes/members/groups/+page.server.ts');
  try {
    for (const status of [403, 429, 503]) {
      apiStatus = status;
      const result = await actions.join({ locals: { member, memberAccessToken: 'synthetic-access' }, request: new Request('http://127.0.0.1/members/groups/', { method: 'POST', body: new URLSearchParams({ group: '7' }) }) });
      expect(result.status).toBe(status);
      expect(result.data.error).not.toContain('Private upstream diagnostic');
      expect(result.data.error).toContain(status === 429 ? 'wait a minute' : status === 403 ? 'do not have access' : 'not saved');
    }
  } finally { apiStatus = 200; }
});

test('member list pagination rejects unbounded and malformed page input', async () => {
  const { pageNumber } = await vite.ssrLoadModule('/src/lib/server/community.ts');
  for (const page of ['0', '-2', 'Infinity', '1001', '1.5', '../users']) expect(pageNumber(new URL(`http://127.0.0.1/?page=${page}`))).toBe('1');
  expect(pageNumber(new URL('http://127.0.0.1/?page=3'))).toBe('3');
  expect(pageNumber(new URL('http://127.0.0.1/?requestsPage=2'), 'requestsPage')).toBe('2');
});
