import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

// SvelteKit throws when a response header is set twice, and a no-script form POST runs an action and then
// `load` for the same request. So each header must be set in exactly one place: the hooks, or one route module.

const root = join(import.meta.dir, '..', 'src');
const routes = join(root, 'routes');

/** Index just past the string or template literal that starts at `start`, or -1 when it is unterminated. A template's `${...}` parts are skipped as code. */
function skipLiteral(source: string, start: number): number {
  const quote = source[start];
  for (let i = start + 1; i < source.length; i++) {
    const c = source[i];
    if (c === '\\') { i++; continue; }
    if (c === quote) return i + 1;
    if (quote === '`' && c === '$' && source[i + 1] === '{') { const end = skipBraces(source, i + 1); if (end < 0) return -1; i = end - 1; continue; }
    if (quote !== '`' && c === '\n') return -1;
  }
  return -1;
}

/** Index just past the `}` that closes the `{` at `start`, ignoring braces inside strings, templates and comments; -1 when unbalanced. */
function skipBraces(source: string, start: number): number {
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (c === '"' || c === "'" || c === '`') { const end = skipLiteral(source, i); if (end < 0) return -1; i = end - 1; continue; }
    if (c === '/' && source[i + 1] === '/') { const end = source.indexOf('\n', i); if (end < 0) return -1; i = end; continue; }
    if (c === '/' && source[i + 1] === '*') { const end = source.indexOf('*/', i + 2); if (end < 0) return -1; i = end + 1; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i + 1;
  }
  return -1;
}

/** Split an object literal's body at its top-level commas, so nested objects, calls, strings and templates stay whole. Null when it cannot be read. */
function topLevelEntries(body: string): string[] | null {
  const entries: string[] = [];
  let depth = 0, from = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '"' || c === "'" || c === '`') { const end = skipLiteral(body, i); if (end < 0) return null; i = end - 1; continue; }
    if (c === '/' && body[i + 1] === '/') { const end = body.indexOf('\n', i); if (end < 0) { body = body.slice(0, i); break; } i = end; continue; }
    if (c === '/' && body[i + 1] === '*') { const end = body.indexOf('*/', i + 2); if (end < 0) return null; i = end + 1; continue; }
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) { entries.push(body.slice(from, i)); from = i + 1; }
  }
  if (depth !== 0) return null;
  entries.push(body.slice(from));
  return entries.map((entry) => entry.trim()).filter(Boolean);
}

/**
 * Source without comments. Strings and template literals are copied whole, so a `//` or `/*` inside one never starts a comment (and never hides
 * the code after it). `ok` is false when a string, template or block comment is unterminated: the caller must treat the file as unreadable.
 */
