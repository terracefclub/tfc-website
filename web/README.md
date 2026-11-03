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

For a detached walkthrough of the latest merged website, install dependencies as above,
start your own local identity using `../identity/README.md`, and run from `web/`:

```sh
direnv exec . ../identity/tools/with-local bun tools/local-preview.ts
```

This starts the hot-reloading website at `http://127.0.0.1:4194/`, with explicitly
sample public content and private API calls to the separately migrated CMS at
`http://127.0.0.1:3040`. Set `CMS_ORIGIN` to another plain HTTP `127.0.0.1` origin
when starting your own CMS elsewhere. The member callback origin is always4194.
If using an existing dedicated identity in another worktree, substitute its
absolute `identity/tools/with-local` path; credentials are inherited without
copying or printing their values. The CMS must use that same identity realm.
Use **Editor sign-in** above the site navigation to open the configured Payload
portal at `/admin/login`. The link appears only on this dedicated local
development preview. **Members** opens the separate private community.

After publishing in Payload, choose **View published site** above the navigation.
The calendar opens with published events; the homepage, newsletters and initiatives
also use anonymous CMS reads. **View sample site** returns to the design fixtures.
The choice lasts for this browser session and works with JavaScript disabled.

The launcher refuses an occupied4194 and never stops an existing process.
It records its detached wrapper's exact PID in `.state/local-preview.pid` and
keeps output in `.state/local-preview.log` (directory0700, files0600).
After verifying the recorded PID belongs to this checkout, stop only that PID
with `kill -TERM <pid>`; the wrapper forwards termination to its Vite child.
Restarting the website clears its in-memory member sessions. Existing previews
in other worktrees are left running.

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


## Full newsletter reader

The four curated issues are readable cover to cover at `/newsletter/<issue>/`, with `#page-N` deep links. Every original page has an uncropped, lazy-loaded image, a smaller responsive source, and text extracted from the PDF behind a native disclosure. Text extraction may change column order or lose decorative lettering; the image and linked original remain authoritative. Page controls and zoom enhance the continuous document; the complete document and page index still work without JavaScript. Zoom stays inside the page pane rather than widening the whole site.

`tools/newsletter-ocr/` is a repeatable OCR job that reads each page image with the devenv-provided Tesseract and writes `src/lib/archive/ocr/<issue>.json` (text, confidence, image hash, tool version per page); rerun it with `direnv exec . bun run ocr:newsletters`. Its README has options, runtime and the falcon route. The text is machine output, not a corrected transcription.

The issue reader has a client-side search box over every page of all four newsletters (`src/lib/archive/search.ts`, `NewsletterSearch.svelte`). It searches the PDF text layer and the OCR text together, matching every typed word as a word prefix, and shows page numbers with a short snippet of the matched source text only. Its index is built on the server from `pages.json` and `ocr/*.json` and served at `/newsletter/search-index.json` (about 173 KB, 56 KB gzipped, revalidated by ETag); it loads only when a visitor starts typing, and the search box is absent without JavaScript. Results for the open issue reuse the reader's page navigation; other issues deep-link to `#page-N`.

`static/archive/pages/manifest.json` records page dimensions, source-PDF hashes, derivative hashes, and byte sizes. `src/lib/archive/pages.json` adds extracted text and is imported only by the server loader. The original PDF URLs are in `src/lib/archive/content.ts`; selected-story provenance remains in `static/archive/manifest.json`. The reading derivatives were rendered with Poppler at 1800px wide and encoded as WebP quality84; responsive derivatives are at most600px wide, quality82 or lower to stay below180KB. No crop is applied. Regeneration must retain the source-PDF hash and page count, review a contact sheet for each complete issue, and rerun the archive integrity tests. These assets are selected public issues, not an automated CMS import.
## Private member sessions

