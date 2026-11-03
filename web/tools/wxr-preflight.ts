import { stdin } from 'node:process';
import { parseXml, XmlElement, type XmlNode } from '@rgrove/parse-xml';

export const maxBytes = 16 * 1024 * 1024;
const types = ['post', 'page', 'tribe_events', 'attachment', 'nav_menu_item', 'et_pb_layout', 'tribe_organizer', 'tribe_venue', 'custom_css', 'wp_global_styles', 'project', 'revision', 'other'] as const;
const statuses = ['publish', 'private', 'draft', 'pending', 'future', 'inherit', 'trash', 'auto-draft', 'other'] as const;
const wpUris = ['http://wordpress.org/export/1.1/', 'http://wordpress.org/export/1.2/'];
const contentUri = 'http://purl.org/rss/1.0/modules/content/';
const safeHosts = new Set(['princetonterraceclub.org', 'www.princetonterraceclub.org', 'terracefclub.org', 'www.terracefclub.org']);
const events = ['_EventStartDate', '_EventEndDate', '_EventStartDateUTC', '_EventEndDateUTC', '_EventTimezone', '_EventAllDay', '_EventVenueID', '_EventOrganizerID'];
const knownMeta = new Set([...events, '_thumbnail_id', '_wp_attached_file', '_wp_attachment_metadata', '_wp_attachment_image_alt', '_et_pb_use_builder', '_et_pb_page_layout', '_et_pb_old_content', '_et_pb_built_for_post_type', '_yoast_wpseo_title', '_yoast_wpseo_metadesc', '_yoast_wpseo_canonical', '_yoast_wpseo_primary_category']);
const count = <T extends string>(keys: readonly T[]) => Object.fromEntries(keys.map(key => [key, 0])) as Record<T, number>;
const fail = (): never => { throw new Error('Unsupported WXR export.'); };

// Limit recursion and allocations before the strict parser builds a tree. This
// scanner only recognizes lexical boundaries; parseXml validates XML syntax.
function bounded(xml: string) {
  if (Buffer.byteLength(xml) > maxBytes) fail();
  let cursor = 0, depth = 0, nodes = 0;
  while (true) {
    const start = xml.indexOf('<', cursor);
    if (start < 0) break;
    const skip = (prefix: string, end: string) => {
      if (!xml.startsWith(prefix, start)) return false;
      const close = xml.indexOf(end, start + prefix.length);
      if (close < 0) fail();
      cursor = close + end.length;
      return true;
    };
    if (skip('<![CDATA[', ']]>') || skip('<!--', '-->')) continue;
    if (xml.startsWith('<?', start)) {
      if (start > 1 || !/^<\?xml\s/.test(xml.slice(start, start + 8))) fail();
      if (!skip('<?xml', '?>')) fail();
      continue;
    }
    if (xml.startsWith('<!', start)) fail(); // DTDs, entity and other declarations.
    let end = start + 1, quote = '';
    for (; end < xml.length; end++) {
      const char = xml[end];
      if (quote) { if (char === quote) quote = ''; }
      else if (char === '"' || char === "'") quote = char;
      else if (char === '>') break;
    }
    if (end === xml.length || end - start > 16_384) fail();
    if (xml[start + 1] === '/') depth--;
    else {
      if (++nodes > 100_000) fail();
      if (!xml.slice(start, end).trimEnd().endsWith('/')) depth++;
    }
    if (depth < 0 || depth > 32) fail();
    cursor = end + 1;
  }
  if (depth !== 0) fail();
}

