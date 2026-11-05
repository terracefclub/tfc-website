import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { maxBytes, migrationPlan, preflight } from '../tools/wxr-preflight';

const privateText = 'PRIVATE_WXR_FIXTURE_MARKER';
const wp = 'http://wordpress.org/export/1.2/';
const content = 'http://purl.org/rss/1.0/modules/content/';
const cdata = (text: string) => `<![CDATA[${text}]]>`;
const meta = (key: string, value: string) => `<wp:postmeta><wp:meta_key>${cdata(key)}</wp:meta_key><wp:meta_value>${cdata(value)}</wp:meta_value></wp:postmeta>`;
const item = (id: number, type = 'post', status = 'publish', extra = '', body = privateText) => `<item><title>${cdata(privateText)}</title><link>https://princetonterraceclub.org/source-${id}/</link><wp:post_id>${id}</wp:post_id><wp:post_type>${type}</wp:post_type><wp:status>${status}</wp:status><wp:post_password></wp:post_password><content:encoded>${cdata(body)}</content:encoded>${extra}</item>`;
const wxr = (items: string, extra = '') => `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:wp="${wp}" xmlns:content="${content}"><channel><title>${privateText}</title><link>https://princetonterraceclub.org/</link><wp:wxr_version>1.2</wp:wxr_version><wp:base_site_url>https://princetonterraceclub.org/</wp:base_site_url><wp:base_blog_url>https://princetonterraceclub.org/</wp:base_blog_url><wp:author><wp:author_login>${privateText}</wp:author_login><wp:author_email>${privateText}@example.invalid</wp:author_email></wp:author>${extra}${items}</channel></rss>`;
function cli(input: string | Buffer, args: string[] = []) {
  return spawnSync(process.execPath, [fileURLToPath(new URL('../tools/wxr-preflight.ts', import.meta.url)), ...args], { input, encoding: 'utf8', timeout: 10_000 });
}

