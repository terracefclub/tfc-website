# Terrace CMS trial

Payload 3 and Next.js provide an editorial admin and REST API for the separate SvelteKit website. The default preview is **localhost only**. Editorial Keycloak sign-in is available; public deployment requires the explicit runtime policy below, TLS, tested recovery and deployment review.

## Public runtime activation policy

`CMS_PUBLIC_DEPLOYMENT=1` enables HTTPS configuration validation; it does not expose a listener, configure a proxy, create accounts or deploy this application. Every other value retains the loopback-only origin gate. Keep the local preview unchanged. The production host must independently enforce loopback backend binding, trusted TLS proxying, private runtime files, explicit database migrations, persistent upload ownership and backup/restore checks before exposure.

Supply these server-only settings through private runtime environment files, outside the release bundle. Do not prefix them with `NEXT_PUBLIC_` or commit them. Startup rejects invalid settings with fixed messages that omit supplied URLs and secrets.

| Setting | Required public value |
| --- | --- |
| `CMS_ORIGIN` | Exact canonical HTTPS origin, such as `https://editor.terrace.example`; no trailing slash, credentials, path, query or fragment. A DNS hostname with at least two labels is required; IP addresses and localhost are rejected. Nondefault HTTPS ports are allowed. |
| `CMS_AUTH_ISSUER`, `MEMBER_AUTH_ISSUER` | The same canonical HTTPS DNS origin followed by exactly `/realms/terrace`, without a trailing slash. |
| `CMS_AUTH_CLIENT_ID`, `CMS_AUTH_AUDIENCE`, `CMS_AUTH_INTROSPECTION_CLIENT_ID` | `terrace-cms`, `terrace-editorial`, `terrace-editorial`, respectively. |
| `MEMBER_AUTH_CLIENT_ID`, `MEMBER_AUTH_AUDIENCE`, `MEMBER_AUTH_INTROSPECTION_CLIENT_ID` | `terrace-web`, `terrace-community`, `terrace-community`, respectively. |
| `PAYLOAD_SECRET`, `CMS_AUTH_CLIENT_SECRET`, `CMS_AUTH_INTROSPECTION_SECRET`, `MEMBER_AUTH_INTROSPECTION_SECRET` | Four pairwise distinct secrets, each 32–4096 UTF-8 bytes, with no leading/trailing whitespace or control characters. Match the client secrets to the production realm artifact. The website's separate client secret is not consumed by the CMS. |
| `CMS_MEDIA_DIR` | Explicit normalized absolute persistent directory, outside the component code directory and `/nix/store`; cannot be the filesystem root or an ancestor of the code directory. No trailing slash, `..` or control characters. |
| `DATABASE_URI` | The dedicated CMS PostgreSQL database; migrations remain an explicit operator action. |

Omit `CMS_LOCAL_BOOTSTRAP` and every `CMS_BOOTSTRAP_*` key entirely. Empty values and `CMS_LOCAL_BOOTSTRAP=0` are rejected in public mode. Do not source the local trial's environment wrapper for production. Public mode requires both complete editorial and member OIDC configurations, so password-only startup is unavailable. Client IDs and audiences match the existing [production realm generator](../identity/README.md); the generator and CMS share pure origin and secret validators, while token verification and role checks retain their existing implementation.

Media path validation is lexical and does not require the directory to exist during a build. The host must make that exact external directory writable only by the CMS service and include it with the database in recovery tests. Run from the release's component root so the code-directory boundary is enforced correctly. Symlink resolution, mount ownership, TLS activation and actual public SSO are host responsibilities; this policy alone is not evidence of a deployed public service.

## Editorial Keycloak sign-in

The `terrace-cms` client uses authorization code + PKCE, state, nonce and signed ID tokens. Only `editorial-editor` or `editorial-admin` grants CMS access. Current-member/alumni approval does not grant editorial permissions. Every editor gets their own Payload account, keyed by a unique hash of issuer and subject. An internal `.invalid` email identifies that account without linking it to any existing local account or changeable email address; it is not a delivery address. Contact/profile administration belongs in Keycloak.

