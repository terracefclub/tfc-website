<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Terrace CMS

- This directory is an isolated Payload/Next application. Do not change the SvelteKit `web/src` application from here.
- Run commands through `direnv exec cms` or from this directory with `direnv exec .`.
- PostgreSQL and generated credentials live only in ignored `cms/.state/`; `tools/local-up` is idempotent and binds PostgreSQL to a local Unix socket.
- Run explicit migrations before bootstrap or tests. Never use schema push for deployment.
- `bun run check` verifies TypeScript; `tools/with-local bun test` runs real PostgreSQL tests. The optional HTTP test runs when `CMS_HTTP_URL` points to an owned local CMS process.
- `bun run build` is a heavy build: run it on falcon under `tools/falcon-heavy` with the shared lock.
- Password login and synthetic bootstrap are localhost trial features. Production requires per-user OIDC before exposing the admin.