describe('read-only WXR preflight', () => {
  test('nonempty whitespace-only post passwords are still protected', () => {
    const report = preflight(wxr(item(1).replace('<wp:post_password></wp:post_password>', '<wp:post_password> \t </wp:post_password>')));
    expect(report.byType.post.passwordProtected).toBe(1);
    expect(report.scope.publishStatusContentWithoutPassword).toBe(0);
    expect(report.scope.otherOrPasswordProtectedContent).toBe(1);
  });
  test('reports only allowlisted aggregates and keeps publication, password and attachment scope separate', () => {
    const xml = wxr(item(1) + item(2, 'page', 'draft') + item(3, 'post', 'private') + item(4, 'post', 'publish').replace('<wp:post_password></wp:post_password>', `<wp:post_password>${privateText}</wp:post_password>`) + item(5, privateText, privateText) + item(6, 'attachment', 'inherit', '<wp:attachment_url>https://princetonterraceclub.org/wp-content/uploads/test.jpg</wp:attachment_url>'));
    const run = cli(xml);
    expect(run.status).toBe(0);
    expect(run.stderr).toBe('');
    expect(run.stdout).not.toContain(privateText);
    const report = JSON.parse(run.stdout);
    expect(report.itemCount).toBe(6);
    expect(report.authorRecordCount).toBe(1);
    expect(report.byType.post).toMatchObject({ total: 3, publish: 2, private: 1, passwordProtected: 1 });
    expect(report.byType.other).toMatchObject({ total: 1, other: 1 });
    expect(report.scope).toMatchObject({ publishStatusContentWithoutPassword: 1, otherOrPasswordProtectedContent: 3, historicalGravityEntries: 'excluded' });
    expect(report.media.fileBytesAndHashes).toBe('not-checked-no-files-or-network');
    expect(report.importsPerformed).toBe(0);
    expect(report.gates).toContain('no-wordpress-user-to-keycloak-auto-mapping');
  });

  test('checks internal media and event references without calling files or URLs present in content', () => {
    const body = `<img class="wp-image-10 wp-image-99" src="https://princetonterraceclub.org/wp-content/uploads/test.jpg"><img src="/wp-content/uploads/test-300x200.jpg">[et_pb_text][gravityform id="1"]<iframe src="https://${privateText.toLowerCase()}.example.invalid/"></iframe>`;
    const xml = wxr(item(1, 'post', 'publish', meta('_thumbnail_id', '10'), body) + item(10, 'attachment', 'inherit', '<wp:attachment_url>https://princetonterraceclub.org/wp-content/uploads/test.jpg</wp:attachment_url>') + item(20, 'tribe_venue') + item(21, 'tribe_events', 'publish', meta('_EventStartDate', '2030-01-01 20:00:00') + meta('_EventEndDate', '2030-01-01 21:00:00') + meta('_EventTimezone', 'America/New_York') + meta('_EventVenueID', '20') + meta('_EventOrganizerID', '999')));
    const report = preflight(xml);
    expect(report.media.idReferences).toEqual({ resolved: 2, missing: 1, wrongType: 0, ambiguous: 0, invalid: 0 });
    expect(report.media).toMatchObject({ distinctBodyUploadUrls: 2, bodyUploadUrlsMatchedToExport: 1, bodyUploadUrlsAbsentFromExport: 1 });
    expect(report.pluginShapes.itemsWithShortcodes).toMatchObject({ divi: 1, gravityForms: 1 });
    expect(report.pluginShapes.itemsWithMarkup.iframe).toBe(1);
    expect(report.events).toMatchObject({ records: 1, validLocalDatePairs: 1, timezoneShapes: { runtimeRecognized: 1 }, publicCandidateEventsNeedingDateOrTimezoneReview: 0 });
    expect(report.events.venueOrganizerReferences).toEqual({ resolved: 1, missing: 1, wrongType: 0, ambiguous: 0, invalid: 0 });
    expect(JSON.stringify(report)).not.toContain(privateText.toLowerCase());
  });

  test('unknown origins, metadata, shortcode names and values cannot become output keys or diagnostics', () => {
    const xml = wxr(item(1, 'post', 'publish', meta(privateText, privateText), `[${privateText}]`) + item(2, 'attachment', 'inherit', `<wp:attachment_url>https://${privateText.toLowerCase()}.example.invalid/${privateText}?token=${privateText}</wp:attachment_url>`)).replace('https://princetonterraceclub.org/source-1/', `https://user:${privateText}@example.invalid/private?${privateText}`);
    const run = cli(xml), report = JSON.parse(run.stdout);
    expect(run.status).toBe(0);
    expect(run.stdout).not.toContain(privateText);
    expect(run.stdout).not.toContain(privateText.toLowerCase());
    expect(report.sourceOrigins.attachments).toMatchObject({ knownOrigins: [], otherOrigins: 1, queryOrFragmentReferences: 1 });
    expect(report.redirects.missingInvalidOrCredentialBearing).toBe(1);
    expect(report.pluginShapes.itemsWithShortcodes.other).toBe(1);
    expect(report.pluginShapes.otherMetadataRecords).toBe(1);
  });

  test('simple fractional srcset densities resolve while ambiguous descriptors are flagged for review', () => {
    const body = '<img srcset="https://princetonterraceclub.org/wp-content/uploads/test.jpg 1.5x, /wp-content/uploads/review.jpg strange-descriptor">';
    const report = preflight(wxr(item(1, 'post', 'publish', '', body) + item(2, 'attachment', 'inherit', '<wp:attachment_url>https://princetonterraceclub.org/wp-content/uploads/test.jpg</wp:attachment_url>')));
    expect(report.media).toMatchObject({ bodyScanScope: 'selected-src-href-poster-srcset-attributes-only', distinctBodyUploadUrls: 1, bodyUploadUrlsMatchedToExport: 1, bodyUploadUrlsAbsentFromExport: 0, ambiguousSrcsetCandidates: 1, unmatchedReferences: 'not-proof-of-missing-files' });
  });

  test('source-URI path collisions and duplicate IDs remain visible without outputting private routes', () => {
    const xml = wxr(item(1) + item(2) + item(1, 'attachment', 'inherit')).replace('https://princetonterraceclub.org/source-1/', `https://princetonterraceclub.org/?p=1&token=${privateText}`).replace('https://princetonterraceclub.org/source-2/', `https://princetonterraceclub.org/?p=2&token=${privateText}`).replaceAll('&token=', '&amp;token=');
    const report = preflight(xml);
    expect(report.sourceIds.duplicateRecords).toBe(1);
    expect(report.redirects).toMatchObject({ validSourceUris: 2, withQueryOrFragment: 2, duplicateFullUris: 0, duplicateOriginPaths: 1, mappingsWritten: 0 });
    expect(JSON.stringify(report)).not.toContain(privateText);
  });

  test('namespace aliases, predefined/numeric references, quoted tag characters and CDATA data are accepted', () => {
    const xml = wxr(item(1, 'post', 'publish', '', '[et_pb_text] literal <!DOCTYPE html> &unknown;')).replaceAll('wp:', 'source:').replace('xmlns:wp=', 'xmlns:source=').replace(`<title>${privateText}</title>`, '<title value="quoted &gt; and &lt;">Text &amp; &#65;</title>');
    expect(preflight(xml).itemCount).toBe(1);
    expect(preflight(xml).pluginShapes.itemsWithShortcodes.divi).toBe(1);
  });

  test('invalid date/timezone shapes and wrong-type media references are gates, not invented conversions', () => {
    const report = preflight(wxr(item(1, 'tribe_events', 'publish', meta('_EventStartDate', '2030-02-31 12:00:00') + meta('_EventEndDate', '2030-03-01 13:00:00') + meta('_EventTimezone', privateText) + meta('_thumbnail_id', '2')) + item(2, 'page')));
    expect(report.events).toMatchObject({ withLocalDatePair: 1, validLocalDatePairs: 0, timezoneShapes: { runtimeRecognized: 0 }, publicCandidateEventsNeedingDateOrTimezoneReview: 1 });
    expect(report.media.idReferences.wrongType).toBe(1);
    expect(JSON.stringify(report)).not.toContain(privateText);
  });

  test('WordPress fixed-offset timezone shapes require conversion review rather than becoming missing fields', () => {
    const report = preflight(wxr(item(1, 'tribe_events', 'publish', meta('_EventStartDate', '2030-01-01 20:00:00') + meta('_EventEndDate', '2030-01-01 21:00:00') + meta('_EventTimezone', 'UTC-4'))));
    expect(report.events.withTimezone).toBe(1);
    expect(report.events.timezoneShapes).toEqual({ runtimeRecognized: 0, wordpressFixedOffset: 1, other: 0, missing: 0 });
    expect(report.events.publicCandidateEventsNeedingDateOrTimezoneReview).toBe(1);
  });

  test('external entity and content URLs are never fetched', async () => {
    let requests = 0;
    const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => { requests++; return new Response(privateText); } });
    try {
      const origin = `http://127.0.0.1:${server.port}`;
      expect(preflight(wxr(item(1, 'post', 'publish', '', `<iframe src="${origin}/private"></iframe><img src="${origin}/wp-content/uploads/private.jpg">`))).importsPerformed).toBe(0);
      expect(cli(`<!DOCTYPE rss SYSTEM "${origin}/external.dtd">${wxr(item(1)).replace(/<\?xml[^?]*\?>/, '')}`).status).toBe(1);
      await Bun.sleep(10);
      expect(requests).toBe(0);
    } finally { server.stop(true); }
  });

  test('rejects unsafe/malformed/deep/non-WXR inputs with a fixed error and no partial report', () => {
    const valid = wxr(item(1));
    const bad = [
      `<!DOCTYPE rss [<!ENTITY secret SYSTEM "file:///${privateText}">]>${valid.replace(/<\?xml[^?]*\?>/, '')}`,
      `<!DOCTYPE rss SYSTEM "https://${privateText}.example.invalid/">${valid.replace(/<\?xml[^?]*\?>/, '')}`,
      `<!ENTITY secret "${privateText}">${valid}`, valid.replace(privateText, `&${privateText};`),
      valid.replace('</channel>', ''), valid.replace('<wp:status>', '<wp:status><nested>'),
      valid.replace('<wp:status>', '<unbound:status>').replace('</wp:status>', '</unbound:status>'),
      valid.replace(`xmlns:wp="${wp}"`, 'xmlns:wp=""'), valid.replace('</channel>', `<a>${'<a>'.repeat(40)}${privateText}${'</a>'.repeat(40)}</a></channel>`),
      valid.replace('<channel>', '<channel xmlns:a="urn:test" xmlns:b="urn:test" a:x="1" b:x="2">'),
      valid.replace('<channel>', '<channel xmlns:a="http://www.w3.org/XML/1998/namespace">'),
      valid.replace('<channel>', `<channel ${Array.from({ length: 65 }, (_, i) => `a${i}="x"`).join(' ')}>`),
      valid.replace('<channel>', `<channel large="${'x'.repeat(17_000)}">`),
      valid.replace('</channel>', `${'<a/>'.repeat(100_001)}</channel>`),
      '<?xml-stylesheet href="https://example.invalid/private"?><rss/>', '<rss version="2.0"><channel/></rss>', '<x/>',
      valid.replace('<wp:wxr_version>1.2</wp:wxr_version>', '<wp:wxr_version>1.1</wp:wxr_version>'),
      wxr(`<wrapper>${item(1)}</wrapper>`),
      valid.replace('UTF-8', 'ISO-8859-1'), valid.replace(privateText, '\u0000'), Buffer.from([0xff, 0xfe]), Buffer.alloc(maxBytes + 1, 32)
    ];
    for (const input of bad) {
      const run = cli(input);
      expect(run.status).toBe(1);
      expect(run.stdout).toBe('');
      expect(run.stderr).toBe('Preflight failed. Supply a supported UTF-8 WordPress WXR export (up to 16 MiB) on standard input. No report was emitted.\n');
      expect(run.stderr).not.toContain(privateText);
    }
    expect(cli(valid, [privateText]).status).toBe(1);
  });

  test('the byte limit includes ignored whitespace and is accepted at the boundary', () => {
    const xml = wxr(item(1));
    const run = cli(xml + ' '.repeat(maxBytes - Buffer.byteLength(xml)));
    expect(run.status).toBe(0);
    expect(run.stderr).toBe('');
    expect(JSON.parse(run.stdout).itemCount).toBe(1);
  });

  test('the review plan accounts for every record without choosing targets or inferring effective access', () => {
    const xml = wxr(item(1) + item(2, 'page', 'draft') + item(3, 'tribe_events') + item(4, 'attachment', 'inherit') + item(5, privateText, privateText) + item(1, 'post', 'private') + item(6).replace('<wp:post_id>6</wp:post_id>', '<wp:post_id>invalid</wp:post_id>'));
    const plan = migrationPlan(xml);
    expect(plan.reconciliation).toEqual({ sourceRecords: 7, planRecords: 7, allSourceRecordsRepresented: true });
    expect(plan.summary).toEqual(preflight(xml));
    expect(plan.sourceSha256).toBe(createHash('sha256').update(xml).digest('hex'));
    expect(plan.records.map(row => row.sourceOrdinal)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(plan.records.map(row => row.identity)).toEqual(['duplicate', 'unique', 'unique', 'unique', 'unique', 'duplicate', 'missing-or-invalid']);
    expect(plan.records[0].contentScope).toBe('publish-status-candidate-access-unknown');
    expect(plan.records[1].contentScope).toBe('withheld');
    expect(plan.records[3].contentScope).toBe('not-post-page-event');
    expect(plan.records[4]).toMatchObject({ type: 'other', status: 'other', nextReview: 'preserve-unmapped-source-record' });
    expect(plan.records.every(row => row.target === null)).toBe(true);
    expect(plan.records.every(row => row.sourceId === null || Number.isSafeInteger(row.sourceId) && row.sourceId > 0)).toBe(true);
    expect(migrationPlan(wxr(item(Number.MAX_SAFE_INTEGER + 1))).records[0].sourceId).toBeNull();
    expect(plan.policy).toMatchObject({ effectiveAccess: 'unknown-requires-plugin-and-source-review', targetWrites: 0, publicationApproved: false, historicalGravityEntries: 'excluded' });
    expect(JSON.stringify(plan)).not.toContain(privateText);
    expect(migrationPlan(xml)).toEqual(plan);
    expect(migrationPlan(xml + '\n').sourceSha256).not.toBe(plan.sourceSha256);
  });

  test('plan output is exclusive, private and outside Git, with static stdout/errors and no source values', () => {
    const directory = mkdtempSync(join(realpathSync(tmpdir()), 'wxr-plan-'));
    try {
      chmodSync(directory, 0o700);
      const destination = join(directory, 'plan.json'), xml = '\uFEFF' + wxr(item(1));
      const run = cli(xml, ['--plan', destination]);
      expect(run.status).toBe(0);
      expect(run.stdout).toBe('Migration review plan written. No CMS data or redirects changed.\n');
      expect(run.stderr).toBe('');
      expect(statSync(destination).mode & 0o777).toBe(0o600);
      const written = readFileSync(destination, 'utf8');
      expect(written).not.toContain(privateText);
      expect(JSON.parse(written).sourceSha256).toBe(createHash('sha256').update(xml).digest('hex'));
      expect(JSON.parse(written).sourceBytes).toBe(Buffer.byteLength(xml));
      const git = join(directory, 'checkout'); mkdirSync(git, { mode: 0o700 }); mkdirSync(join(git, '.git'));
      const publicDir = join(directory, 'public'); mkdirSync(publicDir, { mode: 0o755 }); chmodSync(publicDir, 0o755);
      const link = join(directory, 'symlink.json'); symlinkSync(destination, link);
      const alias = join(directory, 'alias'); symlinkSync(git, alias);
      for (const output of [destination, link, join(git, 'plan.json'), join(alias, 'plan.json'), join(publicDir, 'plan.json'), join(directory, privateText, 'plan.json'), 'relative.json']) {
        const rejected = cli(xml, ['--plan', output]);
        expect(rejected.status).toBe(1);
        expect(rejected.stdout).toBe('');
        expect(rejected.stderr).toBe('Plan failed. Supply supported UTF-8 WXR and a new absolute JSON path in a private directory outside Git checkouts. No CMS data or redirects changed.\n');
        expect(rejected.stderr).not.toContain(privateText);
      }
      expect(readFileSync(destination, 'utf8')).toBe(written);
      expect(existsSync(join(git, 'plan.json'))).toBe(false);
      const malformed = join(directory, 'malformed.json');
      expect(cli(`<bad>${privateText}`, ['--plan', malformed]).status).toBe(1);
      expect(existsSync(malformed)).toBe(false);
      const original = join(directory, 'preserved.json'); writeFileSync(original, privateText, { mode: 0o600 });
      expect(cli(xml, ['--plan', original]).status).toBe(1);
      expect(readFileSync(original, 'utf8')).toBe(privateText);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
