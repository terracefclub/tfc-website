import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

// SvelteKit throws when a response header is set twice, and a no-script form POST runs an action and then
// `load` for the same request. So each header must be set in exactly one place: the hooks, or one route module.

const root = join(import.meta.dir, '..', 'src');
const routes = join(root, 'routes');

/**
 * Header names passed to direct `setHeaders({...})` calls. Anything that cannot be read with certainty fails closed:
 * a computed key, a spread, a non-literal argument, and any alias or member use of `setHeaders`
 * (`const { setHeaders: s } = event`, `event.setHeaders(...)`, `const s = setHeaders`, `run(setHeaders)`).
 */
export function headerCalls(source: string): { names: string[]; unreadable: string[] } {
  const names: string[] = [];
  const unreadable: string[] = [];
  for (const call of source.matchAll(/(?<![.\w$])setHeaders\s*\(/g)) {
    const rest = source.slice(call.index! + call[0].length);
    const literal = /^\s*\{([^}]*)\}/.exec(rest);
    if (!literal) { unreadable.push('a call whose argument is not an object literal'); continue; }
    const body = literal[1];
    if (/\.\.\./.test(body)) unreadable.push('a spread in the headers');
    if (/(?:^|,)\s*\[/.test(body)) unreadable.push('a computed header name');
    for (const key of body.matchAll(/(?:^|,)\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z][\w-]*))\s*:/g)) names.push((key[1] ?? key[2] ?? key[3]).toLowerCase());
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
const uncommented = (source: string) => source.replace(/\/\*[\s\S]*?\*\/|(^|[^:'"\w])\/\/.*$/gm, '$1');
export function conflicts(files: Record<string, string>, hooksSource: string): string[] {
  const hooks = uncommented(hooksSource);
  const owned = hookHeaders(hooks);
  const found: string[] = [];
  const parsed = Object.entries(files).map(([file, source]) => ({ file, ...headerCalls(uncommented(source)) }));
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
});
