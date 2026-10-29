# Terrace web preview

A standalone SvelteKit redesign in `web/`. The legacy frontend and backend remain available as references. The default design preview uses visibly labeled sample events and verified newsletter links. A server-side Payload adapter can serve published CMS content; payments still use the official donation site.

## Local development

From `web/`, run `direnv allow .` once, then:

```sh
direnv exec . bun install --frozen-lockfile
direnv exec . bun run dev
```

The dev server hot reloads changes. To connect the separately running CMS:

```sh
CONTENT_SOURCE=cms CMS_ORIGIN=http://127.0.0.1:3010 direnv exec . bun run dev
```

For a populated design walkthrough, use `CONTENT_SOURCE=preview direnv exec . bun run dev --port 4176`. Keep the CMS preview on a different port, such as `--port 4174`: fixture event URLs are available only in preview mode, while CMS mode serves the records actually published there.

The development watcher excludes `.devenv` and `.direnv` and does not follow symlinks. Nix profiles point outside the app into the Nix store; traversing them previously exhausted the preview server's memory. Source changes still hot reload.

Each `bun run dev` process writes SvelteKit's generated routes and client/server modules to its own `.svelte-kit/dev-<pid>` directory, so parallel previews do not replace one another's route manifests. Tests and `bun run check` use the default `.svelte-kit` output; the CMS HTTP test gives its child Vite server a separate directory. Builds and `bun run preview` share `.svelte-kit/build`; run only one build/preview cycle at a time in a worktree. `bun run check` stays on the default output because `tsconfig.json` extends `.svelte-kit/tsconfig.json`. Dev, check and build commands serialize their default SvelteKit sync step with a 15-second lock wait. Normal completion releases the lock; after a forced process kill, the next command reports the lock path and PID, and you can remove the lock file after confirming no sync process is still running.

`CMS_ORIGIN` is the trusted server-to-server origin. If browsers reach media on a different origin, set `CMS_PUBLIC_ORIGIN` to that HTTPS origin. Neither may contain credentials or a subpath; plain HTTP is allowed only on loopback for development. No editor credential or visitor cookie is sent to the CMS. Production gateway routing must make public media available at `/api/media/file/` without exposing the private admin interface.

`CONTENT_SOURCE=preview` explicitly selects fixtures. With a CMS origin configured, the source defaults to `cms`; missing configuration, upstream failure, invalid records, or draft responses produce a generic 503, never sample content disguised as live data. Empty collections have empty states; unpublished or missing event details return 404. Requests have one four-second deadline per collection, bounded pagination and response bytes. Public reads are not cached in this layer, so unpublishing takes effect on the next request. CDN rules remain a separate acceptance gate.

For validation:

```sh
direnv exec . bun run check
direnv exec . bun test
direnv exec . bun run build
```

`devenv.nix` supplies Bun and TypeScript. `bun.lock` and `devenv.lock` pin dependencies. Nothing needs to be installed in a user profile or dotfiles. The SvelteKit Node adapter produces a deployable Node server; hosting and content migration remain separate acceptance gates. Payload is the selected CMS.

The web GitLab job checks, tests, and builds `web/` with a digest-pinned Bun image. Its build artifact expires after seven days. The former Heroku, Docker, and Terraform pipeline is archived at `.gitlab/legacy-ci.yml` as an inert reference; GitLab does not include or execute it.

Commit through the web shell (`direnv exec web git commit ...` at the repository root). Its local hook path runs web checks and tests for staged web/CI changes and scans the entire staged patch with gitleaks in redacted mode. The hook configuration lives in `devenv.nix`; it does not reformat the legacy code. Automatic hook installation is disabled because this repository's bare Git directory is shared by every worktree; the shell appends a temporary `core.hooksPath` without changing shared Git config.

## Content boundary

`src/lib/content/index.ts` defines the presentation types; `src/lib/server/payload.ts` validates published Payload responses before rendering events, newsletters and initiatives. The initial CMS body format is plain textarea text, rendered as escaped paragraphs. Newsletter publication requires a public PDF. The existing calendar sync, menu document import, newsletter documents and show media remain migration inputs; this adapter does not execute legacy integrations. The HTTP integration tests cover published/empty/draft/outage responses and escaped editor text.

The official [events page](https://princetonterraceclub.org/events/) showed no upcoming events when checked on 2026-10-27. Sample events exist only to demonstrate filtering and detail presentation. The site labels them throughout and links to the official calendar. Newsletter issue URLs and the donation destination were checked against the official site on that date.

## Assets

Clubhouse imagery and the badge were copied from this repository's `frontend/public/img/`: `background.jpg` → `web/static/images/clubhouse.jpg`, `tfc_1.jpg` → `clubhouse-snow.jpg`, `tfc-circle.png` → `food-is-love.png`, and `favicon-32x32.png` → `web/static/favicon.png`. Fonts are bundled from the `@fontsource-variable` packages; the rendered site does not request a font CDN.
