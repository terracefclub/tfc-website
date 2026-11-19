// Regenerate the committed synthetic plan used by the CMS integration tests:
//   bun web/tools/wp-import/write-fixture-plan.ts
// Only for the invented fixture (web/tests/fixtures/wp-import/synthetic.wxr.xml). Real exports
// must use import.ts, which writes private 0600 files outside Git.
import { readFileSync, writeFileSync } from 'node:fs';
import { buildPlan } from './map';

export const fixtureXml = new URL('../../tests/fixtures/wp-import/synthetic.wxr.xml', import.meta.url);
export const fixturePlan = new URL('../../../cms/test/fixtures/wp-import-plan.synthetic.json', import.meta.url);

if (import.meta.main) {
  writeFileSync(fixturePlan, JSON.stringify(buildPlan(readFileSync(fixtureXml, 'utf8')), null, 1) + '\n');
  console.log('Synthetic fixture plan written.');
}