Load `CMS_AUTH_ISSUER`, `CMS_AUTH_CLIENT_ID`, `CMS_AUTH_CLIENT_SECRET`, `CMS_AUTH_AUDIENCE`, `CMS_AUTH_INTROSPECTION_CLIENT_ID`, `CMS_AUTH_INTROSPECTION_SECRET` and `CMS_ORIGIN` from the dedicated identity environment. Any partial `CMS_AUTH_*` configuration fails startup. With SSO configured, Keycloak manages editorial accounts. The Users API rejects account creation, updates and deletion, and password login is disabled. An editorial account cannot sign in with a password even if the same database is later used in the local password trial. Editorial permissions come from Keycloak on every request. Removing a role takes effect at token refresh, within 60 seconds; revoke the Keycloak session for immediate access removal. Provider failure denies access and requires signing in again.

From a clean checkout, start the dedicated local identity following `../identity/README.md`, then from `cms/`:

```sh
direnv exec . tools/local-up
direnv exec . tools/with-local bun run migrate
direnv exec . tools/with-local ../identity/tools/with-local env CMS_ORIGIN=http://127.0.0.1:3040 bun tools/local-preview.ts
```

Open `http://127.0.0.1:3040/admin` and select **Sign in with Terrace**. The local identity fixtures are `local-editorial-editor` and `local-editorial-admin`; generated credentials remain in `identity/.state/credentials.json`. Never paste them into logs or source. `local-preview.ts` starts a detached loopback server, records its exact PID in `.state/preview-3040.pid`, and keeps logs readable only by the owner. Check that PID's command before stopping its process group. Restart after changing authentication code/configuration; the bounded session store survives ordinary hot reloads but is cleared on process restart.

