import { describe, expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expectedMigrationNames, ledgerMatches } from '../../tools/release/migrations';

const registry = join(import.meta.dir, '../../cms/migrations/index.ts');

describe('release migration ledger expectation', () => {
  test('is derived from the shipped registry, in order, with no fixed count', () => {
    const names = expectedMigrationNames(registry);
    expect(names.length).toBeGreaterThanOrEqual(9);
    expect(names).toContain('20261119_045216_mirrored_at');
    expect(names).toEqual([...names].sort());
    expect(ledgerMatches(names.map(name => `${name}|1`).join('\n') + '\n', names)).toBe(true);
  });

  test('a short, reordered or unexpected ledger does not match', () => {
    const dir = mkdtempSync(join(tmpdir(), 'terrace-registry-'));
    const file = join(dir, 'index.ts');
    writeFileSync(file, "export const migrations = [\n  {\n    name: 'a1',\n  },\n  {\n    name: 'b2'\n  },\n];\n");
    const names = expectedMigrationNames(file);
    expect(names).toEqual(['a1', 'b2']);
    expect(ledgerMatches('a1|1\nb2|1', names)).toBe(true);
    expect(ledgerMatches('a1|1', names)).toBe(false);
    expect(ledgerMatches('b2|1\na1|1', names)).toBe(false);
    expect(ledgerMatches('a1|1\nb2|1\nc3|2', names)).toBe(false);
    expect(ledgerMatches('', names)).toBe(false);
  });
});