export function stripComments(source: string): { code: string; ok: boolean } {
  let code = '';
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"' || c === "'" || c === '`') { const end = skipLiteral(source, i); if (end < 0) return { code: code + source.slice(i), ok: false }; code += source.slice(i, end); i = end - 1; continue; }
    if (c === '/' && source[i + 1] === '/') { const end = source.indexOf('\n', i); if (end < 0) break; i = end - 1; continue; }
    if (c === '/' && source[i + 1] === '*') { const end = source.indexOf('*/', i + 2); if (end < 0) return { code, ok: false }; code += ' '; i = end + 1; continue; }
    code += c;
  }
  return { code, ok: true };
}

/**
 * Header names passed to direct `setHeaders({...})` calls. Anything that cannot be read with certainty fails closed:
 * a computed key, a spread, a non-literal argument, an object that does not close, and any alias or member use of `setHeaders`
 * (`const { setHeaders: s } = event`, `event.setHeaders(...)`, `const s = setHeaders`, `run(setHeaders)`).
 * The object is read by a tokenizer that understands strings, template literals and nesting, so a `}` inside a value does not end it.
 */
export function headerCalls(source: string): { names: string[]; unreadable: string[] } {
  const names: string[] = [];
  const unreadable: string[] = [];
  for (const call of source.matchAll(/(?<![.\w$])setHeaders\s*\(/g)) {
    const start = call.index! + call[0].length;
    const open = /^\s*\{/.exec(source.slice(start));
    if (!open) { unreadable.push('a call whose argument is not an object literal'); continue; }
    const brace = start + open[0].length - 1;
    const end = skipBraces(source, brace);
    const entries = end < 0 ? null : topLevelEntries(source.slice(brace + 1, end - 1));
    if (!entries) { unreadable.push('a headers object that cannot be read to its end'); continue; }
    for (const entry of entries) {
      if (entry.startsWith('...')) { unreadable.push('a spread in the headers'); continue; }
      if (entry.startsWith('[')) { unreadable.push('a computed header name'); continue; }
      const key = /^(?:'([^']+)'|"([^"]+)"|([A-Za-z][\w-]*))\s*(?::|$)/.exec(entry);
      if (key) names.push((key[1] ?? key[2] ?? key[3]).toLowerCase());
      else unreadable.push('a header entry that is not a plain name');
    }
  }
  if (/\bsetHeaders\s*:/.test(source)) unreadable.push('an alias of setHeaders');
  if (/\.\s*setHeaders\b/.test(source)) unreadable.push('setHeaders used as a member');
  if (/[=(]\s*setHeaders\b(?!\s*\()/.test(source) || /,\s*setHeaders\s*\)/.test(source)) unreadable.push('setHeaders passed or assigned as a value');
  return { names, unreadable };
}

/** Header names the hooks set on responses, whatever the route. */
export function hookHeaders(source: string): Set<string> {
  const found = new Set<string>();
  for (const match of source.matchAll(/['"]([A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)+)['"]/g)) found.add(match[1].toLowerCase());
  return found;
}

/** Conflicts: a header set twice among modules that run for one request, or also set by the hooks. */
export function conflicts(files: Record<string, string>, hooksSource: string): string[] {
  const hooksRead = stripComments(hooksSource);
  const hooks = hooksRead.code;
  const owned = hookHeaders(hooks);
  const found: string[] = [];
  const parsed = Object.entries(files).map(([file, source]) => {
    const read = stripComments(source);
    const calls = headerCalls(read.code);
    return { file, names: calls.names, unreadable: read.ok ? calls.unreadable : [...calls.unreadable, 'an unterminated string or comment'] };
  });
  if (!hooksRead.ok) found.push('hooks.server.ts: an unterminated string or comment, so the headers cannot be checked');
  for (const { file, unreadable } of parsed) for (const reason of new Set(unreadable)) found.push(`${file}: ${reason}, so the headers cannot be checked; call setHeaders({ 'name': value }) directly`);
  if (/\bsetHeaders\b/.test(hooks)) found.push('hooks.server.ts: the hooks must set headers on the response, not through setHeaders');
  for (const { file, names } of parsed) {
    const seen = new Set<string>();
    for (const name of names) {
      if (owned.has(name)) found.push(`${file}: ${name} is also set by the hooks`);
      if (seen.has(name)) found.push(`${file}: ${name} is set more than once`);
      seen.add(name);
    }
  }
  // A page or its action runs with every layout above it; so do two modules in one directory.
  for (const a of parsed) for (const b of parsed) {
    if (a.file >= b.file) continue;
    const under = (directory: string, parent: string) => parent === '.' || directory === parent || directory.startsWith(parent + '/');
    const related = dirname(a.file) === dirname(b.file) || /\+layout/.test(a.file) && under(dirname(b.file), dirname(a.file)) || /\+layout/.test(b.file) && under(dirname(a.file), dirname(b.file));
    if (!related) continue;
    for (const name of a.names) if (b.names.includes(name)) found.push(`${a.file} and ${b.file} both set ${name}`);
  }
  return found;
}

function serverModules(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? serverModules(path) : /^\+(?:page|layout)\.server\.ts$|^\+server\.ts$|^\+(?:page|layout)\.ts$/.test(entry.name) ? [path] : [];
  });
}

describe('response headers are set in one place', () => {
  test('no route module sets a header that a parent layout, its own sibling module or the hooks also set', () => {
    const files = Object.fromEntries(serverModules(routes).map((path) => [relative(routes, path), readFileSync(path, 'utf8')]));
    expect(Object.keys(files).length).toBeGreaterThan(10);
    expect(conflicts(files, readFileSync(join(root, 'hooks.server.ts'), 'utf8'))).toEqual([]);
  });
  test('the public membership pages leave cache, robots and referrer policy to the hooks', () => {
    for (const route of ['apply', 'join']) expect(readFileSync(join(routes, route, '+page.server.ts'), 'utf8')).not.toContain('setHeaders');
    const hooks = readFileSync(join(root, 'hooks.server.ts'), 'utf8');
    expect(hooks).toMatch(/\\\/join\$\/[^\n]*'Referrer-Policy': 'no-referrer'/);
    expect(hooks).toMatch(/\\\/apply\$\/[^\n]*'Cache-Control': 'private, no-store'/);
  });
  test('the scanner catches the defect that reached the public pages', () => {
    const hooks = "response.headers.set('Cache-Control', 'x')";
    expect(conflicts({ 'apply/+page.server.ts': "load = ({ setHeaders }) => { setHeaders({ 'cache-control': 'no-store' }); }" }, '')).toEqual([]);
    expect(conflicts({ 'apply/+page.server.ts': "load = ({ setHeaders }) => { setHeaders({ 'cache-control': 'a' }); }; default = ({ setHeaders }) => { setHeaders({ 'Cache-Control': 'a' }); }" }, '')).toEqual(['apply/+page.server.ts: cache-control is set more than once']);
    expect(conflicts({ 'apply/+page.server.ts': "setHeaders({ 'cache-control': 'a' })" }, hooks)).toEqual(['apply/+page.server.ts: cache-control is also set by the hooks']);
    expect(conflicts({ 'members/+layout.server.ts': "setHeaders({ 'x-robots-tag': 'a' })", 'members/stories/+page.server.ts': "setHeaders({ 'X-Robots-Tag': 'a' })" }, '')).toHaveLength(1);
    expect(conflicts({ 'members/+layout.server.ts': "setHeaders({ 'x-robots-tag': 'a' })", 'news/+page.server.ts': "setHeaders({ 'x-robots-tag': 'a' })" }, '')).toEqual([]);
    expect(conflicts({ 'apply/+page.server.ts': 'setHeaders(headers)' }, '')).toHaveLength(1);
  });
  test('the scanner fails closed on each way of hiding a header from it', () => {
    const one = (source: string, hooks = '') => conflicts({ 'apply/+page.server.ts': source }, hooks);
    expect(one("setHeaders({ [name]: 'a' })")).toHaveLength(1); // computed key
    expect(one("setHeaders({ ...shared })")).toHaveLength(1); // spread
    expect(one("const { setHeaders: s } = event; s({ 'cache-control': 'a' })")).toHaveLength(1); // destructured alias
    expect(one("event.setHeaders({ 'cache-control': 'a' })")).toHaveLength(1); // member call
    expect(one("const s = setHeaders; s({ 'cache-control': 'a' })")).toHaveLength(1); // assigned alias
    expect(one("apply(setHeaders)")).toHaveLength(1); // passed as a value
    expect(one("load = ({ setHeaders, url }) => { setHeaders({ 'x-extra': 'a' }); }")).toEqual([]); // plain use stays allowed
    expect(one('', "event.setHeaders({ 'a-b': 'c' })")).toHaveLength(1); // hooks must not use it
    // A root layout runs for every route.
    expect(conflicts({ '+layout.server.ts': "setHeaders({ 'x-robots-tag': 'a' })", 'apply/+page.server.ts': "setHeaders({ 'x-robots-tag': 'a' })" }, '')).toHaveLength(1);
    expect(conflicts({ '+layout.server.ts': "setHeaders({ 'x-robots-tag': 'a' })", 'apply/deep/er/+page.server.ts': "setHeaders({ 'x-robots-tag': 'a' })" }, '')).toHaveLength(1);
  });
  test('a comment marker inside a string or template literal does not hide a later setHeaders call', () => {
    const hooks = "response.headers.set('Cache-Control', 'x')";
    const hidden = "const url = 'https://example.invalid/a//b'; setHeaders({ 'cache-control': 'a' });";
    expect(conflicts({ 'apply/+page.server.ts': hidden }, hooks)).toEqual(['apply/+page.server.ts: cache-control is also set by the hooks']);
    expect(conflicts({ 'apply/+page.server.ts': "const glob = '/*'; setHeaders({ 'cache-control': 'a' }); const end = '*/';" }, hooks)).toEqual(['apply/+page.server.ts: cache-control is also set by the hooks']);
    expect(conflicts({ 'apply/+page.server.ts': "const t = `//${x}/*`; setHeaders({ 'cache-control': 'a' });" }, hooks)).toEqual(['apply/+page.server.ts: cache-control is also set by the hooks']);
    // Real comments are ignored.
    expect(conflicts({ 'apply/+page.server.ts': "// setHeaders({ 'cache-control': 'a' })\n/* setHeaders({ 'cache-control': 'a' }) */\nsetHeaders({ 'x-extra': 'a' });" }, hooks)).toEqual([]);
    expect(stripComments("a = '//'; // gone\nb = \"/*\"; /* gone */ c").code).toBe("a = '//'; \nb = \"/*\";   c");
    // An unterminated string or comment cannot be read, so it fails closed.
    expect(conflicts({ 'apply/+page.server.ts': "const s = 'oops;\nsetHeaders({ 'cache-control': 'a' })" }, '')[0]).toContain('an unterminated string or comment');
    expect(conflicts({ 'apply/+page.server.ts': "/* never closed\nsetHeaders({ 'cache-control': 'a' })" }, '')).toHaveLength(1);
  });
  test('a brace inside a header value does not end the object early', () => {
    const hooks = "response.headers.set('X-Robots-Tag', 'x')";
    expect(headerCalls("setHeaders({ 'content-security-policy': \"default-src 'self'; style-src }\", 'x-robots-tag': 'a' })").names).toEqual(['content-security-policy', 'x-robots-tag']);
    expect(headerCalls("setHeaders({ 'cache-control': `max-age=${ttl({ a: 1 })}}`, 'x-robots-tag': 'a' })").names).toEqual(['cache-control', 'x-robots-tag']);
    expect(headerCalls("setHeaders({ 'cache-control': '}', 'x-robots-tag': 'a' })").names).toEqual(['cache-control', 'x-robots-tag']);
    expect(headerCalls("setHeaders({ 'cache-control': fn({ a: 1 }), 'x-robots-tag': 'a' })").names).toEqual(['cache-control', 'x-robots-tag']);
    expect(conflicts({ 'apply/+page.server.ts': "setHeaders({ 'cache-control': '}', 'x-robots-tag': 'a' })" }, hooks)).toEqual(['apply/+page.server.ts: x-robots-tag is also set by the hooks']);
    // Duplicates after the brace are still seen.
    expect(conflicts({ 'apply/+page.server.ts': "setHeaders({ 'a-b': '}', 'A-B': 'c' })" }, '')).toEqual(['apply/+page.server.ts: a-b is set more than once']);
    // An object that never closes, and a spread or computed key after a nested value, fail closed.
    expect(headerCalls("setHeaders({ 'a-b': '}'").unreadable).toEqual(['a headers object that cannot be read to its end']);
    expect(headerCalls("setHeaders({ 'a-b': { c: 1 }, ...shared })").unreadable).toEqual(['a spread in the headers']);
    expect(headerCalls("setHeaders({ 'a-b': `}`, [name]: 'c' })").unreadable).toEqual(['a computed header name']);
  });
});
