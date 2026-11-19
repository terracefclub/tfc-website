import { readFileSync } from 'node:fs'

/** Migration names the CMS ships, in order, read from the registry `cms/migrations/index.ts` (never a hard-coded count). */
export function expectedMigrationNames(registry: string): string[] {
  const names = [...readFileSync(registry, 'utf8').matchAll(/^\s*name:\s*'([^']+)'/gm)].map(match => match[1])
  if (!names.length || new Set(names).size !== names.length) throw new Error('Migration registry is unreadable or has duplicates.')
  return names
}

/** True when a `select name,batch from payload_migrations order by id` result holds exactly the expected names in order. */
export function ledgerMatches(ledger: string, names: string[]): boolean {
  const rows = ledger.trim().split('\n').filter(Boolean)
  return rows.length === names.length && rows.every((row, index) => row.split('|')[0] === names[index])
}
