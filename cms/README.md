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