function names(root: XmlElement) {
  const expanded = new WeakMap<XmlElement, { local: string; uri: string }>();
  const xmlUri = 'http://www.w3.org/XML/1998/namespace';
  const xmlnsUri = 'http://www.w3.org/2000/xmlns/';
  function visit(node: XmlElement, inherited: Map<string, string>) {
    const scope = new Map(inherited);
    if (Object.keys(node.attributes).length > 64) fail();
    for (const [key, value] of Object.entries(node.attributes)) {
      if (key === 'xmlns') { if (value === xmlUri || value === xmlnsUri) fail(); scope.set('', value); }
      else if (key.startsWith('xmlns:')) {
        const prefix = key.slice(6);
        if (!prefix || prefix.includes(':') || prefix === 'xmlns' || !value || value === xmlnsUri || prefix === 'xml' && value !== xmlUri || prefix !== 'xml' && value === xmlUri) fail();
        scope.set(prefix, value);
      }
    }
    const resolve = (name: string, attribute = false) => {
      const parts = name.split(':');
      if (parts.length > 2 || parts.some(part => !part) || parts[0] === 'xmlns') return fail();
      if (parts.length === 2 && !scope.get(parts[0])) return fail();
      return { local: parts.at(-1)!, uri: parts.length === 2 ? scope.get(parts[0])! : attribute ? '' : scope.get('') || '' };
    };
    expanded.set(node, resolve(node.name));
    const attributes = new Set<string>();
    for (const key of Object.keys(node.attributes).filter(key => key !== 'xmlns' && !key.startsWith('xmlns:'))) {
      const attr = resolve(key, true), identity = `${attr.uri}\0${attr.local}`;
      if (attributes.has(identity)) fail();
      attributes.add(identity);
    }
    for (const child of node.children) if (child instanceof XmlElement) visit(child, scope);
  }
  visit(root, new Map([['xml', xmlUri]]));
  return (node: XmlElement, local: string, uri = '') => {
    const name = expanded.get(node)!;
    return name.local === local && name.uri === uri;
  };
}

type Item = { id: number | null; parent: number | null; type: typeof types[number]; status: typeof statuses[number]; protected: boolean; body: string; link: string; attachment: string; meta: Map<string, string> };
const id = (value: string) => /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
function url(value: string, base?: string): URL | null {
  try {
    const parsed = base ? new URL(value, base) : new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed : null;
  } catch { return null; }
}
function originSummary(values: string[]) {
  const valid = values.map(value => url(value)).filter((value): value is URL => value !== null);
  const unique = new Set(valid.map(value => value.origin));
  return {
    references: values.length, invalidOrCredentialBearing: values.length - valid.length,
    distinctOrigins: unique.size, mixedOrigins: unique.size > 1,
    knownOrigins: [...unique].filter(value => safeHosts.has(new URL(value).hostname)).sort(),
    otherOrigins: [...unique].filter(value => !safeHosts.has(new URL(value).hostname)).length,
    queryOrFragmentReferences: valid.filter(value => value.search || value.hash).length
  };
}
function dateShape(value = '') {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return false;
  const date = new Date(value.replace(' ', 'T') + 'Z');
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 19).replace('T', ' ') === value;
}
function timezone(value = ''): 'runtimeRecognized' | 'wordpressFixedOffset' | 'other' | 'missing' {
  if (!value) return 'missing';
  if (/^UTC[+-](?:0?\d|1[0-4])(?:(?::[0-5]\d)|(?:\.(?:25|5|75)))?$/i.test(value)) return 'wordpressFixedOffset';
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }); return 'runtimeRecognized'; } catch { return 'other'; }
}

