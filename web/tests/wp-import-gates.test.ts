import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyReviews, isNearEmpty, leftoverShortcodes, minBodyTextChars, parseReviewFile } from '../tools/wp-import/content-gates';
import { auditLinks } from '../tools/wp-import/links';
import { buildPlan } from '../tools/wp-import/map';
import { hashOf, planHash, validatePlan, type Plan, type PlanDoc } from '../tools/wp-import/plan-schema';
import { dryRunReport } from '../tools/wp-import/report';
import { fixtureXml } from '../tools/wp-import/write-fixture-plan';

const gatesXml = readFileSync(new URL('./fixtures/wp-import/gates.wxr.xml', import.meta.url), 'utf8');
const synthetic = readFileSync(fixtureXml, 'utf8');
const plan = buildPlan(gatesXml);
const doc = (wpId: number) => plan.docs.find(item => item.wpId === wpId && item.collection !== 'media')!;
const cli = (input: string, args: string[]) => spawnSync(process.execPath, [fileURLToPath(new URL('../tools/wp-import/import.ts', import.meta.url)), ...args], { input, encoding: 'utf8', timeout: 20_000 });
const reseal = (docs: PlanDoc[]): Plan => { const { planSha256: _, ...rest } = { ...plan, docs }; return { ...rest, planSha256: planHash(rest) }; };

describe('empty-body gate', () => {
  test('a heading with little else is flagged and blocked from publication; real text is not', () => {
    expect(doc(1020)).toMatchObject({ publishEligible: false, desiredStatus: 'draft' });
    expect(doc(1020).flags).toContain('empty-body');
    expect(doc(1021).flags).toContain('empty-body'); // a body that is only a shortcode has no text either
    expect(doc(1023).flags).not.toContain('empty-body');
    expect(isNearEmpty('<h2>Heading only</h2>')).toBe(true);
    expect(isNearEmpty('')).toBe(true);
    expect(isNearEmpty(`<p>${'word '.repeat(minBodyTextChars / 4)}</p>`)).toBe(false);
    expect(isNearEmpty(`<p>${'x'.repeat(minBodyTextChars - 1)}</p>`)).toBe(true);
  });
  test('only pages and posts are gated; events and initiatives may have short bodies', () => {
    for (const item of buildPlan(synthetic).docs.filter(entry => ['events', 'initiatives'].includes(entry.collection))) expect(item.flags).not.toContain('empty-body');
  });
});

describe('leftover-shortcode gate', () => {
  test('known shortcode shapes are found and named; ordinary bracketed prose is not', () => {
    expect(leftoverShortcodes('[tt-event url="https://example.invalid/e"]')).toEqual(['tt-event']);
    expect(leftoverShortcodes('see [Fixture_Widget id=7] then [/fixture_widget] and [fixture-bare]')).toEqual(['fixture-bare', 'fixture_widget']);
    expect(leftoverShortcodes("[a_b c='d'] [one two=\"3\" four=5]")).toEqual(['a_b', 'one']);
    for (const prose of ['[sic]', 'cited [1] and [12]', '[citation needed]', '[see below]', 'an [aside] here', 'array[0] = [x]', '[ ]', '[http://example.invalid]', '[Note: this is text]']) expect(leftoverShortcodes(prose)).toEqual([]);
  });
  test('a post with a leftover shortcode is blocked, bracketed prose is not, and the report lists names only', () => {
    expect(doc(1021).flags).toContain('leftover-shortcode');
    expect(doc(1021).publishEligible).toBe(false);
    expect(doc(1022).flags).toContain('leftover-shortcode');
    expect(doc(1022).flags).not.toContain('empty-body');
    expect(doc(1022).publishEligible).toBe(false);
    expect(doc(1023).flags).not.toContain('leftover-shortcode');
    expect(doc(1023).publishEligible).toBe(true);
    const report = dryRunReport(plan, gatesXml);
    expect(report.contentGates.leftoverShortcodeNames).toEqual({ 'fixture-bare': 1, fixture_widget: 1, 'tt-event': 1 });
    const text = JSON.stringify(report);
    expect(text).not.toContain('example.invalid/event');
    expect(text).not.toContain('id="7"');
  });
});

