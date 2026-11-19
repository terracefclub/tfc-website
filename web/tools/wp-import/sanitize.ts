// Allowlist HTML sanitizer and shortcode converter for imported WordPress/Divi bodies.
// Pure and dependency-free so both the planner (web) and the applier (cms) can use it.
// Policy: nothing is passed through. Unknown elements are unwrapped, dangerous elements
// are removed with their content, every attribute not on the allowlist is dropped and
// URLs must use an allowed scheme. The output of sanitizeHtml is a fixed point:
// sanitizeHtml(sanitizeHtml(x).html).html === sanitizeHtml(x).html with no findings.

export type Findings = Record<string, number>;
export type Sanitized = { html: string; findings: Findings; unsafe: boolean };

// Finding kinds that mean the source carried active or unreviewable content. Such a
// document is still imported (stripped) but only ever as a draft needing review.
const unsafeKinds = new Set(['oversize', 'oversize-tag', 'script', 'iframe', 'object', 'embed', 'form', 'style-element', 'svg', 'event-handler', 'unsafe-url', 'builder-code', 'raw-text-element']);

const allowed: Record<string, readonly string[]> = {
  p: [], br: [], hr: [], h2: [], h3: [], h4: [], h5: [], h6: [], ul: [], ol: ['start'], li: [], strong: [], em: [], u: [], blockquote: [], code: [], pre: [], sup: [], sub: [],
  a: ['href', 'title'], img: ['src', 'alt', 'title', 'width', 'height'], figure: [], figcaption: [],
  table: [], thead: [], tbody: [], tr: [], th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'],
};
const alias: Record<string, string> = { b: 'strong', i: 'em', h1: 'h2' };
const voidTags = new Set(['br', 'hr', 'img']);
// Removed together with everything inside them.
const dropWithContent: Record<string, string> = {
  script: 'script', style: 'style-element', iframe: 'iframe', object: 'object', embed: 'embed', applet: 'object', frame: 'iframe', frameset: 'iframe',
  form: 'form', svg: 'svg', math: 'svg', noscript: 'raw-text-element', template: 'raw-text-element', textarea: 'raw-text-element', select: 'raw-text-element',
  title: 'raw-text-element', xmp: 'raw-text-element', plaintext: 'raw-text-element', noembed: 'raw-text-element', noframes: 'raw-text-element', head: 'raw-text-element',
};
// Single tags with no content to skip.
const dropVoid: Record<string, string> = { input: 'form', button: 'form', link: 'unsafe-url', meta: 'unsafe-url', base: 'unsafe-url', source: 'embed', track: 'embed', param: 'object' };

