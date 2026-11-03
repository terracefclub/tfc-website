# WordPress parity and content migration plan

**Evidence date:** 2026-10-28. This plan separates observed public WordPress behavior from admin-only facts. It is planning work only: it does not import content, accept form submissions, or implement member access.

## Publicly verified source inventory

A read-only audit of [princetonterraceclub.org](https://princetonterraceclub.org/) and its unauthenticated REST API found 22 public pages and 53 posts; `wp/v2` exposes pages, posts, media, projects, venues, organizers, events, and calendar embed types. The site exposes API namespaces for Gravity Forms (`gf/v2`), The Events Calendar (`tribe/events/v1`, `tribe/views/v2`, `tec/v1`), Akismet, Divi, Yoast, Google Site Kit, and CSV user import. Public page source loaded Divi, Gravity Forms, Gravity Forms Stripe on donations, FlowPaper, recurring-donation, Snazzy Maps, Google Drive integration on menus, Akismet, and Divi Blog Extras assets. Asset/namespace presence does not prove plugin settings, versions, or operational integrations.

Public pages include about, join, membership, dues, financial aid, reporting, contact, donate, newsletter archive/submissions, merchandise, menus, shows archive, announcements, and member/archive pages. Public post inventory includes dated newsletters and club stories. The public The Events Calendar query returned no events on audit date despite exposed event/venue/organizer types, so calendar source and historical/expired data must be checked through an authorized export. The public `tribe_events` type also returned zero records.

### Visible forms and fields

- **Contact:** name, email, class year, phone, inquiry reason, message, optional website/link and file. Page displayed a 128 MB file limit; actual server enforcement is unverified.
- **Newsletter contribution:** first/last name, class year, email, story text, optional website/link and photo (page lists jpg/jpeg/png/gif). Editorial approval before publication is a required migration boundary.
- **Donation:** name, class year, email, phone, address, first-time donor, fund designation (Financial Aid/PPF), amount/other amount, recurring choice, card/PayPal method, dedication details, employer matching. Stripe assets were present. Active processors, account ownership, recurring billing and webhook settings are unknown.
- **Merchandise:** name, email, sweatshirt quantity/size, pickup/mail choice, shipping/address and total. Inventory, payment and fulfillment are unverified.

Do not migrate payment credentials or historical submissions without explicit retention/privacy review. Full field definitions, conditional rules, notification recipients, entries, private pages and custom-field schemas require authorized WordPress export/admin access. Public REST output is not a complete database or plugin inventory.

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
| Forms | Approved form schema (field name/type/label/required/options/conditional rules/limits), consent/confirmation text, notification intent and payment-provider mapping | Keep form submissions in dedicated staff-only records. Historical entries are excluded until retention and consent are approved. Never store raw card data. |

The earlier Wagtail repository contains intended event fields (name, start/end, rich description, links, image/media), blog fields (date, intro/body, tags/categories, gallery), weekly/daily menus and generic email forms. These are legacy models only, not current WordPress evidence.

## Forms and payment design gates

Use Payload for non-payment forms only through dedicated submission collections or its Form Builder. Anonymous access should be limited to a specific submission endpoint; editorial collections remain staff-controlled. Validate field allowlists, length/options/email/URL server-side; escape output; rate-limit; use origin/CSRF checks as applicable, honeypot and proportionate spam checks, idempotency to prevent duplicate notifications, and retryable email delivery that does not log full submissions. Set conservative request/upload limits at the edge and app; verify extension, MIME and file signature, scan files, randomize storage names, and keep submissions private until editorial approval. The public 128 MB label is not a migration target.

Donation and merchandise checkout must use hosted checkout or provider-tokenized payment fields; compute prices server-side and verify signed webhooks. Store provider transaction IDs, status and receipt fields only. Confirm actual provider setup before selecting the replacement. Keep the existing official donation link until replacement transactions pass provider sandbox and reconciliation checks.

## Private member/alumni community: proposed, not implemented

The public redesign and CMS do **not** currently provide private profiles, group-gated content, member/alumni story spaces, mentorship matching, or impromptu calls. Those are proposed pilot capabilities, not delivered features. This remains a pilot plan (see existing milestone issue #6), not a delivered capability. Proposed gates before a pilot:

- Use Keycloak OIDC with member identity and current-member/alumni groups; authorize every protected page, API, media download and action server-side by membership/group, never by hidden UI alone.
- Define verification, invitation/approval, membership lifecycle, removal, moderation ownership, reporting, export and deletion before onboarding.
- Use secure server-managed sessions, CSRF protection where applicable, bounded idle/absolute lifetime, and verified logout/session revocation; do not put long-lived tokens in browser storage.
- Make profile visibility and mentorship opt-in, with separate consent and audience choices; minimize fields, allow editing/deletion, and prevent open-ended arbitrary profile scripts.
- Keep public publishing separate from member submissions and member-only records. Test cross-group and logged-out access boundaries before inviting a pilot.
- Defer impromptu video/calls or virtual clubhouse infrastructure until member demand, moderation and the ~$20/month hosting/backups budget are validated.

No OIDC client, membership groups, session handling, or private community feature is claimed to exist in the current site/CMS.

## Backlog acceptance criteria

Existing `Terrace revival` milestone work items already cover the full inventory (#3), repeatable migration (#4), cutover parity (#5), and community pilot (#6); do not create duplicates. Tighten #4/#5 with form-specific acceptance:

1. Export and review the active form definitions with field IDs/types/required/options/conditions, confirmations, notification purpose, upload rules and provider mapping; reconcile these against the public field inventory above.
2. Decide which forms remain active. Implement only approved non-payment forms with anonymous-create/staff-read boundaries, validation, spam/rate controls, safe uploads and duplicate-safe notifications.
3. Exercise card/PayPal donations and merchandise only in provider sandbox; prove server-calculated totals, webhook signature checks, idempotent retries and no card data in CMS/logs.
4. Do not migrate old entries until consent, retention, access, and deletion rules are signed off. Reconcile imported content/media by stable source IDs and checksums; verify representative pages/PDFs, redirects and unpublished/private access.
5. Preserve WordPress rollback until editorial review, integration signoff, backup/restore and final content-delta reconciliation pass.

## Primary references

- [WordPress REST API reference](https://developer.wordpress.org/rest-api/reference/)
- [The Events Calendar REST endpoints](https://docs.theeventscalendar.com/rest-endpoints/)
- [Gravity Forms REST API v2](https://docs.gravityforms.com/rest-api-v2/) and [upload security](https://docs.gravityforms.com/file-upload-security/)
- [Payload Form Builder](https://payloadcms.com/docs/plugins/form-builder), [collection access control](https://payloadcms.com/docs/access-control/collections), and [uploads](https://payloadcms.com/docs/upload/overview)
