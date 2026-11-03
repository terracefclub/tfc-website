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

To run an isolated local realm without using the usual port, set `KEYCLOAK_HTTP_PORT`; the management port is 1000 higher. For example, `KEYCLOAK_HTTP_PORT=8186 direnv exec identity bun identity/tools/local-up.ts` binds only to `127.0.0.1:8186` and `127.0.0.1:9186`.

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

The separate editorial client `terrace-cms` uses authorization code + PKCE(S256), exact loopback callbacks on ports3010,3032 and3040 at `/api/editorial/callback`, and the access-token audience `terrace-editorial`. `terrace-editorial` is a confidential resource client for token introspection only. `editorial-editor` and `editorial-admin` are separate realm roles with their own client scope mappings; neither member role is mapped to the CMS client. Synthetic editorial identities `local-editorial-editor` and `local-editorial-admin` have only their matching editorial role. `app.env` includes `CMS_AUTH_ISSUER`, `CMS_AUTH_AUDIENCE`, `CMS_AUTH_CLIENT_ID`, `CMS_AUTH_CLIENT_SECRET`, `CMS_AUTH_INTROSPECTION_CLIENT_ID` and `CMS_AUTH_INTROSPECTION_SECRET`; use the existing `CMS_ORIGIN` to select an allowed local callback origin. Credentials are generated into the ignored mode0600 file. This is local identity scaffolding and does not itself enable CMS authentication or make the CMS safe to expose publicly.

For a walkthrough, use `local-editorial-editor` at the Payload editor sign-in.
Use `local-member` or `local-alumni` at the website's Members link. Use
`local-unapproved` there to verify the approval screen.

## Security contract

The confidential `terrace-web` and `terrace-cms` clients use authorization code + PKCE(S256), exact redirects, no implicit flow and no password grant. The `basic` client scope supplies the immutable subject; each browser client has only its own role family in scope. Audience mappers add `terrace-community` or `terrace-editorial` to access tokens, never ID tokens. The separate confidential resource clients introspect their corresponding tokens and have no browser, service-account or direct-grant login. The website and CMS use different client credentials.

Access tokens last60seconds, refresh tokens rotate with zero reuse, and the website checks the live Keycloak session on every protected request through the CMS. Removing a role takes effect at the next token refresh (at most60seconds). Disable an account or revoke its sessions for immediate removal. All new real member accounts must be approved before receiving either member role. Editorial roles require a separate explicit editorial authorization; member approval alone grants no CMS access. Do not enable public registration to simplify a preview.

`local-up.ts` seeds only synthetic identities; it is not a production enrollment mechanism. A reviewed production invitation workflow must record the approving operator, use per-user accounts, require verified contact ownership and deliver a one-time password/setup action privately. Do not copy local credentials or synthetic accounts into production.

## Generate a production realm artifact

`tools/production-realm.ts` produces a user-free Keycloak realm import from the same clients, audiences, role names and role scopes used by the local bootstrap. It does not contact Keycloak or generate credentials. Run from the repository root:

```sh
umask 077
mkdir -m 700 /protected/terrace-identity
direnv exec identity bun identity/tools/production-realm.ts \
  --web-origin https://www.example.org \
  --cms-origin https://editor.example.org \
  --output /protected/terrace-identity/terrace-realm.json \
  < /protected/terrace-client-secrets.json 2>/dev/null
```

Supply approved real origins, not the example hosts above. Both must be canonical HTTPS DNS origins, without a trailing slash, path, query, fragment, wildcard or credentials. A nondefault explicit port is supported. Loopback/IP origins and localhost subdomains are rejected.

The protected standard-input JSON must contain exactly `webSecret`, `introspectionSecret`, `cmsSecret` and `editorialSecret`. All four are required, distinct, trimmed strings of 32–4096 UTF-8 bytes without control characters. Deliver independently generated client secrets through the secret manager; never pass them in command arguments, shell history or chat. Do not pipe the local `credentials.json` into this command. Input is bounded to 32 KiB and malformed UTF-8 is rejected.

