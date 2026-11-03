# Terrace CMS trial

Payload 3 and Next.js provide an editorial admin and REST API for the separate SvelteKit website. This preview is **localhost only**. Editorial Keycloak sign-in is available; public deployment still requires TLS, production identity/database configuration, tested recovery and deployment review.

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
