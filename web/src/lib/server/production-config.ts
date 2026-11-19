/**
 * Production settings the member lifecycle and imported-content frontend depend on. Each missing one
 * degrades a single feature safely rather than breaking the site (`/apply/` stays closed, body images are
 * dropped), so this only reports. It names variables, never their values.
 */
export function productionConfigIssues(env: Record<string, string | undefined>): string[] {
  if (env.NODE_ENV !== 'production') return [];
  const issues: string[] = [];
  if (!env.CMS_ORIGIN) return ['CMS_ORIGIN is not set: imported pages and news fall back to sample content.'];
  if (!env.CMS_PUBLIC_ORIGIN) issues.push('CMS_PUBLIC_ORIGIN is not set: every image in imported bodies is dropped.');
  if (!env.ADDRESS_HEADER && env.LIFECYCLE_DIRECT_CLIENTS !== '1') issues.push('ADDRESS_HEADER is not set (and LIFECYCLE_DIRECT_CLIENTS is not 1): /apply/ stays closed.');
  if (!env.LIFECYCLE_INTAKE_SECRET || env.LIFECYCLE_INTAKE_SECRET.length < 32) issues.push('LIFECYCLE_INTAKE_SECRET is missing or shorter than 32 characters: /apply/ and /join/ answer "not open".');
  return issues;
}

let reported = false;
/** Log the issues once per process at startup. */
export function reportProductionConfig(env: Record<string, string | undefined>): void {
  if (reported) return;
  reported = true;
  for (const issue of productionConfigIssues(env)) console.error(`[config] ${issue}`);
}