The output parent must already exist, belong to the invoking user and have no group/other permissions. It must resolve outside this checkout. The command creates a new mode0600 file exclusively: an existing file or symlink fails without overwriting it. Success is silent; failure exits1 with a fixed message and no artifact or input values on either stream. Keep the artifact, source revision and checksum in protected storage; it contains all four client secrets and must never enter Git, build artifacts or the Nix store. With the same private shell permissions, record provenance without printing the artifact or hash:

```sh
(
  umask 077
  set -C
  direnv exec web git rev-parse HEAD > /protected/terrace-identity/source-revision
  direnv exec identity sha256sum /protected/terrace-identity/terrace-realm.json > /protected/terrace-identity/artifact.sha256 2>/dev/null
)
```

The artifact requires TLS and verified email, keeps self-registration/password reset disabled, preserves short rotating sessions, and emits only the four application clients. Browser clients retain PKCE(S256), their exact callback/logout paths, restricted role scopes and access-token audiences. Password, implicit and service-account grants and full scope are disabled. It emits no user, synthetic identity, bootstrap administrator, Keycloak administration client, provider/federation configuration or mail settings. `editorial-admin` remains the existing application editorial role, separate from Keycloak administration.

This is the producer for Womb's optional [identity-host realm input](https://gitlab.com/terrace/tech/womb/-/blob/trunk/docs/identity-host.md). Validate the synthetic artifact against that checkout's hosting guard without copying its policy here:

```sh
WOMB_REALM_POLICY=/absolute/path/to/womb/platform/identity/realm-policy.jq \
  direnv exec identity bun test identity/test
```

To prove import/export with the pinned Keycloak distribution, supply a path to the official archive matching `keycloak-pin.json` (the local bootstrap's downloaded archive is suitable):

```sh
KEYCLOAK_ARCHIVE=/protected/downloads/keycloak-26.8.1.tar.gz \
  direnv exec identity bun test identity/test
```

This opt-in test checks the archive SHA256, extracts an isolated temporary distribution, generates an artifact from readable synthetic credentials, imports/exports through a throwaway H2 data directory, and checks the resulting callbacks, scopes and role mappings. It does not start a listener or reuse any running realm's database/accounts/credentials. Keycloak runs with a 512 MiB heap, 256 MiB metaspace cap and bounded commands using a minimal environment. Command output stays in a mode0600 private log. The temporary directory is removed on success; a failed test reports only its protected diagnostic directory, never log contents.

Without those optional paths, the cross-repository and native-import tests are explicitly skipped; the self-contained production/local contract tests still run. The host's startup import creates a missing realm and skips an existing realm. This generator is not reconciliation, secret rotation, account enrollment or a recoverable database backup. Apply changes to an existing realm only through a separately reviewed authenticated procedure; never delete a realm to force re-import.

## Production boundary

H2, HTTP and the bootstrap administrator are strictly local development choices. Production needs the dedicated Terrace realm on supported PostgreSQL, TLS with exact public origins, secret-manager delivery, tested database backups and restores, restricted administration, monitored readiness, and an auditable enrollment/offboarding workflow. The initial web session store is bounded in-process memory: web restarts sign users out and multiple web replicas are not supported. No high availability is claimed. Headscale should receive its own independently scoped OIDC client when deployed; it must not reuse either website credential.

Validation covers realm policy invariants, real local Keycloak sign-in, signed-token failures and session/API boundaries in the web and CMS suites. Run the bootstrap again to confirm idempotence after changing local policy. Reference: [official ZIP guide](https://www.keycloak.org/getting-started/getting-started-zip), [Keycloak client scope migration](https://github.com/keycloak/keycloak/blob/main/docs/documentation/upgrading/topics/changes/changes-25_0_0.adoc).