export function preflight(xml: string) {
  try { return analyze(xml); } catch { return fail(); }
}
function analyze(xml: string) {
  bounded(xml);
  const document = parseXml(xml, { preserveXmlDeclaration: true });
  const declaration = document.children.find(node => node.type === 'xmldecl') as XmlNode & { version: string; encoding?: string } | undefined;
  if (declaration && (declaration.version !== '1.0' || declaration.encoding && !['utf-8', 'utf8'].includes(declaration.encoding.toLowerCase()))) fail();
  const root = document.root;
  if (!root) return fail();
  const is = names(root);
  const children = (node: XmlElement, local: string, uri = '') => node.children.filter((child): child is XmlElement => child instanceof XmlElement && is(child, local, uri));
  const field = (node: XmlElement, local: string, uri = '', trim = true) => {
    const matches = children(node, local, uri);
    if (matches.length > 1 || matches[0]?.children.some(child => child instanceof XmlElement)) fail();
    const value = matches[0]?.text || '';
    return trim ? value.trim() : value;
  };
  if (!is(root, 'rss') || root.attributes.version !== '2.0') fail();
  const channels = children(root, 'channel');
  if (channels.length !== 1) return fail();
  const channel = channels[0];
  const wp = wpUris.find(uri => field(channel, 'wxr_version', uri) === uri.split('/').at(-2));
  if (!wp) return fail();
  const rawItems = children(channel, 'item');
  if (rawItems.length > 10_000) fail();
  const itemSet = new Set(rawItems);
  const checkItems = (node: XmlElement) => {
    for (const child of node.children) if (child instanceof XmlElement) {
      if (is(child, 'item') && !itemSet.has(child)) fail();
      checkItems(child);
    }
  };
  checkItems(root);
  let comments = 0, otherMeta = 0;
  const items: Item[] = rawItems.map(node => {
    const rawType = field(node, 'post_type', wp), rawStatus = field(node, 'status', wp);
    const meta = new Map<string, string>();
    for (const entry of children(node, 'postmeta', wp)) {
      const key = field(entry, 'meta_key', wp);
      if (knownMeta.has(key)) {
        if (meta.has(key)) fail();
        meta.set(key, field(entry, 'meta_value', wp));
      } else otherMeta++;
    }
    comments += children(node, 'comment', wp).length;
    return { id: id(field(node, 'post_id', wp)), parent: id(field(node, 'post_parent', wp)), type: types.includes(rawType as Item['type']) ? rawType as Item['type'] : 'other', status: statuses.includes(rawStatus as Item['status']) ? rawStatus as Item['status'] : 'other', protected: Boolean(field(node, 'post_password', wp, false)), body: field(node, 'encoded', contentUri), link: field(node, 'link'), attachment: field(node, 'attachment_url', wp), meta };
  });
  const ids = new Map<number, Item[]>();
  for (const item of items) if (item.id) ids.set(item.id, [...(ids.get(item.id) || []), item]);
  const byType = Object.fromEntries(types.map(type => [type, { total: 0, ...count(statuses), passwordProtected: 0 }])) as Record<Item['type'], { total: number; passwordProtected: number } & Record<Item['status'], number>>;
  for (const item of items) { byType[item.type].total++; byType[item.type][item.status]++; if (item.protected) byType[item.type].passwordProtected++; }
  const content = items.filter(item => ['post', 'page', 'tribe_events'].includes(item.type));
  const publicCandidates = content.filter(item => item.status === 'publish' && !item.protected);
  const channelLinks = [field(channel, 'link')].filter(Boolean), siteUrls = [field(channel, 'base_site_url', wp)].filter(Boolean), blogUrls = [field(channel, 'base_blog_url', wp)].filter(Boolean);
  const sourceValues = [...siteUrls, ...blogUrls, ...channelLinks];
  const base = sourceValues.map(value => url(value)).find(Boolean)?.origin;
  const attachments = items.filter(item => item.type === 'attachment');
  const attachmentUrls = attachments.map(item => item.attachment).filter(Boolean);
  const uploadUrls = new Set(attachmentUrls.map(value => url(value)).filter((value): value is URL => value !== null).map(value => value.origin + value.pathname));
  const references = { resolved: 0, missing: 0, wrongType: 0, ambiguous: 0, invalid: 0 };
  const reference = (value: string, type: Item['type'], target = references) => {
    const sourceId = id(value);
    if (!sourceId) { target.invalid++; return; }
    const matches = ids.get(sourceId) || [];
    if (!matches.length) target.missing++;
    else if (matches.length > 1) target.ambiguous++;
    else if (matches[0].type !== type) target.wrongType++;
    else target.resolved++;
  };
  const bodyUploads = new Set<string>();
  let invalidBodyUploads = 0, ambiguousSrcsetCandidates = 0;
  const shortcode = count(['divi', 'gravityForms', 'eventsCalendar', 'pdfViewer', 'documentEmbed', 'payments', 'other'] as const);
  const markup = count(['script', 'iframe', 'form'] as const);
  const metadataItems = count(['divi', 'eventsCalendar', 'yoast', 'media'] as const);
  for (const item of items) {
    const thumbnail = item.meta.get('_thumbnail_id');
    if (thumbnail && thumbnail !== '0') reference(thumbnail, 'attachment');
    for (const sourceId of new Set([...item.body.matchAll(/\b(?:wp-image-|attachment_)(\d+)\b/g)].map(match => match[1]))) reference(sourceId, 'attachment');
    for (const match of item.body.matchAll(/\b(src|href|poster|srcset)\s*=\s*["']([^"']*)["']/gi)) {
      const candidates = match[1].toLowerCase() === 'srcset' ? match[2].split(',') : [match[2]];
      for (let value of candidates) {
        if (!value.includes('/wp-content/uploads/')) continue;
        if (match[1].toLowerCase() === 'srcset') {
          const candidate = value.trim().match(/^(\S+)(?:\s+((?:\d+(?:\.\d+)?|\.\d+)x|\d+w))?$/);
          if (!candidate || candidate[2] && Number.parseFloat(candidate[2]) <= 0) { ambiguousSrcsetCandidates++; continue; }
          value = candidate[1];
        }
        const parsed = url(value, base);
        if (!parsed) invalidBodyUploads++;
        else bodyUploads.add(parsed.origin + parsed.pathname);
      }
    }
    const found = new Set<keyof typeof shortcode>();
    for (const match of item.body.matchAll(/\[(?!\[)\/?([a-z][a-z0-9_-]*)\b/gi)) {
      const name = match[1].toLowerCase();
      found.add(name.startsWith('et_pb_') ? 'divi' : name === 'gravityform' ? 'gravityForms' : /^(tribe_|tec_)/.test(name) ? 'eventsCalendar' : /^(flowpaper|flipbook|real3dflipbook|pdfjs-viewer)$/.test(name) ? 'pdfViewer' : /^(gview|google-drive-embed|google-drive-folder|embed)$/.test(name) ? 'documentEmbed' : /^(stripe|paypal|wp_paypal|give_form|donation)$/.test(name) ? 'payments' : 'other');
    }
    for (const key of found) shortcode[key]++;
    for (const key of ['script', 'iframe', 'form'] as const) if (new RegExp(`<${key}\\b`, 'i').test(item.body)) markup[key]++;
    const keys = [...item.meta.keys()];
    if (keys.some(key => key.startsWith('_et_pb_'))) metadataItems.divi++;
    if (keys.some(key => events.includes(key))) metadataItems.eventsCalendar++;
    if (keys.some(key => key.startsWith('_yoast_wpseo_'))) metadataItems.yoast++;
    if (keys.some(key => key.startsWith('_wp_attach'))) metadataItems.media++;
  }
  const eventItems = items.filter(item => item.type === 'tribe_events');
  const timezoneShapes = count(['runtimeRecognized', 'wordpressFixedOffset', 'other', 'missing'] as const);
  for (const item of eventItems) timezoneShapes[timezone(item.meta.get('_EventTimezone'))]++;
  const eventRelations = { resolved: 0, missing: 0, wrongType: 0, ambiguous: 0, invalid: 0 };
  for (const item of eventItems) for (const [key, type] of [['_EventVenueID', 'tribe_venue'], ['_EventOrganizerID', 'tribe_organizer']] as const) {
    const value = item.meta.get(key);
    if (value && value !== '0') reference(value, type, eventRelations);
  }
  const routes = publicCandidates.map(item => url(item.link)).filter((value): value is URL => value !== null);
  const uriKeys = routes.map(value => value.origin + value.pathname + value.search), pathKeys = routes.map(value => value.origin + value.pathname);
  return {
    schemaVersion: 1, itemCount: items.length, authorRecordCount: children(channel, 'author', wp).length, commentCount: comments,
    byType, sourceIds: { missingOrInvalid: items.filter(item => !item.id).length, duplicateRecords: [...ids.values()].reduce((sum, group) => sum + Math.max(0, group.length - 1), 0) },
    scope: { publishStatusContentWithoutPassword: publicCandidates.length, otherOrPasswordProtectedContent: content.length - publicCandidates.length, attachmentVisibility: 'not-inferred-from-inherit-status', effectiveAccessControls: 'requires-source-review', historicalGravityEntries: 'excluded' },
    sourceOrigins: { channel: originSummary(channelLinks), baseSite: originSummary(siteUrls), baseBlog: originSummary(blogUrls), combined: originSummary(sourceValues), contentLinks: originSummary(content.map(item => item.link).filter(Boolean)), attachments: originSummary(attachmentUrls) },
    media: { attachmentRecords: attachments.length, attachmentUrlFields: attachmentUrls.length, uniqueValidAttachmentUrls: uploadUrls.size, idReferences: references, bodyScanScope: 'selected-src-href-poster-srcset-attributes-only', distinctBodyUploadUrls: bodyUploads.size, bodyUploadUrlsMatchedToExport: [...bodyUploads].filter(value => uploadUrls.has(value)).length, bodyUploadUrlsAbsentFromExport: [...bodyUploads].filter(value => !uploadUrls.has(value)).length, ambiguousSrcsetCandidates, invalidBodyUploadUrls: invalidBodyUploads, fileBytesAndHashes: 'not-checked-no-files-or-network', unmatchedReferences: 'not-proof-of-missing-files' },
    pluginShapes: { itemsWithShortcodes: shortcode, itemsWithMarkup: markup, itemsWithKnownMetadata: metadataItems, otherMetadataRecords: otherMeta },
    events: { records: eventItems.length, withLocalDatePair: eventItems.filter(item => item.meta.has('_EventStartDate') && item.meta.has('_EventEndDate')).length, withUtcDatePair: eventItems.filter(item => item.meta.has('_EventStartDateUTC') && item.meta.has('_EventEndDateUTC')).length, withTimezone: eventItems.filter(item => item.meta.get('_EventTimezone')).length, withAllDayField: eventItems.filter(item => item.meta.has('_EventAllDay')).length, validLocalDatePairs: eventItems.filter(item => dateShape(item.meta.get('_EventStartDate')) && dateShape(item.meta.get('_EventEndDate'))).length, validUtcDatePairs: eventItems.filter(item => dateShape(item.meta.get('_EventStartDateUTC')) && dateShape(item.meta.get('_EventEndDateUTC'))).length, timezoneShapes, publicCandidateEventsNeedingDateOrTimezoneReview: eventItems.filter(item => item.status === 'publish' && !item.protected && (!dateShape(item.meta.get('_EventStartDate')) || !dateShape(item.meta.get('_EventEndDate')) || timezone(item.meta.get('_EventTimezone')) !== 'runtimeRecognized')).length, venueOrganizerReferences: eventRelations },
    redirects: { publicCandidateRecords: publicCandidates.length, validSourceUris: routes.length, missingInvalidOrCredentialBearing: publicCandidates.length - routes.length, withQueryOrFragment: routes.filter(value => value.search || value.hash).length, duplicateFullUris: uriKeys.length - new Set(uriKeys).size, duplicateOriginPaths: pathKeys.length - new Set(pathKeys).size, mappingsWritten: 0 },
    gates: ['full-database-and-files-backup', 'media-file-and-checksum-reconciliation', 'editorial-and-effective-access-review', 'shortcode-and-plugin-conversion-review', 'event-timezone-and-relationship-review', 'private-source-uri-redirect-ledger', 'no-wordpress-user-to-keycloak-auto-mapping'],
    importsPerformed: 0
  };
}

if (import.meta.main) {
  try {
    if (process.argv.length !== 2 || stdin.isTTY) fail();
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of stdin) { size += chunk.length; if (size > maxBytes) fail(); chunks.push(chunk); }
    const input = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
    console.log(JSON.stringify(preflight(input), null, 2));
  } catch {
    console.error('Preflight failed. Supply a supported UTF-8 WordPress WXR export (up to 16 MiB) on standard input. No report was emitted.');
    process.exitCode = 1;
  }
}
