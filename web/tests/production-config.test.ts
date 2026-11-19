import { describe, expect, test } from 'bun:test';
import { productionConfigIssues } from '../src/lib/server/production-config';

const complete = {
  NODE_ENV: 'production', CMS_ORIGIN: 'http://127.0.0.1:3010', CMS_PUBLIC_ORIGIN: 'https://editor.example.org',
  ADDRESS_HEADER: 'X-Forwarded-For', LIFECYCLE_INTAKE_SECRET: 'x'.repeat(40)
};

describe('production configuration report', () => {
  test('a complete production environment has no issues and development is never reported', () => {
    expect(productionConfigIssues(complete)).toEqual([]);
    expect(productionConfigIssues({})).toEqual([]);
  });

  test('each missing setting is named without printing any value', () => {
    expect(productionConfigIssues({ ...complete, CMS_PUBLIC_ORIGIN: undefined }).join()).toContain('CMS_PUBLIC_ORIGIN');
    expect(productionConfigIssues({ ...complete, ADDRESS_HEADER: undefined }).join()).toContain('ADDRESS_HEADER');
    expect(productionConfigIssues({ ...complete, ADDRESS_HEADER: undefined, LIFECYCLE_DIRECT_CLIENTS: '1' })).toEqual([]);
    const short = productionConfigIssues({ ...complete, LIFECYCLE_INTAKE_SECRET: 'short-secret-value' });
    expect(short.join()).toContain('LIFECYCLE_INTAKE_SECRET');
    expect(short.join()).not.toContain('short-secret-value');
    expect(productionConfigIssues({ NODE_ENV: 'production' })).toEqual([expect.stringContaining('CMS_ORIGIN')]);
  });
});