describe('divi-layout-review blocks publication until the operator reviews that document', () => {
  test('flagged pages are drafts and cannot be re-sealed into published', () => {
    for (const id of [1024, 1025]) { expect(doc(id).flags).toContain('divi-layout-review'); expect(doc(id).publishEligible).toBe(false); }
    const forced = reseal(plan.docs.map(item => item.wpId === 1024 && item.collection === 'pages' ? { ...item, desiredStatus: 'published' as const, publishEligible: true } : item));
    expect(() => validatePlan(forced)).toThrow('publication not supported by source');
  });
  test('a review decision clears exactly the named flag on exactly that document, and only while its source is unchanged', () => {
    const one = doc(1024);
    const file = parseReviewFile({ kind: 'wp-import-review', schemaVersion: 1, reviewed: [{ ordinal: one.ordinal, sourceHash: one.sourceHash, flags: ['divi-layout-review'] }] });
    const reviewed = buildPlan(gatesXml, undefined, { reviews: file });
    const after = reviewed.docs.find(item => item.wpId === 1024 && item.collection === 'pages')!;
    expect(after.flags).toContain('divi-layout-review-reviewed');
    expect(after.flags).not.toContain('divi-layout-review');
    expect(after).toMatchObject({ publishEligible: true, desiredStatus: 'published' });
    expect(reviewed.docs.find(item => item.wpId === 1025 && item.collection === 'pages')).toMatchObject({ publishEligible: false });
    expect(reviewed.summary.contentGates).toMatchObject({ reviewsApplied: 1, reviewsUnmatched: 0 });
    expect(validatePlan(JSON.parse(JSON.stringify(reviewed)))).toBeTruthy();
    // The decision does not survive a change to the document.
    const edited = buildPlan(gatesXml.replaceAll('Synthetic filler for the fixture: invented club news', 'Changed text after review: invented club news'), undefined, { reviews: file });
    expect(edited.docs.find(item => item.wpId === 1024 && item.collection === 'pages')).toMatchObject({ publishEligible: false });
    expect(edited.summary.contentGates).toMatchObject({ reviewsApplied: 0 });
    // A flag the document does not carry, or one that is not overridable, is refused.
    expect(applyReviews(['empty-body'], 1, 'a'.repeat(64), file).applied).toEqual([]);
    for (const flags of [['unsafe-html-stripped'], ['media-bytes-pending'], []]) expect(() => parseReviewFile({ kind: 'wp-import-review', schemaVersion: 1, reviewed: [{ ordinal: 1, sourceHash: 'a'.repeat(64), flags }] })).toThrow('Invalid review file');
    expect(() => parseReviewFile({ kind: 'wp-import-review', schemaVersion: 1, reviewed: [{ ordinal: 1, sourceHash: 'zz', flags: ['empty-body'] }] })).toThrow('Invalid review file');
  });
  test('the applier-side validation refuses a forged review flag', () => {
    const forge = (flags: string[]) => reseal(plan.docs.map(item => {
      if (!(item.wpId === 1024 && item.collection === 'pages')) return item;
      const data = { ...item.data, wpReviewFlags: flags };
      return { ...item, flags, data, targetHash: hashOf({ data, refs: item.refs }), publishEligible: false, desiredStatus: 'draft' as const };
    }));
    expect(() => validatePlan(forge(['divi-layout-review', 'divi-layout-review-reviewed']))).toThrow('review flags mismatch');
    expect(() => validatePlan(forge(['unsafe-html-stripped-reviewed']))).toThrow('review flags mismatch');
    expect(() => validatePlan(forge(['made-up-reviewed']))).toThrow('review flags mismatch');
  });
  test('the command line applies --reviewed, and refuses a malformed review file with fixed text', () => {
    const directory = mkdtempSync(join(realpathSync(tmpdir()), 'wp-gates-'));
    try {
      chmodSync(directory, 0o700);
      const one = doc(1024);
      const good = join(directory, 'review.json');
      writeFileSync(good, JSON.stringify({ kind: 'wp-import-review', schemaVersion: 1, reviewed: [{ ordinal: one.ordinal, sourceHash: one.sourceHash, flags: ['divi-layout-review'] }] }));
      const before = JSON.parse(cli(gatesXml, ['dry-run', '--report', join(directory, 'a.json')]).stdout);
      const run = cli(gatesXml, ['dry-run', '--report', join(directory, 'b.json'), '--reviewed', good]);
      expect(run.status).toBe(0);
      const after = JSON.parse(run.stdout);
      expect(after.publishEligibleDocuments).toBe(before.publishEligibleDocuments + 1);
      expect(after.reviewsApplied).toBe(1);
      const bad = join(directory, 'bad.json');
      writeFileSync(bad, JSON.stringify({ kind: 'nope' }));
      const rejected = cli(gatesXml, ['dry-run', '--report', join(directory, 'c.json'), '--reviewed', bad]);
      expect(rejected.status).toBe(1);
      expect(rejected.stderr).toContain('Invalid review file');
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});

describe('link audit', () => {
  const context = { hosts: new Set(['princetonterraceclub.org', 'www.princetonterraceclub.org']), resolves: (path: string) => ['/about', '/2024/03/club-story'].includes(path) };
  test('unresolved internal targets and old-site uploads are separated, deduplicated and path-only', () => {
    const found = auditLinks(
      '<p><a href="/about/">a</a> <a href="https://www.princetonterraceclub.org/2024/03/club-story/">b</a> <a href="/vintage-tfc/x/">c</a> <a href="/vintage-tfc/x">c2</a> <a href="/wp-content/themes/t/missing.css">d</a> ' +
      '<a href="https://princetonterraceclub.org/wp-content/uploads/2024/05/flyer.pdf">e</a> <a href="/wp-content/uploads/2024/05/flyer.pdf">e2</a> <a href="https://example.invalid/x">f</a> <a href="#top">g</a> <a href="mailto:a@b.invalid">h</a> <a href="/about?x=1">q</a> <img src="https://princetonterraceclub.org/wp-content/uploads/2024/05/p.jpg" alt=""></p>', context);
    expect(found.unresolved).toEqual(['/about', '/vintage-tfc/x', '/wp-content/themes/t/missing.css']); // a link with a query is unresolved even to a real path
    expect(found.uploads).toEqual(['/wp-content/uploads/2024/05/flyer.pdf', '/wp-content/uploads/2024/05/p.jpg']);
    expect(found.uploadImages).toBe(1);
  });
  test('the planner flags documents (non-blocking) and reports distinct targets in the safe report', () => {
    const audited = doc(1026);
    expect(audited.flags).toContain('unresolved-links');
    expect(audited.publishEligible).toBe(true); // informational only
    const links = (dryRunReport(plan, gatesXml).links);
    expect(links.unresolvedInternalTargets).toEqual(['/2024/05/link-audit', '/vintage-tfc/old-gallery', '/wp-content/themes/fixture/missing.css']);
    expect(links.oldSiteUploadLinks).toEqual(['/wp-content/uploads/2024/05/flyer.pdf', '/wp-content/uploads/2024/05/photo.jpg']);
    expect(links.perDocument).toEqual([{ ordinal: audited.ordinal, unresolved: 3, uploads: 2, uploadImages: 1 }]);
    expect(JSON.stringify(dryRunReport(plan, gatesXml))).not.toContain('princetonterraceclub.org');
    expect(plan.docs.filter(item => item.flags.includes('unresolved-links')).length).toBe(1);
  });
  test('a link to a document that will stay a draft counts as unresolved', () => {
    const marker = '<wp:post_id>1023</wp:post_id>';
    const at = gatesXml.indexOf(marker);
    const end = gatesXml.indexOf('</item>', at);
    const draftXml = gatesXml.slice(0, at) + gatesXml.slice(at, end).replace('<wp:status>publish</wp:status>', '<wp:status>draft</wp:status>') + gatesXml.slice(end);
    const draft = dryRunReport(buildPlan(draftXml), draftXml).links;
    expect(draft.unresolvedInternalTargets).toContain('/2024/05/bracketed-prose');
    expect(dryRunReport(plan, gatesXml).links.unresolvedInternalTargets).not.toContain('/2024/05/bracketed-prose');
  });
});

describe('private output location', () => {
  test('a git-ignored directory inside a checkout is refused with a message that names the safe default, and never quotes the path', () => {
    const root = mkdtempSync(join(realpathSync(tmpdir()), 'wp-checkout-'));
    try {
      mkdirSync(join(root, '.git')); const state = join(root, '.state'); mkdirSync(state, { mode: 0o700 }); writeFileSync(join(root, '.gitignore'), '.state/\n');
      const rejected = cli(synthetic, ['dry-run', '--report', join(state, 'r.json')]);
      expect(rejected.status).toBe(1);
      expect(rejected.stderr).toContain('inside a Git checkout, including a git-ignored one');
      expect(rejected.stderr).toContain('~/.terrace-private');
      expect(rejected.stderr).not.toContain(root);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

describe('redirect rows for real site routes', () => {
  test('a WordPress page at /join or /apply gets no redirect row, only an explicit gap', () => {
    expect(plan.redirects.some(item => ['/join', '/apply'].includes(item.sourcePath))).toBe(false);
    const gaps = plan.unmapped.filter(item => item.scope === 'redirect' && item.reason === 'redirect-reserved-route').map(item => item.ordinal);
    expect(gaps).toEqual(expect.arrayContaining([doc(1027).ordinal, doc(1028).ordinal]));
  });
  test('a hand-built plan that carries a /join row is refused by the applier-side validation', () => {
    const page = doc(1027);
    const row = { ordinal: page.ordinal, wpId: page.wpId, collection: 'pages' as const, sourcePath: '/join', destination: '/pages/join', mode: 'redirect' as const };
    const { planSha256: _, ...rest } = { ...plan, redirects: [...plan.redirects, row] };
    expect(() => validatePlan({ ...rest, planSha256: planHash(rest) })).toThrow('redirect destination');
  });
});

describe('the applier-side validation recomputes the content gates', () => {
  const tamper = (wpId: number, collection: string, change: (item: PlanDoc) => PlanDoc) => reseal(plan.docs.map(item => item.wpId === wpId && item.collection === collection ? change(item) : item));
  const unflag = (flag: string) => (item: PlanDoc): PlanDoc => {
    const flags = item.flags.filter(entry => entry !== flag);
    const data = { ...item.data, wpReviewFlags: flags.length ? flags : undefined };
    return JSON.parse(JSON.stringify({ ...item, flags, data, targetHash: hashOf({ data: JSON.parse(JSON.stringify(data)), refs: item.refs }), publishEligible: item.sourceStatus === 'publish', desiredStatus: item.sourceStatus === 'publish' ? 'published' : 'draft' }));
  };
  test('dropping empty-body or leftover-shortcode from a plan is refused even when the plan is re-sealed', () => {
    expect(() => validatePlan(tamper(1020, 'pages', unflag('empty-body')))).toThrow('empty body not flagged');
    expect(() => validatePlan(tamper(1022, 'posts', unflag('leftover-shortcode')))).toThrow('leftover shortcode not flagged');
    expect(() => validatePlan(tamper(1021, 'posts', unflag('leftover-shortcode')))).toThrow(); // also near-empty
    expect(validatePlan(JSON.parse(JSON.stringify(plan)))).toBeTruthy();
  });
  test('a body edited to hide a shortcode or to grow past the threshold in the plan is judged on the stored body', () => {
    const longer = (item: PlanDoc): PlanDoc => { const data = { ...item.data, bodyHtml: `<p>${'word '.repeat(60)}</p>` }; return { ...item, data, targetHash: hashOf({ data, refs: item.refs }) }; };
    // A plan whose body really is long needs no flag, so the planner's flag may be absent or present; the check is on the body.
    expect(validatePlan(tamper(1020, 'pages', item => unflag('empty-body')(longer(item)))).docs.length).toBe(plan.docs.length);
    const shortened = (item: PlanDoc): PlanDoc => { const data = { ...item.data, bodyHtml: '<p>tiny</p>' }; return { ...item, data, targetHash: hashOf({ data, refs: item.refs }) }; };
    expect(() => validatePlan(tamper(1023, 'posts', shortened))).toThrow('empty body not flagged');
  });
  test('a reviewed flag satisfies the gate; buildPlan itself refuses a stale route manifest', () => {
    const one = doc(1020);
    const reviewed = buildPlan(gatesXml, undefined, { reviews: parseReviewFile({ kind: 'wp-import-review', schemaVersion: 1, reviewed: [{ ordinal: one.ordinal, sourceHash: one.sourceHash, flags: ['empty-body'] }] }) });
    expect(validatePlan(JSON.parse(JSON.stringify(reviewed)))).toBeTruthy();
    const root = mkdtempSync(join(tmpdir(), 'routes-stale-'));
    try {
      mkdirSync(join(root, 'brand-new'));
      writeFileSync(join(root, 'brand-new', '+page.svelte'), '');
      expect(() => buildPlan(gatesXml, undefined, { routesDir: root })).toThrow('Stale route manifest');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
