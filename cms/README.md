# Terrace CMS trial

Payload 3 and Next.js provide an editorial admin and REST API for the separate SvelteKit website. This trial is **localhost only**. It does not deploy or expose password login publicly. Production needs per-user OIDC, session and role mapping, backups, and deployment review before launch.

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

- `events`: `slug`, `title`, `summary`, `startsAt` (UTC ISO), optional `endsAt`, `category` (`music`, `food`, `community`), `locationName`, optional plain-text `body`, optional `coverImage`, `_status`.
- `newsletters`: `slug`, `title`, `issueDate`, `summary`, required-on-publication `issuePdf`, optional `coverImage`, `_status`.
- `initiatives`: `slug`, `title`, `summary`, optional plain-text `body`, `ctaLabel`, `ctaUrl`, `coverImage`, `_status`.
- `redirects`: `sourcePath`, `destinationUrl`, `statusCode`, `active`; only active redirects are public.
- `media`: `alt`, `caption`, `public`, `url`, `mimeType`; only explicitly public media are visible or downloadable anonymously.

Payload emits absolute `media.url` values using `CMS_ORIGIN`. Consumers should accept URLs only from that configured origin and rewrite the pathname to their trusted public CMS origin as needed. Uploads allow PNG, JPEG, WebP, and PDF, at most 10 MiB, and check file signatures. Published content cannot reference private media. A published newsletter must have a public PDF. Media referenced by published content cannot be made private or deleted until that content is unpublished. An anonymous direct upload URL returns 403 for private files.

## Editorial workflow and validation

Admin users can manage accounts and all content. Editors can create and edit content, but cannot create users, grant themselves admin, or delete content. Password login is only for this loopback trial. Do not set up a public proxy until OIDC is implemented and verified. `CMS_LOCAL_BOOTSTRAP=1` and loopback `CMS_ORIGIN` gate the synthetic bootstrap.

After schema changes, run `direnv exec . tools/with-local bun run migrate:create -- --name <short-name>`, review the generated migration, and run `migrate`. PostgreSQL adapter schema push is disabled. `bun.lock` and `devenv.lock` pin JavaScript and shell dependencies.

```sh
direnv exec . bun run check
direnv exec . tools/with-local bun test
```

For the direct HTTP file ACL test, run the CMS locally and use `direnv exec . tools/with-local env CMS_HTTP_URL=http://127.0.0.1:3010 bun test`. CI starts isolated PostgreSQL, applies migrations, builds the app, starts the production server, and runs all tests; it has no deploy step.

## Community identity boundary

The separate `members` collection authenticates only Keycloak access tokens; it has no password login or public account-creation endpoint. Configure `MEMBER_AUTH_ISSUER`, `MEMBER_AUTH_AUDIENCE=terrace-community`, `MEMBER_AUTH_CLIENT_ID=terrace-web`, and the dedicated confidential introspection client's `MEMBER_AUTH_INTROSPECTION_CLIENT_ID` / `MEMBER_AUTH_INTROSPECTION_SECRET` through the environment. Missing or invalid configuration denies member access. Keep the existing CMS loopback gate until editorial SSO and deployment review are complete.

Only explicitly approved `current-member` and `alumni` realm roles permit access. Tokens require the expected issuer, resource audience, authorized client, RS256 signature, expiry, token type, and an issuance age of at most 65 seconds. Every authenticated request also introspects the token; an inactive session or unreachable provider denies access. Configure Keycloak access-token lifetime to 60 seconds: role removal takes effect no later than token expiry, while session revocation is checked on every request. Identity uses a unique hash of issuer plus subject; email changes cannot take over an existing member.

Member identities cannot use editorial accounts, draft versions, or private editorial media. Member collection reads are restricted to the signed-in identity; no member directory is exposed here. Identity keys are hidden from collection reads. The authenticated me endpoint returns only the current identity and approved roles, never a token. Profile/community authoring belongs to separate collections with their own access rules. Tests use an isolated signed-token provider and PostgreSQL to verify the boundary; these tests do not substitute for a real Keycloak browser-login check.