Member routes require an approved Keycloak `current-member` or `alumni` role. Enrollment is closed by default; the public website and CMS editorial login are separate. The server uses an authorization code flow with PKCE, state, nonce and signed ID-token verification. Access and rotating refresh tokens stay in process memory; the browser receives an opaque HttpOnly, SameSite cookie. HTTPS is mandatory outside the local loopback preview.

Configure `MEMBER_AUTH_ISSUER`, `MEMBER_AUTH_CLIENT_ID`, `MEMBER_AUTH_CLIENT_SECRET`, `MEMBER_AUTH_ORIGIN` and `CMS_ORIGIN` through a secret-managed service environment. Register the exact `<MEMBER_AUTH_ORIGIN>/auth/callback` and `<MEMBER_AUTH_ORIGIN>/` logout return in Keycloak. The CMS independently verifies resource-audience tokens and live session introspection; see `../cms/README.md`. All member and authentication responses prohibit caching and indexing. Tokens and credentials must never be logged.

This first single-node pilot intentionally keeps bounded sessions in memory: restarting the web service signs everyone out, and multiple web instances are not supported yet. Sessions have an eight-hour absolute lifetime. Access tokens last at most sixty seconds and refresh before expiry. Disable a user or revoke their Keycloak sessions for immediate access removal; role changes alone take effect when the short-lived token refreshes. Keycloak or CMS failures deny private access without affecting public pages. Member API calls have a five-second deadline, reject redirects and limit response bodies to one MiB.

Local identity setup and synthetic preview accounts are documented in `../identity/README.md`. POST `/auth/logout` must come from the configured website origin; GET never signs a user out.

After an approval denial, the origin-checked POST form “Use a different account” starts a fresh authorization transaction with `prompt=login`, clears any prior local session and revokes its refresh token. Ordinary sign-in keeps normal SSO behavior. Authentication failures show fixed recovery copy without reflecting provider diagnostics or credentials. Recovery HTML uses `Referrer-Policy: strict-origin` so browsers send a usable origin for the protected POST while withholding callback paths and query parameters; other authentication responses keep `no-referrer`.

## Noticeboard preview

The sample events are intentionally fictional: Midnight Soup Symposium, Feedback for Houseplants, and Pool Table Peace Talks. Their existing URLs remain stable. Every card and detail page identifies the samples; they are never inserted into the CMS and have no booking or payment action.

Event photos are real archive material, captioned separately from the imagined events. `static/culture/event-media.json` records the pool-room and pie derivatives, their PDF/page sources, hashes, sizes, and original dimensions. Both are uncropped WebP conversions. The existing Solarium Sessions photo is documented with the other archive sources. Cards lazy-load photos; detail pages preserve their original proportions. Anton is bundled locally as a Latin-only display font, with its license at `/fonts/anton-OFL.txt`; body text remains DM Sans. Listing data includes card summaries rather than unused event descriptions, and the homepage sends only the latest newsletter and displayed initiatives to keep its HTML below the existing 45 KB budget.



## Offline form-definition inventory

From a clean checkout, install the pinned dependencies as above, then run from the repository root:

```sh
direnv exec web bun web/tools/gravity-forms-inventory.ts < /protected/terrace/forms.json
```

This read-only command summarizes an authorized Gravity Forms definition export by numeric form/field IDs, allowlisted types, required/conditional status and structural counts. It has no WordPress or network integration. Keep the source export outside the checkout: settings, labels, choices and recipients may contain private information. The report excludes all free text and submissions; unknown field types become `other`. Input is limited to 8 MiB of UTF-8 JSON, eight nested field levels and the supported shapes described in [the migration plan](../docs/wordpress-parity-plan.md#inventory-form-definitions-offline). Errors produce a fixed message, nonzero exit and no partial report. This is an inventory aid, not a complete backup, import or proof of migration parity.

Rerun its synthetic privacy/format/bounds checks with `direnv exec web bun test web/tests/gravity-forms-inventory.test.ts` from the repository root. No real export is required for tests.