const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', colon: ':', tab: '\t', newline: '\n', lpar: '(', rpar: ')' };
export function decodeEntities(value: string): string {
  return value.replace(/&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-zA-Z][a-zA-Z0-9]*));?/g, (whole, dec, hex, name) => {
    const code = dec ? Number(dec) : hex ? Number.parseInt(hex, 16) : undefined;
    if (code !== undefined) return code > 0x10ffff || code >= 0xd800 && code < 0xe000 ? '' : String.fromCodePoint(code);
    return Object.hasOwn(named, name) ? named[name] : whole;
  });
}
const escapeText = (value: string) => value.replace(/&(?!(?:#\d+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Returns a normalized safe URL string or null. `kind` img only accepts http(s) and site-relative paths. */
export function safeUrl(raw: string, kind: 'link' | 'img'): string | null {
  const value = decodeEntities(raw).replace(/[\u0000-\u0020\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g, '');
  if (!value || value.length > 2048) return null;
  if (value.includes('\\') || value.startsWith('//')) return null; // `/\evil.com` and `\\evil.com` are read as protocol-relative by browsers
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(value);
  if (!scheme) return /^[^:]*$/.test(value) || value.startsWith('/') || value.startsWith('#') ? value : null;
  const name = scheme[1].toLowerCase();
  if (name === 'http' || name === 'https') {
    try { const url = new URL(value); return url.username || url.password ? null : value; } catch { return null; }
  }
  if (kind === 'link' && (name === 'mailto' || name === 'tel')) return value;
  return null;
}

function bump(findings: Findings, kind: string) { findings[kind] = (findings[kind] ?? 0) + 1; }

type Attribute = { name: string; value: string };
function parseAttributes(source: string): Attribute[] {
  const result: Attribute[] = [];
  const pattern = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    result.push({ name: match[1].toLowerCase(), value: match[2] ?? match[3] ?? match[4] ?? '' });
  }
  return result;
}

/** Longest input and longest single tag the sanitizer will scan; bounds the unterminated-tag rescan cost. */
export const maxHtmlBytes = 1024 * 1024;
const maxTagLength = 2048;

export function sanitizeHtml(rawInput: string): Sanitized {
  if (rawInput.length > maxHtmlBytes) return { html: '', findings: { oversize: 1 }, unsafe: true };
  const input = rawInput;
  const findings: Findings = {};
  const stack: string[] = [];
  let out = '';
  let i = 0;
  const text = (value: string) => { out += escapeText(value); };
  while (i < input.length) {
    const lt = input.indexOf('<', i);
    if (lt === -1) { text(input.slice(i)); break; }
    if (lt > i) text(input.slice(i, lt));
    i = lt;
    if (input.startsWith('<!--', i)) {
      const end = input.indexOf('-->', i + 4);
      bump(findings, 'comment');
      i = end === -1 ? input.length : end + 3;
      continue;
    }
    if (input[i + 1] === '!' || input[i + 1] === '?') {
      bump(findings, 'declaration');
      const end = input.indexOf('>', i);
      i = end === -1 ? input.length : end + 1;
      continue;
    }
    const open = /^<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)/.exec(input.slice(i, i + 80));
    if (!open) { out += '&lt;'; i++; continue; }
    // Find the end of the tag, honouring quoted attribute values.
    let end = i + open[0].length, quote = '';
    const limit = Math.min(input.length, i + maxTagLength);
    for (; end < limit; end++) {
      const ch = input[end];
      if (quote) { if (ch === quote) quote = ''; } else if (ch === '"' || ch === "'") quote = ch; else if (ch === '>') break;
    }
    if (end >= limit) { if (limit - i >= maxTagLength) bump(findings, 'oversize-tag'); out += '&lt;'; i++; continue; } // unterminated or implausibly long: treat '<' as text
    const closing = open[1] === '/', raw = open[2].toLowerCase();
    const attrSource = input.slice(i + open[0].length, end);
    i = end + 1;
    if (Object.hasOwn(dropWithContent, raw)) {
      bump(findings, dropWithContent[raw]);
      if (!closing && !attrSource.trimEnd().endsWith('/')) {
        const closer = new RegExp(`</${raw.replace(/[^a-z0-9]/g, '')}\\s*>`, 'gi');
        closer.lastIndex = i; // search in place: slicing here made many small elements quadratic
        const close = closer.exec(input);
        i = close ? close.index + close[0].length : input.length;
      }
      continue;
    }
    if (Object.hasOwn(dropVoid, raw)) { bump(findings, dropVoid[raw]); continue; }
    const name = alias[raw] ?? raw;
    if (!Object.hasOwn(allowed, name)) { bump(findings, 'unwrapped-element'); continue; }
    if (closing) {
      const at = stack.lastIndexOf(name);
      if (at === -1 || voidTags.has(name)) continue;
      while (stack.length > at) out += `</${stack.pop()}>`;
      continue;
    }
    let tag = `<${name}`;
    let usable = true;
    for (const attribute of parseAttributes(attrSource)) {
      if (attribute.name.startsWith('on')) { bump(findings, 'event-handler'); continue; }
      if (name === 'a' && attribute.name === 'rel') continue; // always re-emitted below with a fixed value
      if (!allowed[name].includes(attribute.name)) { bump(findings, 'attribute-removed'); continue; }
      let value = attribute.value;
      if (attribute.name === 'href' || attribute.name === 'src') {
        const safe = safeUrl(value, name === 'img' ? 'img' : 'link');
        if (safe === null) { bump(findings, 'unsafe-url'); if (attribute.name === 'src') usable = false; continue; }
        value = safe;
      } else if (['width', 'height', 'colspan', 'rowspan', 'start'].includes(attribute.name)) {
        if (!/^\d{1,5}$/.test(value.trim())) { bump(findings, 'attribute-removed'); continue; }
        value = value.trim();
      } else value = decodeEntities(value);
      tag += ` ${attribute.name}="${escapeAttr(value)}"`;
    }
    if (name === 'img' && !usable) continue;
    if (name === 'img' && !/ alt="/.test(tag)) tag += ' alt=""';
    if (name === 'a' && !/ href="/.test(tag)) { bump(findings, 'unwrapped-element'); continue; }
    if (name === 'a') tag += ' rel="noopener noreferrer"';
    out += `${tag}>`;
    if (!voidTags.has(name)) stack.push(name);
  }
  while (stack.length) out += `</${stack.pop()}>`;
  const html = out.replace(/(?:<p>\s*<\/p>\s*)+/g, '').trim();
  return { html, findings, unsafe: Object.keys(findings).some(kind => unsafeKinds.has(kind)) };
}

/** True only when html is already exactly what the sanitizer would emit. */
export function isSafeHtml(html: string): boolean {
  const result = sanitizeHtml(html);
  return result.html === html.trim() && Object.keys(result.findings).length === 0;
}

// --- shortcodes -------------------------------------------------------------------------------

const dropShortcode = /^(?:gravityforms?|gf|tribe[_-].*|tec[_-].*|flowpaper|flipbook|real3dflipbook|pdfjs-viewer|gview|google-drive-.*|stripe|paypal|wp_paypal|give_form|donation|gallery|playlist|audio|video|contact-form-7|wpforms|wp_caption_unused)$/i;
const diviCode = /^et_pb_(?:fullwidth_)?code$/i;

function shortcodeAttributes(source: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const match of source.matchAll(/([a-zA-Z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+))/g)) result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return result;
}

/**
 * Convert the shortcodes we understand and strip the rest, keeping the human text inside
 * paired layout shortcodes. Divi code modules are dropped entirely (raw code is never imported).
 * Unknown bracketed text such as "[sic]" is left alone.
 */
export function convertShortcodes(input: string): { text: string; findings: Findings } {
  const findings: Findings = {};
  let text = input;
  // Raw code modules: drop the whole block including its content.
  text = text.replace(/\[(et_pb_(?:fullwidth_)?code)\b[^\]]*\][\s\S]*?\[\/\1\s*\]/gi, () => { bump(findings, 'builder-code'); return ''; });
  text = text.replace(/\[caption\b[^\]]*\]([\s\S]*?)\[\/caption\s*\]/gi, (_whole, inner) => { bump(findings, 'shortcode-converted'); return inner; });
  text = text.replace(/\[embed\b[^\]]*\]\s*([^\[\]\s]+)\s*\[\/embed\s*\]/gi, (_whole, link) => { bump(findings, 'shortcode-converted'); return `<a href="${escapeAttr(link)}">${escapeText(link)}</a>`; });
  text = text.replace(/\[(\/?)([a-zA-Z][\w-]*)((?:\s+[^\]]*)?)\]/g, (whole, slash: string, name: string, attrs: string) => {
    const lower = name.toLowerCase();
    if (lower.startsWith('et_pb_') || lower.startsWith('et_') || lower.startsWith('vc_')) {
      if (slash) return '';
      const a = shortcodeAttributes(attrs);
      if (lower === 'et_pb_image' && a.src) { bump(findings, 'shortcode-converted'); return `<img src="${escapeAttr(a.src)}" alt="${escapeAttr(a.alt ?? a.title_text ?? '')}">`; }
      if (lower === 'et_pb_button' && a.button_url) { bump(findings, 'shortcode-converted'); return `<p><a href="${escapeAttr(a.button_url)}">${escapeText(decodeEntities(a.button_text ?? a.button_url))}</a></p>`; }
      if (lower === 'et_pb_blurb' && a.title) { bump(findings, 'shortcode-converted'); return `<h3>${escapeText(decodeEntities(a.title))}</h3>`; }
      bump(findings, 'layout-shortcode-stripped');
      return '';
    }
    if (dropShortcode.test(lower)) { bump(findings, /^gravity|^gf$|^wpforms|^contact-form/i.test(lower) ? 'form-shortcode-dropped' : 'plugin-shortcode-dropped'); return ''; }
    return whole;
  });
  return { text, findings };
}

