// The setting names the local identity bootstrap (`local-up.ts`) writes to `.state/app.env`.
// Kept free of side effects so consumers (the release smoke and its tests) can import the set
// without running the bootstrap. `local-up.ts` types its output by `AppEnv`, which catches a missing or
// misspelled literal key, but not an extra key that arrives through a spread or a computed key. The real
// guard is the source-reading test in `cms/test/release-proof.test.ts`: it compares the literal keys in
// `local-up.ts` with this list, and fails closed when the block uses a spread, a computed or a quoted key it cannot read.
export const memberAuthKeys = [
  'MEMBER_AUTH_ISSUER', 'MEMBER_AUTH_AUDIENCE', 'MEMBER_AUTH_CLIENT_ID', 'MEMBER_AUTH_CLIENT_SECRET',
  'MEMBER_AUTH_INTROSPECTION_CLIENT_ID', 'MEMBER_AUTH_INTROSPECTION_SECRET', 'MEMBER_AUTH_ORIGIN',
] as const
export const cmsAuthKeys = [
  'CMS_AUTH_ISSUER', 'CMS_AUTH_AUDIENCE', 'CMS_AUTH_CLIENT_ID', 'CMS_AUTH_CLIENT_SECRET',
  'CMS_AUTH_INTROSPECTION_CLIENT_ID', 'CMS_AUTH_INTROSPECTION_SECRET',
] as const
// Local-preview member lifecycle settings (never consumed by the release proof, which sets its own).
export const lifecycleKeys = ['LIFECYCLE_INTAKE_SECRET', 'LIFECYCLE_PUBLIC_ORIGIN', 'LIFECYCLE_OUTBOX_DIR'] as const
export const appEnvKeys = [...memberAuthKeys, ...cmsAuthKeys, ...lifecycleKeys] as const
export type AppEnvKey = typeof appEnvKeys[number]
export type AppEnv = Record<AppEnvKey, string>
