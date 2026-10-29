# Terrace local identity

This is a dedicated, loopback-only Keycloak development realm. It does not touch a personal Keycloak instance, public DNS or production users. Public registration is disabled. Real current members and alumni require club approval before an operator grants either `current-member` or `alumni`; editorial CMS accounts remain separate.

## Start the reproducible preview

From this repository root:

```sh
direnv allow identity
direnv exec identity bun identity/tools/local-up.ts
direnv exec identity bun test identity/test
```

The bootstrap downloads the pinned official Keycloak26.8.1 archive, checks its SHA256, starts OpenJDK25 from devenv, then idempotently reconciles the dedicated `terrace` realm. Keycloak listens on `http://127.0.0.1:8184`; its native H2 database, logs, runtime and synthetic credentials live in ignored `identity/.state/` (directory0700, credential files0600). No containers or globally installed packages are needed. The release archive's official GitHub asset digest was checked on2026-10-28.

Start the CMS with both environments, from `cms/` after `tools/local-up`:

```sh
direnv exec . ../identity/tools/with-local tools/with-local env CMS_ORIGIN=http://127.0.0.1:3014 ./node_modules/.bin/next dev --hostname 127.0.0.1 --port 3014
```

Start the website from `web/`:

```sh
direnv exec . ../identity/tools/with-local env CMS_ORIGIN=http://127.0.0.1:3014 MEMBER_AUTH_ORIGIN=http://127.0.0.1:4194 bun run dev --host 127.0.0.1 --port 4194
```

The local browser client permits only exact callbacks and logout returns for ports4174,4176,4194 and4240. Override `MEMBER_AUTH_ORIGIN` after the wrapper when choosing another allowed preview. The wrapper preserves the working directory. Background preview processes must be detached and their exact PIDs recorded; stop only the process you started. The local Keycloak PID is recorded in `.state/keycloak.pid`.

Synthetic usernames are `local-member`, `local-alumni` and `local-unapproved`. Their passwords are generated randomly once and stored in `.state/credentials.json`, under `memberPassword`, `alumniPassword` and `outsiderPassword`. The latter has no approved role. Never paste these values into chat, logs or source. The bootstrap administration account is `terrace-local-admin`; its credential is in the same ignored file. These are local test fixtures, never production accounts.

## Security contract

The confidential `terrace-web` client uses authorization code + PKCE(S256), exact redirects, no implicit flow and no password grant. The `basic` client scope supplies the immutable subject; only approved realm roles are in its scope. An audience mapper adds `terrace-community` to access tokens, never ID tokens. The separate confidential `terrace-community` client introspects that resource's tokens and has no browser, service-account or direct-grant login. The website and CMS use different client credentials.

Access tokens last60seconds, refresh tokens rotate with zero reuse, and the website checks the live Keycloak session on every protected request through the CMS. Removing a role takes effect at the next token refresh (at most60seconds). Disable an account or revoke its sessions for immediate removal. All new real accounts must be approved before receiving either member role. Do not enable public registration to simplify a preview.

`local-up.ts` seeds only synthetic identities; it is not a production enrollment mechanism. A reviewed production invitation workflow must record the approving operator, use per-user accounts, require verified contact ownership and deliver a one-time password/setup action privately. Do not copy local credentials or synthetic accounts into production.

## Production boundary

H2, HTTP and the bootstrap administrator are strictly local development choices. Production needs the dedicated Terrace realm on supported PostgreSQL, TLS with exact public origins, secret-manager delivery, tested database backups and restores, restricted administration, monitored readiness, and an auditable enrollment/offboarding workflow. The initial web session store is bounded in-process memory: web restarts sign users out and multiple web replicas are not supported. No high availability is claimed. Headscale should receive its own independently scoped OIDC client when deployed; it must not reuse either website credential.

Validation covers realm policy invariants, real local Keycloak sign-in, signed-token failures and session/API boundaries in the web and CMS suites. Run the bootstrap again to confirm idempotence after changing local policy. Reference: [official ZIP guide](https://www.keycloak.org/getting-started/getting-started-zip), [Keycloak client scope migration](https://github.com/keycloak/keycloak/blob/main/docs/documentation/upgrading/topics/changes/changes-25_0_0.adoc).
