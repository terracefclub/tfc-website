# WordPress to Payload import job

Repeatable, repo-local tooling that turns a WordPress WXR export into Payload documents. It builds on the
[parity plan](wordpress-parity-plan.md) and reuses the offline preflight's bounded, strict WXR parser
(`web/tools/wxr-preflight.ts`, `loadWxr`/`readWxr`); there is no second parser.

**Status.** Dry run and apply are verified against the synthetic fixture and the local preview database only.
The real export has had a dry run (aggregate counts below) and **no apply**. Media bytes, menus and plugin
settings wait for the Kinsta backup ZIP (see [What the Kinsta ZIP adds](#what-the-kinsta-zip-adds)). Historical
Gravity Forms entries are excluded, as the owner decided.

## Architecture and why

Two stages joined by a private plan file:

| Stage | Where | Does | Why here |
| --- | --- | --- | --- |
| Plan / dry run | `web/tools/wp-import/` | Parse WXR, map, sanitize, hash, build redirects and the reconciliation report. Pure: no database, network or clock. | The strict parser's dependency (`@rgrove/parse-xml`) lives in `web/`; CI runs these tests without PostgreSQL. |
| Apply / CMS dry run / rollback | `cms/tools/wp-import.ts` | Reads the plan, validates it again, and writes through Payload's **local API** with the run ledger. | Payload hooks, access rules, drafts/versions and migrations are owned by `cms/`; the local API reuses them and gives real transactions. |

`web/tools/wp-import/plan-schema.ts` and `sanitize.ts` are dependency-free and shared by both stages. The applier
re-validates every plan (hash seal, field allowlist per collection, URL/slug/date shapes, and re-checks every HTML
field with the sanitizer), so a hand-edited plan cannot smuggle unsafe markup or unknown fields into the CMS. Publication is *derived* during
validation, not trusted from the plan: a document may be published only if its source status is `publish`, it is not
password protected, its `wpStatus` equals the source status, `wpReviewFlags` equals its flags and none is a blocking
flag; redirect destinations are re-derived from the document slug. **The plan hash is an integrity check, not
authenticity**: anyone who can write the plan file can re-seal it, so keep plan files private and only apply plans you
generated. Blocking review flags and sanitizer findings are
**supplied by the plan and are not re-derived by the applier** (the applier cannot see the source markup or WXR), so a
consistently rewritten plan can clear them. Treat the plan file as trusted operator input protected by its file mode, and
re-run the planner from the WXR instead of ever editing a plan. Validation cannot know the real WordPress status of a record whose status fields were rewritten consistently.

The plan file holds titles and bodies. Treat it like the export itself: a private, owner-only directory outside every
Git checkout, never committed. Both tools create their outputs exclusively with mode `0600` (existing files and
symlinks are refused) using the same writer as the preflight (`web/tools/private-output.ts`).

## Commands

From the repository root; `EXPORT` is the protected WXR, `PRIV` an existing `0700` directory outside Git.

```sh
# 1. Dry run: reads the WXR, writes ONLY the safe reconciliation report. Nothing else is touched.
direnv exec web bun web/tools/wp-import/import.ts dry-run --report $PRIV/wp-import-dryrun-DATE.safe.json < $EXPORT

# 2. Plan: same, plus the full private plan the CMS stage applies.
direnv exec web bun web/tools/wp-import/import.ts plan --out $PRIV/wp-import-plan.json --report $PRIV/plan-report.json < $EXPORT

# 3. Against the local preview CMS (`tools/local-stack`, migrations applied; see docs/local-preview.md):
cd cms
direnv exec . tools/with-local bun tools/wp-import.ts dry-run  --plan $PRIV/wp-import-plan.json --report $PRIV/cms-dryrun.json
direnv exec . tools/with-local bun tools/wp-import.ts apply    --plan $PRIV/wp-import-plan.json --report $PRIV/cms-apply.json
direnv exec . tools/with-local bun tools/wp-import.ts rollback --run wpimport-YYYYMMDDHHMMSS-abcdef
```

`bun run import:wordpress -- ...` is the same entry point from `web/` and `cms/`. Apply options: `--publish`,
`--run-id ID` (default generated), `--overwrite-edited`. Rollback option: `--discard-edits`. The CMS tool refuses a
non-local `DATABASE_URI` (Unix socket or loopback only) unless `--allow-nonlocal-database` is passed for an approved
target. "Local" means a Unix-socket `host=` path or loopback host; an empty host does not count (libpq would fall back to `PGHOST`), `PGHOST` must itself be unset or local, and loopback also admits an SSH tunnel to a remote database, so the flag guards intent rather than topology. Terminal output is always aggregate counts and fixed error text, never record contents, paths or URLs.

Regenerate the committed synthetic plan used by the CMS tests: `direnv exec web bun web/tools/wp-import/write-fixture-plan.ts`.

## Identity and idempotency

Every imported document carries `wpId` (WordPress post ID, unique index) and `wpGuid`, plus `wpStatus`,
`wpPasswordProtected`, `wpReviewFlags`, `wpContentHash`, `wpAppliedHash` and `wpImportRun`. They exist on Media, Events,
Newsletters, Initiatives and the new Posts and Pages collections (Redirects carry the ID, hashes and run). Migration
`20261119_014504` adds the columns, the new collections and the run ledger. Only the importer writes them (field access
denies API updates; staff can read, the public API never sees them).

For each plan document the applier looks up `wpId` and decides:

- **create** when none exists;
- **skipped / unchanged** when the stored `wpContentHash` equals the plan's `targetHash`;
- **skipped / locally-edited** when an editor changed the document since the import (the stored `wpAppliedHash` no
  longer matches the newest saved state, including draft-only saves). Source changes never clobber editors. Re-run with
  `--overwrite-edited` to take the source anyway;
- **update** otherwise, clearing fields the source no longer supplies. Updates never change publication status, and an update to an already **published** document is written as a draft version, so the public page does not change until an editor reviews and publishes it (the `wp*` hashes on the live row move with it, and the applied hash is also stamped on the draft version so publishing that draft keeps re-runs idempotent).

Applying the same plan twice therefore yields identical state and writes nothing (tested). Re-running after a changed
export updates only what changed.

## Mapping

| WordPress | Target | Notes |
| --- | --- | --- |
| `post` with a newsletter category/title **and** a PDF attachment (child attachment or linked upload) | Newsletters | Issue date from the GMT date. No issue date: unmapped. Never guessed from name alone. |
| other `post` | Posts (new) | Sanitized `bodyHtml`, excerpt, categories, tags, SEO, display-name byline, featured media. Served at `/news/` and `/news/{slug}/`. |
| `page` | Pages (new) | Same fields plus parent ID and menu order. Pages already living at `/about`, `/contact`, `/donate`, `/merchandise`, `/shows-archive`, `/newsletter`, `/events`, `/initiatives` are marked served-in-place. Others target `/pages/{slug}`, served by the frontend. |
| `tribe_events` | Events | `_EventStartDateUTC`/`EndDateUTC` are the instants. Local times, timezone string and all-day flag are kept. Venue name and address and organizer name are stored as text (no emails, phones or sites). Category from event category terms, defaulting to `community` with a review flag. |
| `project` | Initiatives | Summary from the excerpt. |
| `attachment` | Media, **reference only** | `sourceUrl`, `sourceFile`, alt, caption, mime (from extension), width/height from attachment metadata. No bytes, never public. |
| venues, organizers | folded into Events | Not standalone documents (reason `embedded-in-events-not-standalone`). |
| nav menu items, Divi layouts, custom CSS, global styles | unmapped | Reasons `menus-need-database-backup-or-review`, `divi-layout-library-not-imported`, `theme-styles-not-imported`. |
| trash, auto-draft, revision, unknown type/status, duplicate or invalid IDs | unmapped | Never imported, listed with a reason. |

Event date policy: when the UTC pair is missing and the zone is a recognized IANA zone the local time is converted;
a WordPress fixed offset (`UTC-4`) is applied as that fixed offset, never guessed into a DST-aware zone, and is
flagged `event-timezone-review`. No dates, or an unconvertible zone, means no event. An end not after the start is
dropped and flagged. A missing venue becomes "Location to be confirmed" and is flagged.

Slugs are normalized per collection; the lowest WordPress ID keeps a duplicated slug and the rest get `-{id}`
(`slug-deduplicated`). A slug already taken by a non-imported document gets `-wp{id}`.

### Status and publication

Everything is created as a **draft** unless apply is run with `--publish`, and then only documents the plan marks
eligible: source status `publish`, no password, and no blocking review flag (`unsafe-html-stripped`,
`builder-code-dropped`, `form-shortcode-dropped`, `plugin-shortcode-dropped`, `event-date-review`,
`event-timezone-review`, `event-venue-missing`, `event-end-invalid`, `media-bytes-pending`). Draft, pending, private,
future and password-protected sources stay drafts (staff-only); passwords are never copied. Items referencing
reference-only media cannot publish until bytes exist, because the Events/Newsletters/Initiatives publish hooks
require public media. `--publish` only affects documents created by that run (a run that publishes nothing says so in its report `notes`); use the CMS to publish later.

### HTML and shortcodes

Bodies pass through `convertBody`: Divi layout shortcodes are stripped keeping their text; `et_pb_image`,
`et_pb_button`, `et_pb_blurb` title, `caption` and `embed` are converted; Gravity Forms and plugin shortcodes are
dropped and flagged; Divi code modules are dropped whole. A tokenizing allowlist sanitizer then keeps only basic
text, list, table, link and image elements, drops every other attribute, requires `http`, `https`, `mailto`, `tel` or
relative URLs (entity-decoded and control-character-stripped before checking), removes script/style/iframe/object/embed/
form/svg/math and similar **with their contents**, drops comments and declarations, and always escapes text. Output is a
fixed point (`isSafeHtml`), checked again by the applier and, as defence in depth, by a CMS hook on Posts/Pages. Sources
that needed stripping are flagged and never auto-published. Events and Initiatives store plain text because the current
frontend renders textareas as text.

## Redirect map

For every published, unprotected mapped item the plan lists old path to new path. Only path-only URLs on the known
Terrace hosts are representable by the Redirects collection (`/a/b`, no query, dots or percent-encoding). Others are
listed as unmapped with `redirect-query-or-fragment-route`, `redirect-foreign-origin`, `redirect-unrepresentable-path`,
`redirect-site-root` or `redirect-duplicate-source-path`; queries are never dropped to force a match. Source paths
are stored without the trailing slash; the redirect layer must trim one trailing slash before lookup (the tests use
`resolveOldUrl`, which does). Dry runs put the map in the report; apply writes it to `redirects` as 301s with
`active: false` until the target is published, so nothing public redirects to a draft. A later apply run activates the
redirect once its document is published. Served-in-place pages need no row. Sources that are, or sit under (case-insensitively), routes the new site serves or reserves (`/members`, `/auth`, `/preview`, `/api`, `/admin`, `/_app`, `/events`, `/newsletter`, `/news`, `/pages`, `/donate`, and the top-level pages) are never redirected (`redirect-reserved-route`), and a source equal to its destination is skipped. Existing redirects on the same source path
that the importer did not create are left alone (`source-path-taken`).  The frontend consumes the active rows (see [Frontend](#frontend)).

## Reports

- **Planner report** (`kind: wp-import-dry-run-report`): counts by source type and status, mapped counts by collection,
  unmapped counts by reason, review-flag counts, per-document `sourceHash` (raw source fields) and `targetHash` (mapped
  document), unmapped list, redirect map, a reproduction check against the preflight (`itemCount`,
  publish-status candidates) and the deferred-to-ZIP status. Documents are identified by source ordinal only. No titles,
  bodies, author names, emails, WordPress IDs, GUIDs or metadata values. Redirect paths appear only for published,
  unprotected items, which are public URLs.
- **CMS report** (`wp-import-run-report`): created/updated/skipped/failed per collection and for redirects, per-document
  action and reason, plus `appliedHash` (hash of the stored fields).

## Run ledger and rollback

Apply creates a `wp-import-runs` row and, per write, a `wp-import-journal` row in the **same transaction** as the write
(admin-readable only). Created documents are journaled with their post-write hash; updates also store the full
pre-image of the managed fields. Every write is tagged with the run ID in `wpImportRun`.

`rollback --run ID` first checks every row without writing, and **refuses** (listing reasons, changing nothing) when:

- `later-run-depends-on-document`: a later, not rolled back run wrote the same document (roll back newest first);
- `edited-since-import`: the document changed after the run wrote it (override with `--discard-edits`);
- `published-since-import`: an editor published a document the run created as a draft (override with `--discard-edits`);
- `referenced-by-other-documents`: media created by the run is referenced by a document outside the run;
- `status-changed-since-import`: for an **updated** row, the document's publication state differs from what the run left (an editor published or unpublished it); `_status` is never restored by rollback;
- the run is unknown, already rolled back, or still `running`. A crashed apply is marked `failed` and can be rolled back. A
  run left `running` by a killed process needs `--take-over-stale`, and only once the run has been idle for more than one hour: staleness is measured from the run row's `updated_at`, which every write bumps as a heartbeat, so a long but live apply is never stale
  (`run-not-stale` otherwise). Lowering the threshold needs the extra explicit `--stale-after-minutes N` (an integer of at least 1); the threshold exists to avoid taking over a live apply.

Otherwise it processes rows newest first inside **one transaction that first locks the run row and re-checks every precondition** (any failure changes nothing, so a retry is always safe). Every apply write takes the same lock first and requires the run to still be `running`, so an in-flight apply that is taken over is refused at its next write, stops, and its final status update (conditional on `running`) cannot overwrite `rolled-back`. It deletes documents the run created and restores updated documents from
their pre-image (published documents receive the restored content as a draft version), then marks the run `rolled-back`. Journal rows written before `postStatus` existed skip the status check. Rollback is covered by tests for
refusal and success paths.

A failed document does not stop the run: it is counted as failed with a fixed reason code, the run is marked `failed`,
and everything it did write can still be rolled back.

## Migration note

`cms/migrations/20261119_014504.ts` was generated by `payload migrate:create`; its `down` was hand-edited to
`DROP ... IF EXISTS` because the generated rollback dropped constraints that `DROP TABLE ... CASCADE` had already
removed. Verified locally: `migrate`, `migrate:down`, `migrate` again, and a second `migrate` as a no-op.
`cms/tools/ci.ts` derives the expected ledger from `cms/migrations/index.ts` (`tools/release/migrations.ts`), so it needs no count update.

## What the Kinsta ZIP adds

Not yet supplied. When it arrives, first run `web/tools/kinsta-backup-preflight.py` (see the parity plan), then extend
this job; the typed hooks are in `web/tools/wp-import/zip-hooks.ts` and report as `todo-kinsta-zip`.

| ZIP content | Adds | Hook / where it plugs in |
| --- | --- | --- |
| `public/wp-content/uploads/` bytes | Original files for every Media reference, with SHA-256 reconciliation of derivatives, the missing attachments the export lacks (18 referenced IDs, 28 body URLs), PDFs for newsletters. Needed before any Media can be public and before newsletters, events with posters, and initiatives with images can publish. | `MediaBytesProvider.find()`; the CMS stage then updates each reference with `file` (the Media hook already accepts that and keeps `public: false` until an editor approves). Planner would clear `media-bytes-pending` once bytes verify. |
| SQL dump, menus (`nav_menu_item`, term relationships) | Real menu structure for the 11 menu items the WXR only names; category/term relationships for Pages. | `DatabaseTableProvider.menus()` feeding a future navigation collection. |
| SQL dump, plugin options | Divi, The Events Calendar, Yoast, redirect-plugin and Gravity Forms settings (site-wide settings not in the WXR); real redirect rules to merge with this map. | `DatabaseTableProvider.pluginOption(name)` with an allowlist; secrets must never be persisted. |
| SQL dump, `wp_users`/`wp_usermeta`, entries | Not imported: no WordPress accounts become users, and Gravity Forms entries stay excluded. | none by design |
| Kinsta redirects, Nginx and DNS | **Not in the ZIP** (provider settings). Export separately; see the parity plan. | out of scope for the job |

## Limits and open items

- The redirect consumer and body rendering have the limits listed under [Frontend](#frontend).
- Divi layouts are flattened to text and basic HTML; pages flagged `divi-layout-review` need visual comparison.
- Media `alt` falls back to the title or filename when the export has none (`alt-missing`); editors must review.
- Effective public access (membership/password plugins) is still unproven; "publish" status is a candidate only.
- The pg driver prints a "client.query() already executing" deprecation warning during Payload's transactional writes. `cms` pins `pg` at exactly 8.16.3 and Payload's Postgres adapter carries its own copy; pg 9 turns the warning into an error, so do not upgrade either until Payload stops issuing concurrent queries on one client.
- Plain-text fields (titles, summaries, Events/Initiatives bodies) are stored entity-decoded and must only ever be rendered as text. Only `bodyHtml` is HTML.
- The fixture uses the club's public host with invented paths: it exercises the production host allowlist unchanged, and no real post is reproduced.

## Frontend

Imported content is read by the SvelteKit site from the CMS's public REST API (published documents only), in the same
way as events and newsletters (`web/src/lib/server/payload.ts`). The sample site (no CMS) shows the empty states.

| Route | Content | Notes |
| --- | --- | --- |
| `/news/` | Published Posts, newest first, 12 per page (`?page=N`; a page past the end is a 404) | Title, date, excerpt, empty state. Listed in the footer navigation; the header was left unchanged. |
| `/news/{slug}/` | One post | Title (the only `h1`), date and byline, body, older/newer links (same-instant posts are ordered by id, as in the list). |
| `/pages/{slug}/` | One Page | Same layout without date. Served-in-place pages keep their hand-built routes. |

Titles and excerpts are rendered as text. The date is shown in `America/New_York`, like events. `<title>` uses `seoTitle` then
the title; the description uses `seoDescription` then the excerpt; each page has a canonical URL from the request origin.
Draft, private and missing slugs (and malformed ones) all return the identical 404 page, so a draft's existence is not
disclosed; the API request itself also asks only for `_status=published` and the client refuses any document that is not.
The existing editor preview toggle only switches between sample and published content, so posts and pages follow it.
**Known gap: no draft preview exists for any collection.** Events, Newsletters, Initiatives, Posts and Pages all have
Payload drafts (`versions: { drafts: true }`), but none configures Payload live preview or an admin preview URL, and the
website reads only published documents with no preview route or secret. Editors therefore review an imported draft in the
Payload admin (the fields and the rich text) and see how it looks on the site only after publishing. Building a draft preview
(a signed preview route in the website plus a preview URL in the collections, with the same editorial access checks) is
deliberately not done here and needs an owner decision on how editors authenticate to the website. A CMS outage is a 503
on these routes, as for events.

### Render-time sanitization

`bodyHtml` is never trusted, although the importer and a CMS hook already sanitized it. The importer's sanitizer now
lives in `web/src/lib/html-sanitize.ts` (`web/tools/wp-import/sanitize.ts` re-exports it, behaviour and tests unchanged).
`renderBody` (`web/src/lib/render-body.ts`, run on the server in the page load) sanitizes with the same allowlist, applies
the image and link policy below, then sanitizes again so the output is always a fixed point of the allowlist. Only that
output reaches `{@html}` (`RenderedBody.svelte`). Script, handlers, `javascript:` and `data:` URLs, styles, forms, frames,
SVG and unknown attributes are stripped; a body `h1` is demoted to `h2`, so each page has one `h1`.

The two routes also send a `Content-Security-Policy` as a backstop: `base-uri 'none'; object-src 'none'; frame-src 'none';
frame-ancestors 'none'; form-action 'self'; img-src 'self' data:` plus the CMS public media origin. The app had no CSP, so
`script-src` and `style-src` are deliberately not set here (SvelteKit's inline hydration script would need nonces); this
neither weakens an existing policy nor claims to replace the sanitizer. All existing headers are unchanged.

### Image policy (decision: drop, no placeholder)

Media bytes are not imported yet, so a body image survives only if it points at the CMS public media path
(`/api/media/file/<name>`, no query, on `CMS_PUBLIC_ORIGIN`; a relative form is anchored to that origin; the file name starts with a letter or digit and has no `%` or `..`). `CMS_PUBLIC_ORIGIN` is required: the internal `CMS_ORIGIN` is never used for visitors, so with only that set every body image is dropped and the CSP names no media origin. Every other image
(old WordPress uploads, other hosts, relative paths) is removed with no placeholder. A figure left without its image keeps
its caption as a paragraph, and a link left empty by the removal is deleted. Nothing broken is rendered. When media bytes
arrive and Media records become public, images using that path appear without code changes.

### Links in bodies

Every link carries `rel="noopener noreferrer"` (the sanitizer re-emits it with a fixed value; `target` is never allowed).
Links to the old site (relative paths, or the importer's known hosts) without a query string are looked up in the redirect
map and rewritten to the new same-site path, keeping a `#fragment`; at most 25 distinct links per page are looked up, in sequential batches of 4 that are
exempt from the 404-flood cap and skip the loop check, so every mapped link rewrites on the first render (a cold page with 25
links costs up to about 7 round trips). Unmapped or failing lookups leave the link as written.

### Redirect consumer

`web/src/hooks.server.ts` answers a request with the stored redirect **only when no route matched** (`event.route.id`
is null), before rendering the 404, for GET and HEAD. So a redirect row can never shadow a real route, and `/news/old/` or
`/events/old/` keep their own 404s. Rules (`web/src/lib/server/redirects.ts`, covered by `web/tests/redirects.test.ts`):

- Path normalisation: one trailing slash trimmed, case matched exactly as stored. Only paths that could be stored sources
  (`/a/b-c_d`, at most 500 characters, no `//`, no dots or percent-encoding, so no static asset or `__data.json`) reach the CMS.
- Never answered, never queried: `/members`, `/auth`, `/preview`, `/api`, `/admin`, `/_app`, `/events`, `/newsletter`, `/news`,
  `/pages`, `/donate` and their sub-paths, plus the exact top-level routes (`/about`, `/contact`, `/join`, `/apply`,
  `/merchandise`, `/shows-archive`, `/initiatives`; their old sub-paths such as `/about/history` may redirect).
- Only the `active` row for the exact source is used (the CMS also hides inactive rows from the public API, and the client
  re-checks). The destination must be a same-site path: external URLs, `//`, backslashes, schemes, dot segments, queries and
  fragments are refused, and so is a destination equal to its source. A trailing slash is added to avoid a second hop.
- One hop only: the destination is never followed. A two-step loop (A to B while B points back to A) is refused.
- The status is the stored 301 or 302. The **query string is dropped**: stored sources have none and the importer never maps
  routes that depend on one. HEAD is handled as GET; other methods are untouched.
- Cache: in memory, bounded to 500 entries (least recently used dropped, so hot redirects survive a flood of unknown paths), 5 minutes for hits, 1 minute for misses, 10 seconds for CMS
  failures, concurrent lookups of one path shared, at most 8 lookups in flight (more are answered as a plain 404), 1.5 s
  timeout. The cache is per server process and is not purged when an editor changes a redirect, so a change can take
  up to five minutes to appear (use the one-minute miss window for new rows).
- Fail open: an unreachable, slow or malformed CMS answer is the ordinary 404 page. With the CMS unreachable, each distinct unmatched path waits up to 1.5 s once, then the 10 s failure cache answers instantly.
- A redirect whose destination is a draft redirects and then shows the 404, so redirects must be activated only after their target is published (the importer already does this).
- Limits: it relies on the public API hiding inactive rows (`activeRedirectOrStaff`); a 302 or 301 from a cache outlives a
  later deactivation in browsers (`Cache-Control: public, max-age=300` is sent). Redirect rules held only by Kinsta or
  Nginx are not part of this.

## Verification

```sh
direnv exec web bun run check && direnv exec web bun test           # includes web/tests/wp-import.test.ts
cd cms && direnv exec . bun run check && direnv exec . bun run check:release
direnv exec . tools/with-local bun run migrate && direnv exec . tools/with-local bun test
```

### Real export dry run (2026-11-18)

Dry run only, report written `0600` beside the preflight report. It reproduces the preflight: **245 items** and
**87 publish-status candidates** (equal). Mapped 215 documents (122 media, 41 posts, 25 pages, 14 events, 12 newsletters,
1 initiative); 30 records unmapped by design (11 venues/organizers, 11 menu items, 4 Divi layouts, 3 style records, 1
event with no start date); 88 published items yield 86 redirects (80 redirect, 6 served in place) and two explicit gaps
(the site root and one source that collides with a reserved route; this is the final dry run, after the reserved-route rule); 56 documents are publish-eligible by status and review flags (everything else needs review first).