const blockStart = /^<(?:h[1-6]|ul|ol|table|blockquote|figure|div|hr|p|pre)\b/i;
/** WordPress's wpautop in miniature: blank-line separated chunks become paragraphs. */
export function autoParagraph(input: string): string {
  const text = input.replace(/\r\n?/g, '\n').trim();
  if (!text) return '';
  if (/<\/p>/i.test(text)) return text;
  return text.split(/\n\s*\n/).map(chunk => chunk.trim()).filter(Boolean)
    .map(chunk => blockStart.test(chunk) ? chunk : `<p>${chunk.replace(/\n/g, '<br>')}</p>`).join('\n');
}

export function mergeFindings(...all: Findings[]): Findings {
  const merged: Findings = {};
  for (const findings of all) for (const [kind, count] of Object.entries(findings)) merged[kind] = (merged[kind] ?? 0) + count;
  return merged;
}

/** Full pipeline for a WordPress body: shortcodes, paragraphs, then the allowlist sanitizer. */
export function convertBody(raw: string): Sanitized {
  const converted = convertShortcodes(raw);
  const sanitized = sanitizeHtml(autoParagraph(converted.text));
  const findings = mergeFindings(converted.findings, sanitized.findings);
  return { html: sanitized.html, findings, unsafe: sanitized.unsafe || Object.keys(converted.findings).some(kind => unsafeKinds.has(kind)) };
}

/** Plain text for collections whose current frontend renders textareas as text. */
export function htmlToText(html: string): string {
  return decodeEntities(html
    .replace(/<(?:br|\/p|\/h[2-6]|\/li|\/tr|\/blockquote|\/figure|\/pre)\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ''))
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function excerptText(html: string, max = 280): string {
  const text = htmlToText(html).replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), 40)).trimEnd() + '…';
}