On the [local website preview](http://127.0.0.1:4194/), choose **Editor sign-in** to edit a draft. After publishing, choose **View published site** on the website to see the public result. **View sample site** returns to the design calendar. **Members** opens the private community.

Sessions use opaque HttpOnly SameSite cookies, with Secure under HTTPS, distinct names per CMS origin, an eight-hour absolute lifetime and bounded server memory. Access/rotating refresh tokens never reach the browser. Every request verifies the short-lived resource JWT and live Keycloak session. Cookie-authenticated mutations require the exact Origin. This supports one CMS process; restarts sign editors out, and multiple replicas are not supported.

Run the reproducible real-browser check against that owned, synthetic loopback realm:

```sh
direnv exec . env PLAYWRIGHT_BROWSERS_PATH=.state/browsers bun node_modules/playwright/cli.js install chromium
direnv exec . tools/with-local ../identity/tools/with-local env CMS_ORIGIN=http://127.0.0.1:3040 TERRACE_TEST_IDENTITY_STATE=../identity/.state PLAYWRIGHT_BROWSERS_PATH=.state/browsers bun tools/test-editorial-browser.ts
```

Set `TERRACE_TEST_WEB_ORIGIN=http://127.0.0.1:4194` to also exercise publishing and withdrawing an event on the anonymous website.

The check consumes fixture credentials internally, exercises real Keycloak browser login and Payload APIs, rejects member/alumni/unapproved accounts, checks editor/admin permissions, saving an event draft from the dashboard, cross-origin writes, invalid state, session revocation and logout. Only synthetic content is created and removed. Screenshots stay in ignored `.state/`; raw authentication errors and token-bearing URLs are never printed. Unit tests additionally cover signature/issuer/audience/client failures, callback replay/expiry, refresh concurrency and bounded sessions.

## Local start

From `cms/`:

```sh
direnv allow .
direnv exec . tools/local-up
direnv exec . tools/with-local bun run migrate
direnv exec . tools/with-local bun run bootstrap:local
direnv exec . tools/with-local bun run dev
```

Open `http://127.0.0.1:3010/admin`. The generated local admin credentials are in ignored `.state/local.env` (mode 0600); do not commit or paste them. PostgreSQL uses only a private Unix socket under `.state/`, and the CMS binds `127.0.0.1`. `tools/local-up` and bootstrap are safe to rerun. Bootstrap inserts a synthetic published `preview-open-mic` event and a synthetic draft `preview-community-dinner` event, both visibly marked as preview content.

Stop the CMS with the exact process PID you started. Stop local PostgreSQL with `direnv exec . pg_ctl -D .state/postgres stop`. The application does not modify user packages or dotfiles.

## Content contract

Payload REST lists use `GET /api/<collection>?depth=1` and return `{ docs, totalDocs, ... }`. Detail lookup uses `where[slug][equals]=<slug>`. Anonymous reads are limited to `_status=published`, including when a caller requests `draft=true`. Editors and admins can read drafts. The collections are:

- `events`: `slug`, `title`, `summary`, `startsAt` (UTC ISO), optional `endsAt`, `category` (`music`, `food`, `community`), `locationName`, optional plain-text `body`, optional `coverImage` (shown to editors as "Poster image"), `_status`.
- `newsletters`: `slug`, `title`, `issueDate`, `summary`, required-on-publication `issuePdf`, optional `coverImage`, `_status`.
- `initiatives`: `slug`, `title`, `summary`, optional plain-text `body`, `ctaLabel`, `ctaUrl`, `coverImage`, `_status`.
- `redirects`: `sourcePath`, `destinationUrl`, `statusCode`, `active`; only active redirects are public.
- `media`: `alt`, `caption`, `credit`, `public`, `url`, `mimeType`, `width`, `height`; only explicitly public media are visible or downloadable anonymously.

Payload emits absolute `media.url` values using `CMS_ORIGIN`. Consumers should accept URLs only from that configured origin and rewrite the pathname to their trusted public CMS origin as needed. Uploads allow PNG, JPEG, WebP, and PDF, at most 10 MiB, and check file signatures. Published content cannot reference private media. A published newsletter must have a public PDF. Media referenced by published content cannot be made private or deleted until that content is unpublished. An anonymous direct upload URL returns 403 for private files.

## Event images

Uploads are stored in this checkout's `cms/.state/media` by default. Set
`CMS_MEDIA_DIR` to an absolute directory when using separate persistent storage.
Include that directory with the CMS database in the backup plan.

Older revisions used a relative path that resolved outside the checkout. Before
upgrading an existing preview, stop its CMS process, keep PostgreSQL running,
and run from `cms/`:

```sh
direnv exec . tools/local-up
direnv exec . tools/with-local bun tools/migrate-media-directory.ts --from ../../.state/media
```

Then start the updated CMS normally. For an external destination, supply the same
`CMS_MEDIA_DIR` to the migration and server commands. The command copies only
filenames referenced by this database, verifies their bytes, and retains every
original. It never overwrites different data or follows file symlinks. Verified
copies remain after a partial failure, so fix the missing/conflicting input and
rerun. It accepts up to 100,000 references and files up to 128 MiB, and prints
counts only. Keep the original files until a separate backup and serving check
have succeeded. Other checkouts may still reference them.

Editors attach a poster to an event from **Events > Poster image**. The website shows it uncropped on the event card and detail page.

1. In **Media**, upload a JPEG, PNG, or WebP of at most 10 MiB (file signatures are checked; SVG, GIF, and other types are refused). Fill in **Alt text** (required, at most 300 characters; describe what the poster shows), and optionally **Caption** (500) and **Credit** (200). Tick **Public**.
2. In the event, pick that media item as **Poster image**. A PDF cannot be chosen. A published event cannot use a private image, and a media item used by a published event cannot be made private or deleted until the event is unpublished.
3. The website maps the image URL, alt text, caption, credit, and intrinsic width/height when Payload recorded them. If an event has no usable poster (none set, not public, wrong type, or no alt text) the site shows no poster, except that the built-in sample events keep their bundled sample poster when matched by slug. Events remain labelled as sample content until a verified calendar source exists.

The caption and credit are shown under the poster. The credit line is plain text, never HTML.

## Editorial workflow and validation

Without any `CMS_AUTH_*` configuration, local password accounts remain available solely for the original loopback trial and integration tests. Admin users can manage these local accounts and all content. Editors can create and edit content, but cannot create users, grant themselves admin, or delete content. With SSO, grant/remove roles in Keycloak instead. `CMS_LOCAL_BOOTSTRAP=1` and loopback `CMS_ORIGIN` gate the synthetic password bootstrap; do not run it in SSO mode.

After schema changes, run `direnv exec . tools/with-local bun run migrate:create -- --name <short-name>`, review the generated migration, and run `migrate`. PostgreSQL adapter schema push is disabled. `bun.lock` and `devenv.lock` pin JavaScript and shell dependencies.

```sh
direnv exec . bun run check
direnv exec . tools/with-local bun test
```

`test/event-media.test.ts` covers the poster rules and the `credit` migration against real PostgreSQL.

For the direct HTTP file ACL test, run the CMS locally and use `direnv exec . tools/with-local env CMS_HTTP_URL=http://127.0.0.1:3010 bun test`. CI starts isolated PostgreSQL, applies migrations, builds the app, starts the production server, and runs all tests; it has no deploy step.

## Community identity boundary

The separate `members` collection authenticates only Keycloak access tokens; it has no password login or public account-creation endpoint. Configure `MEMBER_AUTH_ISSUER`, `MEMBER_AUTH_AUDIENCE=terrace-community`, `MEMBER_AUTH_CLIENT_ID=terrace-web`, and the dedicated confidential introspection client's `MEMBER_AUTH_INTROSPECTION_CLIENT_ID` / `MEMBER_AUTH_INTROSPECTION_SECRET` through the environment. Missing or invalid configuration denies member access. The CMS remains bound to loopback pending production identity, TLS and recovery checks.

Only explicitly approved `current-member` and `alumni` realm roles permit member access. Tokens require the expected issuer, resource audience, authorized client, RS256 signature, expiry, token type, and an issuance age of at most 65 seconds. Every authenticated request also introspects the token; an inactive session or unreachable provider denies access. Configure Keycloak access-token lifetime to 60 seconds: role removal takes effect no later than token expiry, while session revocation is checked on every request. Identity uses a unique hash of issuer plus subject; email changes cannot take over an existing member.

Member identities cannot use editorial accounts, draft versions, or private editorial media. Member collection reads are restricted to the signed-in identity; no member directory is exposed here. Identity keys are hidden from collection reads. The authenticated me endpoint returns only the current identity and approved roles, never a token. Profile/community authoring belongs to separate collections with their own access rules. Tests use an isolated signed-token provider and PostgreSQL to verify the boundary; these tests do not substitute for a real Keycloak browser-login check.

## Reviewing member story reports

An approved member can report a story they can currently read from the **Stories** page. The form explains that submitting it sends Terrace administrators a copy of that story, its author’s displayed name and the selected reason. An administrator can open **Community moderation → Story reports** in Payload, inspect the snapshot and mark it reviewed. Administrators can delete a report when it should no longer be retained. Members and ordinary editors cannot browse reports. Reviewing a report does not grant access to the other stories in its group.

Each member can report a given story once. Its snapshot survives later edits or deletion, so a reviewer sees the content that was reported. Marking a report reviewed records triage only. It does not remove the story, contact anyone or suspend an account. Before inviting real members, Terrace must name reviewers, agree on response times, escalation and a retention/deletion policy. Check the queue manually in the local pilot.

`tools/test-reports-browser.ts` checks the real member Keycloak login and report form, mobile layout, ordinary-editor HTTP rejection, native Payload queue/review/save controls and snapshot retention after story edits and removal. Use owned loopback runtimes and synthetic data only. The website must target that same migrated CMS. With `CMS_AUTH_ISSUER` set, the check signs in through Keycloak as the existing `local-editorial-admin` and `local-editorial-editor` fixtures and verifies their separate roles and opaque sessions. It does not call account-creation endpoints or change provider configuration. The broader SSO/session checks remain in `test-editorial-browser.ts`.

From `cms/`, install the test browser and run against your owned SSO runtimes (replace the origins and fixture-state path as needed). `CMS_LOCAL_BOOTSTRAP=1` is an explicit assertion that these runtimes contain synthetic local fixtures; it does not run bootstrap or change the database:

```sh
direnv exec . env PLAYWRIGHT_BROWSERS_PATH=.state/browsers bun node_modules/playwright/cli.js install chromium
direnv exec . ../identity/tools/with-local env CMS_LOCAL_BOOTSTRAP=1 CMS_ORIGIN=http://127.0.0.1:3040 MEMBER_AUTH_ORIGIN=http://127.0.0.1:4194 TERRACE_TEST_IDENTITY_STATE=../identity/.state PLAYWRIGHT_BROWSERS_PATH=.state/browsers bun tools/test-reports-browser.ts
```

For the original password trial, omit all `CMS_AUTH_*` settings when starting the test CMS and running this check, retain its member-authentication settings, and use `tools/with-local` instead of the identity wrapper in the test command. This mode uses the generated local administrator and creates/removes a temporary local editor. It requires the synthetic bootstrap before starting the CMS; it is never a deployed-account provisioning tool.

Screenshots are written to ignored `.state/report-member.png` and `.state/report-reviewer.png`. Test content and any temporary trial editor are removed. The report migration’s rollback deletes stored snapshots; use it only on an empty synthetic database or after verifying backup and recovery for retained data.

Both browser checks load fixture credentials through `tools/local-fixtures.ts`, which validates the required string keys and replaces file/JSON errors with a static message. Run `direnv exec . bun test test/local-fixtures.test.ts` to verify malformed credentials cannot expose their contents through uncaught stderr.
