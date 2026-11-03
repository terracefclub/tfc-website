# WordPress parity and content migration plan

**Evidence dates:** public audit 2026-10-28; supplied WordPress/Gravity Forms exports dated 2026-11-03. The preflight is read-only. Content import and cutover remain gated; the separate local member/SSO pilot is implemented and linked below. Follow-ups belong to [inventory #3](https://gitlab.com/terrace/tech/tfc-website/-/issues/3) and [migration #4](https://gitlab.com/terrace/tech/tfc-website/-/issues/4).

## Publicly verified source inventory

A read-only audit of [princetonterraceclub.org](https://princetonterraceclub.org/) and its unauthenticated REST API found 22 public pages and 53 posts; `wp/v2` exposes pages, posts, media, projects, venues, organizers, events, and calendar embed types. The site exposes API namespaces for Gravity Forms (`gf/v2`), The Events Calendar (`tribe/events/v1`, `tribe/views/v2`, `tec/v1`), Akismet, Divi, Yoast, Google Site Kit, and CSV user import. Public page source loaded Divi, Gravity Forms, Gravity Forms Stripe on donations, FlowPaper, recurring-donation, Snazzy Maps, Google Drive integration on menus, Akismet, and Divi Blog Extras assets. Asset/namespace presence does not prove plugin settings, versions, or operational integrations.

Public pages include about, join, membership, dues, financial aid, reporting, contact, donate, newsletter archive/submissions, merchandise, menus, shows archive, announcements, and member/archive pages. Public post inventory includes dated newsletters and club stories. The public The Events Calendar query returned no events on audit date despite exposed event/venue/organizer types, so calendar source and historical/expired data must be checked through an authorized export. The public `tribe_events` type also returned zero records.

### Visible forms and fields

- **Contact:** name, email, class year, phone, inquiry reason, message, optional website/link and file. Page displayed a 128 MB file limit; actual server enforcement is unverified.
- **Newsletter contribution:** first/last name, class year, email, story text, optional website/link and photo (page lists jpg/jpeg/png/gif). Editorial approval before publication is a required migration boundary.
- **Donation:** name, class year, email, phone, address, first-time donor, fund designation (Financial Aid/PPF), amount/other amount, recurring choice, card/PayPal method, dedication details, employer matching. Stripe assets were present. Active processors, account ownership, recurring billing and webhook settings are unknown.
- **Merchandise:** name, email, sweatshirt quantity/size, pickup/mail choice, shipping/address and total. Inventory, payment and fulfillment are unverified.

Historical Gravity Forms submissions are excluded from the current migration by the owner's decision. Do not import or delete them. Retain the existing site and protected backups for recovery/archive purposes. Payment credentials are not content to copy into the CMS. Public REST output is not a complete database or plugin inventory; the supplied form definitions improve that evidence but do not supply add-on feeds or provider account configuration.

## Supplied-export evidence and limits

The private WXR contains 245 item records, 10 author records and no comment records. Valid, unique numeric item IDs were observed. It is a content export, not a verified complete site backup or a WordPress user-account migration. The XML filename is not the canonical hostname: channel/base-site/base-blog fields, content links and attachment URLs identify `https://princetonterraceclub.org`. No source URLs were fetched.

| WXR record type | Records | Observed status scope |
| --- | ---: | --- |
| Posts | 53 | 53 publish |
| Pages | 25 | 22 publish, 3 draft |
| Events | 15 | 12 publish, 2 draft, 1 pending |
| Attachment records | 122 | 122 inherit; visibility and actual files unverified |
| Navigation items / Divi layouts | 11 / 4 | Preserve for navigation/layout review, not automatic content publication |
| Organizers / venues | 5 / 6 | Preserve source relationships; review public contact/address fields privately |
| Custom CSS / global styles / projects | 2 / 1 / 1 | Retain in the source ledger for explicit mapping/review |

The 87 publish-status posts/pages/events have no nonempty post-password fields and have valid, unique source URIs. They are **publication candidates**, not proof of effective public access: membership/password plugins, settings and operator intent still need review. The six draft/pending content records remain withheld. Absence of `private` statuses or comment records does not prove none exist outside this export.

All 122 attachment URL fields are distinct, but original image/PDF/file bytes have not been supplied or verified. Sixteen scanned media ID references resolve to attachment records and 18 are absent from this exported ID set. The selected body-attribute scan finds 68 distinct upload URLs: 40 exactly match attachment URLs and 28 do not. These are referential checks, **not missing-file findings**: resized derivatives, CSS/shortcode references, deleted/unexported records and the actual uploads directory require reconciliation.

Known markers include Divi shortcodes in 28 items, Gravity Form shortcodes in four, a PDF-viewer shortcode in one and iframe markup in four; Divi/Yoast metadata appears in 81/38 items. These indicate conversion work, not installed versions or active settings. Fourteen events have local/UTC date-pair fields with valid calendar shapes and a timezone field. Timezone shapes are three runtime-recognized zones/aliases, eleven WordPress fixed offsets and one missing field. Eleven published-status events need date/timezone review; fixed offsets must not silently become a guessed DST-aware zone. Nineteen venue/organizer references resolve within the export.

The separate Gravity Forms JSON has seven form definitions, 97 fields, nine notification definitions and seven confirmations. No entries or add-on feed keys were found. Preserve notification/confirmation text and recipients privately for later form review; do not assume their presence proves email delivery, payment-provider wiring or complete global settings. [Forms and entries are separate exports](https://docs.gravityforms.com/exporting-a-form-from-gravity-forms/); [feeds require separate setup](https://www.gravityforms.com/video/exporting-your-forms/). A full WordPress recovery set still requires both [database and files](https://developer.wordpress.org/advanced-administration/security/backup/), including uploads, themes/plugins and site/provider configuration. Provider access is still pending. No cutover has been performed; existing backup and integration gates remain.

### Run the offline WXR preflight

Keep originals outside the checkout in protected storage. From the repository root:

```sh
direnv allow web
direnv exec web bun web/tools/wxr-preflight.ts < /protected/terrace/wordpress.xml
direnv exec web bun test web/tests/wxr-preflight.test.ts
```

The CLI accepts standard input only and emits one aggregate JSON report. It reads no file path from the XML, follows no links, makes no network requests and writes no CMS data or redirects. Titles, bodies, authors, passwords, metadata values, arbitrary post types/statuses, unknown hostnames and private URI paths/queries never leave the input. Only fixed allowlisted type/status/plugin labels and known public Terrace origins can appear; unknown values become counts or `other`. Errors are fixed text with no parser excerpt and no partial report. Originals and full generated reports are omitted from Git; only safe aggregate evidence is documented here.

The UTF-8 input limit is 16 MiB, with at most 10,000 items, 100,000 element nodes, depth 32, 64 attributes per element and 16 KiB per XML tag. A pinned strict parser validates syntax after bounded lexical checks; DTD/entity declarations, undefined entities, processing instructions other than the XML declaration, malformed namespaces and unsupported WXR shapes are rejected. Predefined/numeric XML character references and literal declarations inside CDATA remain data. Supported WXR namespaces/versions are 1.1 and 1.2. Duplicate recognized scalar/metadata fields are rejected rather than silently overwritten. This profile does not claim to support every plugin's multivalue metadata shape.

Media checks cover `_thumbnail_id`, `wp-image-*`/`attachment_*` IDs and selected quoted `src`, `href`, `poster` and simple `srcset` attributes. They are not a complete CSS/shortcode/JavaScript/media census. Ambiguous srcset candidates are counted for review, not declared missing files. No local/remote file bytes or checksums are verified. Event timezone/date classifications are preflight flags, not conversions. Unknown plugin shapes require private inspection of the preserved source.

### Import and redirect gates

| Source | Next reviewed mapping/gate |
| --- | --- |
| Published-status posts/pages | Preserve source ID, original URI, status/date, author attribution, text/layout and media relationships in a protected ledger. Prove effective access first. Build draft-only, idempotent import/reconciliation before approving any publication; do not guess a post is a newsletter without its issue/PDF evidence. |
| Draft/pending/private/password content | Keep withheld and restrict staff access. Preserve its original status/password/access evidence for private review; never turn it into a public redirect or infer permission from a slug. |
| Events | Preserve local and UTC fields, original timezone/all-day evidence, venue/organizer IDs and source URI. Resolve fixed offsets/DST and missing fields, compare rendered times and retain expired-event URLs. No date or venue guesses. |
| Attachments and layout records | Obtain a verified uploads/files copy; reconcile originals, derivatives, hashes, alt/credit/caption, parent/use relationships and effective visibility. Preserve Divi/CSS/global-style/project records until reviewed mappings and visual parity exist. Never execute legacy embeds/scripts. |
| WordPress authors | Preserve attribution privately; no automatic Keycloak accounts, roles, membership approvals or contact-directory consent. |
| Source URIs | Build a private source-ID → original-URI → target ledger. Validate canonical host, duplicate IDs/URIs/path collisions, query-dependent routes and private/public scope. Approve only public aliases, test exact redirect behavior and keep WordPress/rollback until every record and asset is accounted for. Never drop a query string to force a path-only mapping. |
| Gravity Forms | Rebuild only approved form definitions/integrations after private settings review and sandbox tests. Historical entries stay outside import scope. No notifications, charges or provider actions are performed by preflight. |

### Inventory form definitions offline

Once an authorized operator supplies a [Gravity Forms **Export Forms** JSON file](https://docs.gravityforms.com/exporting-a-form-from-gravity-forms/), keep the original in protected storage outside the checkout. The export may contain notification recipients, default values and add-on settings. From the repository root, run:

```sh
direnv allow web
direnv exec web bun web/tools/gravity-forms-inventory.ts < /protected/terrace/forms.json
```

The command reads standard input and writes one JSON report. It accepts a single form object (also available from [`wp gf form get <id>`](https://docs.gravityforms.com/managing-forms-wp-cli/)), an array or a numeric-keyed collection with optional export version. Forms and fields must have positive numeric source IDs. The limit is 8 MiB. An unsupported input returns a nonzero status and an empty report stream. Use the form-definition export, not **Export Entries**, SQL or a list of form summaries.

Match forms and fields to the private source by ID. The report preserves field order, nested fields, known types and required flags, whether conditional logic is omitted, absent or configured, plus counts of configured choice options, compound inputs and conditional rules. It counts notification and confirmation definitions per form; `null` means the export omitted that information. Unknown field types become `other` and need private review. Labels, choices, rule contents, recipients, free text, settings and submissions are excluded. Configured logic is not evaluated; its presence does not prove it will run. A payment field alone cannot identify an active processor. The report covers only the supplied forms. Use the preserved original for exact configuration, and reconcile plugin tables, entry totals, active feeds and inactive or trashed forms separately under approved access.

## Migration mapping

| Source | Preserve in Payload / destination | Notes |
|---|---|---|
| WordPress pages and posts | Source ID, slug, title, publication status/date, excerpt, body, featured media, authors, categories/tags, SEO metadata; preserve redirects | Convert layouts to structured blocks where practical; sanitize reviewed legacy HTML and preserve difficult embeds with an explicit fallback. Keep newsletter issue date and PDF/document association. |
| Media and newsletter files | Original name, caption/alt text, MIME type, source ID, relationships and public/private status | Copy underlying PDF/image assets and validate checksums/links. FlowPaper is a reader presentation layer; retain PDF source, not the runtime by default. |
| Events / venue / organizer | Stable source IDs, title/slug/body, start/end with timezone and all-day status, category, venue/address, organizer/public contact, image and RSVP/ticket link | Reconcile calendar embeds, external feeds, expired and private records before migration. Do not infer events from venue records. |
| Menus | Week start/date and PDF; daily date/theme; ordered food items, course, description/tags/images; weekly beers, brewery/style/ABV and serving form | Google Drive assets were observed on `/menus/`; confirm document ownership, access and replacement URL policy. Legacy Wagtail menu models are historical design clues, not proof of WordPress parity. |
| Projects / archive pages | Project title/body, taxonomy, media and source URL; preserve shows/archive, announcements and informational page URLs | Member-only boundaries must be checked before publication. |
| Forms | Approved form schema (field name/type/label/required/options/conditional rules/limits), consent/confirmation text, notification intent and payment-provider mapping | Future submissions need dedicated staff-only records. Historical entries are excluded from this migration. Never store raw card data. |

The earlier Wagtail repository contains intended event fields (name, start/end, rich description, links, image/media), blog fields (date, intro/body, tags/categories, gallery), weekly/daily menus and generic email forms. These are legacy models only, not current WordPress evidence.

## Forms and payment design gates

Use Payload for non-payment forms only through dedicated submission collections or its Form Builder. Anonymous access should be limited to a specific submission endpoint; editorial collections remain staff-controlled. Validate field allowlists, length/options/email/URL server-side; escape output; rate-limit; use origin/CSRF checks as applicable, honeypot and proportionate spam checks, idempotency to prevent duplicate notifications, and retryable email delivery that does not log full submissions. Set conservative request/upload limits at the edge and app; verify extension, MIME and file signature, scan files, randomize storage names, and keep submissions private until editorial approval. The public 128 MB label is not a migration target.

Donation and merchandise checkout must use hosted checkout or provider-tokenized payment fields; compute prices server-side and verify signed webhooks. Store provider transaction IDs, status and receipt fields only. Confirm actual provider setup before selecting the replacement. Keep the existing official donation link until replacement transactions pass provider sandbox and reconciliation checks.

## Private member/alumni community status

The local pilot now has per-user Keycloak sign-in, separate member/editorial roles, server-side sessions, opt-in profiles/mentorship, group-gated stories and an administrator-only story-report queue. See the current [member interface](../web/docs/community.md), [CMS boundaries](../cms/COMMUNITY.md), [editorial SSO/reporting checks](../cms/README.md) and [identity setup](../identity/README.md) for implemented behavior, reproducible checks and limits.

This is not a production deployment or permission to invite real people. Real roster approval/offboarding, reviewer ownership/retention, export/erasure, production TLS/database configuration and verified offsite recovery remain gates. WordPress author records do not satisfy those gates. Keep public publication separate from private community content. Hosting must follow the current Womb plan and the approved total below US$80/month including backups, tax and temporary overlap; the earlier $20 estimate is obsolete. Optional calls/video remain deferred.

## Backlog acceptance criteria

Existing `Terrace revival` milestone work items already cover the full inventory (#3), repeatable migration (#4), cutover parity (#5), and community pilot (#6); do not create duplicates. Tighten #4/#5 with form-specific acceptance:

1. Export and review the active form definitions with field IDs/types/required/options/conditions, confirmations, notification purpose, upload rules and provider mapping; reconcile these against the public field inventory above.
2. Decide which forms remain active. Implement only approved non-payment forms with anonymous-create/staff-read boundaries, validation, spam/rate controls, safe uploads and duplicate-safe notifications.
3. Exercise card/PayPal donations and merchandise only in provider sandbox; prove server-calculated totals, webhook signature checks, idempotent retries and no card data in CMS/logs.
4. Exclude historical Gravity Forms entries from the current migration; keep source/archive retention separate from import. Reconcile future imported content/media by stable source IDs and checksums; verify representative pages/PDFs, redirects and unpublished/private access.
5. Preserve WordPress rollback until editorial review, integration signoff, backup/restore and final content-delta reconciliation pass.

## Primary references

- [WordPress REST API reference](https://developer.wordpress.org/rest-api/reference/)
- [The Events Calendar REST endpoints](https://docs.theeventscalendar.com/rest-endpoints/)
- [Gravity Forms REST API v2](https://docs.gravityforms.com/rest-api-v2/) and [upload security](https://docs.gravityforms.com/file-upload-security/)
- [Payload Form Builder](https://payloadcms.com/docs/plugins/form-builder), [collection access control](https://payloadcms.com/docs/access-control/collections), and [uploads](https://payloadcms.com/docs/upload/overview)
