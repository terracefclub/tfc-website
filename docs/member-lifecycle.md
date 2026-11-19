# Member lifecycle

How a person gets into, and out of, the private Terrace member community. Everything here is
synthetic and local: there is **no mail transport, no external service and no public exposure**.
Owner-decided items are marked **[OWNER]** and are placeholders, not policy.

Principles (owner decisions recorded in the handoff): the community is for current members and
alumni together; every account requires approval; Terrace runs its own Keycloak; drafts and member
data stay private; invalid or unapproved authentication fails closed (401/403).

## Moving parts

| Piece | Where |
| --- | --- |
| Collections (Payload admin group "Member lifecycle" and "Community moderation") | `cms/src/lifecycle/collections.ts` |
| Intake, export and erasure endpoints (`/api/lifecycle/*`) | `cms/src/lifecycle/endpoints.ts` |
| Outbox, tokens, invitations, offboarding, erasure, export, sweep | `cms/src/lifecycle/*.ts` |
| Public pages `/apply/`, `/join/#<token>`; member page `/members/account/` | `web/src/routes/` |
| Spam guard (rate limit, honeypot, signed timing token) | `web/src/lib/server/apply-guard.ts` |
| Realm user tooling (idempotent) | `identity/tools/provision-member.ts` |

## Production configuration

The single list of settings for the member lifecycle and the imported-content frontend. Local values are
generated into the ignored `identity/.state/app.env` by the identity bootstrap; never print or commit them. In
production supply them through protected service credentials or an external owner-only environment file, never
in the bundle or on a command line.

The CMS refuses to start in a public deployment (`CMS_PUBLIC_DEPLOYMENT=1`) when its settings below are
invalid (`cms/src/runtime-policy.ts`, covered by `cms/test/runtime-policy.test.ts`). The website never refuses
to start for these; at startup it logs one `[config]` line per missing setting (names only, never values;
`web/src/lib/server/production-config.ts`) and the affected feature fails closed, as the last column says.

**CMS** (`bin/start`, `bin/migrate` and the housekeeping sweep need the same CMS values; the sweep also needs
the outbox settings):

| Variable | Purpose | When unset or invalid |
| --- | --- | --- |
| `CMS_PUBLIC_DEPLOYMENT=1` | Turns on the production validation of everything below. | Only the loopback trial profile is accepted. |
| `CMS_ORIGIN` | The CMS's canonical public HTTPS origin. | Public CMS refuses to start. |
| `DATABASE_URI`, `PAYLOAD_SECRET`, `CMS_MEDIA_DIR` | PostgreSQL connection, the Payload secret (32+ characters) and the absolute uploads directory outside the release. | Public CMS refuses to start (or cannot connect). |
| `CMS_AUTH_*` (`ISSUER`, `CLIENT_ID`, `CLIENT_SECRET`, `AUDIENCE`, `INTROSPECTION_CLIENT_ID`, `INTROSPECTION_SECRET`) and `MEMBER_AUTH_*` (`ISSUER`, `CLIENT_ID`, `AUDIENCE`, `INTROSPECTION_CLIENT_ID`, `INTROSPECTION_SECRET`) | Editorial and member sign-in; exact values in `cms/README.md`. | Public CMS refuses to start. |
| `LIFECYCLE_OUTBOX_DIR` | Absolute directory outside the code and media directories for the outbox file mirror (invitation links exist only there). It is forced to mode 0700 and its files to 0600, so **the CMS and the sweep must run as the same account**. | Public CMS refuses to start. Elsewhere approving an application fails with 503 and rolls back. |
| `LIFECYCLE_PUBLIC_ORIGIN` | Bare public `https` origin used in invitation links: no path, credentials, IP address, single-label or private-network host (`.local`, `.internal`, `.lan`, ...). No default in production; only the local profile (`CMS_LOCAL_BOOTSTRAP=1` without `NODE_ENV=production`) falls back to `http://127.0.0.1:4194` and may use a loopback origin. | Public CMS refuses to start. Elsewhere approval fails with 503. |
| `LIFECYCLE_INTAKE_SECRET` | Shared website-to-CMS secret for apply/redeem (32+ characters; the same value on the website). | The endpoints answer 503 and `/apply/` and `/join/` show "not open". |
| `LIFECYCLE_APPLICATION_DAYS`, `LIFECYCLE_INVITATION_DAYS`, `LIFECYCLE_GRACE_DAYS` (optional) | Retention placeholders: 60, 7 and 30 days. **[OWNER]** | The defaults apply. |

**Website:**

| Variable | Purpose | When unset or invalid |
| --- | --- | --- |
| `ORIGIN` | Canonical origin of the website (HTTPS, or HTTP on 127.0.0.1); equals `MEMBER_AUTH_ORIGIN` when member sign-in is configured. | Form and callback origin checks fail. |
| `CMS_ORIGIN` | Trusted server-to-server origin of the CMS (content, redirects, lifecycle calls). | Sample content; a `[config]` line is logged. |
| `CMS_PUBLIC_ORIGIN` | Public HTTPS origin that serves `/api/media/file/...`; the only origin imported body images and the news/pages CSP may use. | Every image in imported bodies is dropped and the CSP names no media origin; a `[config]` line is logged. |
| `MEMBER_AUTH_ISSUER`, `MEMBER_AUTH_CLIENT_ID`, `MEMBER_AUTH_CLIENT_SECRET`, `MEMBER_AUTH_ORIGIN` | Member sign-in (`web/README.md`). | The member space is unavailable. |
| `LIFECYCLE_INTAKE_SECRET` | Same value as the CMS. | `/apply/` and `/join/` show "not open"; a `[config]` line is logged. |
| `ADDRESS_HEADER` (with `XFF_DEPTH` when it is `X-Forwarded-For`) **or** `LIFECYCLE_DIRECT_CLIENTS=1` | The header your proxy overwrites with the real client address, so the `/apply/` rate limit sees visitors rather than the proxy; or the statement that no proxy is in front. | `/apply/` stays closed in production; a `[config]` line is logged. |

**Must NOT be set in production:** `CMS_LOCAL_BOOTSTRAP` and every `CMS_BOOTSTRAP_*` variable (the public CMS
refuses to start if any is present), and `NODE_ENV` other than `production` for the website.

## 1. Apply

A visitor opens `/apply/` and gives a name, whether they are a current member or alumnus/alumna, an
optional class year, a contact email and an optional note (1000 characters). That is all that is
stored: no IP address, user agent or timing. The form is protected by a hidden honeypot field, a signed
start-time token (submissions faster than 3 seconds or older than 30 minutes are rejected; the token is
bound to the client address and cannot be replayed once a submission is accepted), and an
in-memory rate limit (5 per client and 60 overall per hour; only a salted hash of the client address
is held, for the window). A tripped honeypot looks like success; a repeat of a pending email looks
identical to a first submission so the form cannot be used to learn who applied. The CMS caps pending
applications at 500, withdraws pending ones nobody reviewed within `LIFECYCLE_APPLICATION_DAYS`, and adds a
`staff-notice` to the outbox (at most one a day, enforced by a unique key; if the mirror directory cannot be
written the row is still recorded and the application is still accepted) when the queue passes 400 so reviewers see it filling.

**Deploy requirement.** The rate limit uses the address SvelteKit's adapter-node reports. Behind a reverse
proxy that is the proxy's address unless the website runs with `ADDRESS_HEADER=X-Forwarded-For` and
`XFF_DEPTH` set to the number of trusted proxies (for example `1`). The application never reads
forwarded headers itself, so a client-supplied `X-Forwarded-For` cannot choose its own bucket. In production
the form refuses to open until `ADDRESS_HEADER` is set (or `LIFECYCLE_DIRECT_CLIENTS=1` says the server faces
clients directly). Add these to the production environment for the website. `ADDRESS_HEADER` must name a header that **your
proxy overwrites** with the real client address (so a client cannot supply its own); with `X-Forwarded-For`,
set `XFF_DEPTH` to the number of trusted proxies appending to it. A visitor whose address changes between
opening and sending the form within the same /24 (IPv4) or /64 (IPv6) is unaffected; one who moves networks
is asked to reload and resubmit.

The website calls `POST /api/lifecycle/apply` with `X-Terrace-Intake`. Applications can be created no
other way: the collection has no create access, even for staff.

## 2. Approve or deny

In the Payload admin, an editor or administrator opens **Member applications**, chooses the role to
grant (`current-member` or `alumni`, which may differ from what the applicant claimed) and sets the
status to `approved` or `denied` (optionally a decision note). The server records the reviewer and
`decidedAt`, and the decision is final. **Approving never creates a sign-in account.** It issues an
invitation (next section). Denying appends a denial notice to the outbox. `withdrawn` is for an
applicant who asks to cancel.

**[OWNER]** approval policy wording, who the approvers are, whether editors may approve or only
administrators, and the verification the club expects before approving.

## 3. Invitation and outbox

Approval creates a **member-invitations** record: role, expiry, status (`pending`, `redeemed`,
`expired`, `revoked`) and the SHA-256 of a 256-bit random token. The plaintext token is never stored
and is not readable through the API.

Every outgoing message (invitation, denial, offboarding notice, erasure confirmation) is appended to
**message-outbox**. Outbox rows are append-only (no deletes, only the status may change), readable by
administrators, and **never contain links or tokens**. An invitation message carries a real foreign key to its invitation (`message_outbox.invitation_id`, set when it is enqueued), which the admin outbox list and erasure use; rows written before the key existed are matched by the older email-and-nearest-time heuristic. In local preview the same message is also written
to `LIFECYCLE_OUTBOX_DIR/<id>-<kind>.json`; the invitation file is the only place the one-time link
exists. There is no SMTP. **[OWNER]** how messages are actually delivered. Until decided, an operator
reads the mirror file and passes the link to the applicant.

## 4. Redeem and create the sign-in account

The invitation link is `/join/#<token>`. The token sits in the URL **fragment**, which browsers never send to
the server, so it stays out of access logs, proxies and referrers; the page reads it in the browser, removes
it from the address bar and posts it in a request body when the applicant presses **Accept invitation**
(without script there is a field to paste it). Opening the page, as a link scanner does, uses nothing up.
Redemption consumes the token exactly once. Unknown, malformed, expired, revoked and already-used tokens
all look the same. The page sends `Referrer-Policy: no-referrer` and is never cached or indexed.

Redeeming does not create the Keycloak user and does not weaken the approval gate: a signed-in
account still needs a realm role. The operator creates it, repeatably:

```sh
# Keycloak realm user for the local synthetic realm (loopback only; the admin password is read
# from the protected identity/.state/credentials.json and never printed)
# the email is read from the APPROVED application (id from the admin URL) in the local CMS database, never typed
cd cms && direnv exec . tools/with-local env KEYCLOAK_HTTP_PORT=8186 bun ../identity/tools/provision-member.ts provision \
  --username verify.alumna --application 123 --name "Verify Alumna" --role alumni
```

* **The email is taken from the approved application**: `--application ID` is required, the script reads that application's contact email (status must be `approved`; `psql` and `DATABASE_URI`, so run it through `cms/tools/with-local`) and a typed `--email` is only accepted if it equals it. That address is what binds the person's first sign-in to their application and invitation (next subsection). The script marks it verified.
* A new user gets a temporary password (change forced at first sign-in), written to
  `identity/.state/provisioned/<username>.txt` (mode 0600), never printed. Deliver it privately.
* Running it again for an existing user keeps their credentials, re-enables the account and sets
  exactly the granted role (the other member role is removed).
* The script refuses anything but the loopback local realm. For a production realm an operator uses
  the Keycloak admin console following the same steps; **[OWNER]** production enrollment, verified
  contact ownership and password delivery are still open.

### Linking the person to their application and invitation (automatic)

Erasure and export find a person's application, invitation and messages through links to their member record, so the link is made **by
the system at first sign-in, not by hand**. Redeeming a link (above) and signing in are separate events: the browser that redeems has no
identity yet, and the member row is created later, from the verified Keycloak token. They are bound like this:

1. The operator creates the realm user for exactly one applicant with `provision-member.ts --application <id>` (the address is the approved application's contact email).
   Registration is off, addresses are unique in the realm (`duplicateEmailsAllowed: false`), usernames are fixed (`editUsernameAllowed: false`), and the local
   bootstrap makes the `email` profile attribute administrator-edit-only. The production realm has `verifyEmail: true`, so an address a member changes becomes unverified and the CMS ignores it; keep the
   `email` attribute administrator-edit-only there too. The member browser client (`terrace-web`) releases the `email` scope, so the access token carries `email` and
   `email_verified` (the provisioning script sets it verified). The editorial client does not release it.
2. On every authenticated request the CMS reads the **verified** address from the signature-checked, introspected token (never from anything the browser sent), and in one conditional
   statement links every invitation that is **redeemed** (someone holding the one-time link accepted it), whose application is **approved**, whose application
   contact email equals that address (case-insensitively) and whose `member` link is **still empty**, together with its application (`cms/src/lifecycle/linking.ts`).
   It runs right after the member row is created, and afterwards only when one cheap query finds a redeemed, unlinked invitation for that address (so an ordinary request costs one read); a person who signs in before accepting the link is therefore bound at their next request after redeeming. The bind locks the member row and re-checks its status (erasure takes the same lock first, so a sign-in can never bind after an erasure), then locks the candidate applications and invitations in id order, so concurrent first sign-ins queue instead of deadlocking.
3. A link, once set, is never overwritten: a second person presenting the same address binds nothing, and neither does an unverified or missing address, a pending, expired or
   revoked invitation, or an application with a different address. An administrator's manual link is never replaced either. The address itself is not stored on the member (members have no email on file).

*What stops one person claiming another's application:* the address must come from a token the realm vouches for and only an operator can set it on a realm user;
the invitation must already be redeemed; and each row can be bound once. A person would need a realm account carrying the other person's address **and** to sign in before
that person does. Operators must not create a second realm user with someone else's address (the realm refuses duplicates). If the realm's token has no `email` (an older realm that was not
re-applied: re-run the identity bootstrap), nothing is bound automatically.

**No automatic matching beyond the address.** There is no name-based or other guessing: a person who shares or chose an applicant's name must never be bound to that application. If a person's token carries no verified email (an older realm), or the address did not match, the application stays unlinked. `lifecycle:sweep` only **reports** `unlinkedRedeemedApplications`, a count with no names or emails, of approved applications whose invitation was redeemed but that no member is linked to; an administrator links each through the **member** picker (next section) after checking who the person is. Two applications sharing one address both bind to the first member who signs in with it.

**What the session holds.** Because the member client now releases `email`, the access token the website keeps in the member's server-side session contains their email address. The CMS reads it only to bind and never stores it; nothing else in the website or CMS persists or logs it.

### Existing realm: operator checklist

A realm import is create-only, so a realm created before this change needs these by hand (Keycloak admin console or the identity bootstrap; the production realm artifact from `identity/tools/production-realm.ts` already has them and `identity-policy` CI asserts them):

1. Add the built-in `email` scope as a **default client scope on `terrace-web` only** (not on `terrace-cms`).
2. Realm settings: `editUsernameAllowed: false`, `duplicateEmailsAllowed: false`, `verifyEmail: true` (production).
3. User profile: make the `email` attribute **editable by administrators only** (permissions `edit: [admin]`).
4. For every provisioned user, the email equals the application's contact email and is verified.

Provisioning a user with a mistyped email binds that user to whoever applied with that address, which is why the tool reads it from the application. Plus-addressing and dot variants (`a+x@`, `a.b@` against `ab@`) do not match: those people fall back to the manual picker.

## 5. Offboard

An administrator opens **Member offboardings**, presses **Create new** and chooses the member **by name** in the **Member** picker (type to search), adds a reason and an optional notice
email, and saves. The member cannot be changed afterwards. The picker works because administrators (not editors) may list and search members: they get the display name and
the status only; `identityKey`, `issuer`, `subject`, roles and the status timestamp stay hidden and unqueryable, nothing can be created, changed or deleted through the members API, and members still read only their own row. The same picker is on the
**Member** link of an application and an invitation and on an erasure **Data request**. (Editors do not need it: they cannot offboard, erase or link.) Nothing needs the REST API or a guessed id.
On creation:

1. The member row is marked `offboarded`. The CMS authentication strategy and `isMember` then refuse
   them (401/403) **even if the realm still lets them sign in**.
2. Everything they own is hidden but kept: profile and directory entry, stories, founded groups,
   mentorship offer and mentorship requests (sent and received).
3. An offboarding notice is appended to the outbox.

Then the operator closes the realm side:

```sh
KEYCLOAK_HTTP_PORT=8186 direnv exec identity bun identity/tools/provision-member.ts offboard --username verify.alumna
```

This removes member roles, disables the account and ends live sessions. It is safe to repeat.

Offboarding and moderation hide content for two **independent** reasons (`offboardHiddenAt`,
`moderationHiddenAt`). Content is visible only when neither is set, so restoring a member never reveals
something a moderator hid, and dismissing a report never reveals an offboarded member's content. A
conversation with another offboarded member stays hidden until both are restored.

**Grace period.** The record carries `graceEndsAt` (`LIFECYCLE_GRACE_DAYS`, default 30, **[OWNER]**).
Within it, setting the state to `restored` re-activates the member and clears only the offboarding reason; then re-run `provision` for the realm. After it, restore
is refused. Nothing is deleted automatically; see Erase.

## 6. Moderation

Members can report a **story**, a **group** (including group posts, which are stories shared with a
group) and a **mentorship message** from the member pages. Only the target type, id and reason are
accepted from the browser; the server checks the reporter can read the target, refuses reports on your
own content and duplicates, and snapshots the content so it survives edits. Reports are readable only by
editors and administrators, and the reporter's identity is not exposed to editors.

In **Moderation reports**, an editor or administrator sets the status: `hidden` removes the content from
every member view (including the author's) but keeps it; `dismissed` (from `hidden`) restores it;
`resolved` records review with no visibility change. The resolver and time are recorded when the status
changes, not on later edits. A hidden group also stops opening its stories to members, though an author keeps their own group story after
leaving the group (intended) unless the group is hidden, and authors cannot
delete their own content while it is hidden, so evidence is kept. Members may file at most 20 reports an hour. The 100-group membership limit counts hidden groups too.
The older `story-reports` collection remains for existing data but the website no longer writes to it.

**[OWNER]** moderation owner and backup, response targets, appeal process.

## 7. Export

On **My data** (`/members/account/`) a signed-in member can download a JSON file of **their own** records:
profile, mentorship offer, stories, founded groups, group memberships, mentorship requests they sent,
replies they gave, and any application or invitation linked to them. It is built on the server, filtered
by their member id (not merely by access rules), streamed back over the authenticated session with
`Cache-Control: no-store`, and **never emailed or stored**. It includes content a moderator hid (flagged `hiddenByModeration`), and excludes identity fields and other
people's writing. Each list is capped at 2000 records; a longer list is cut and named in `truncated` rather
than silently shortened. At most 5 exports an hour; the POST also checks its `Origin` header. The CMS records only that an export happened (an audit row without content).

## 8. Erase

* **Member-initiated, two steps.** *Start erasure* issues a single-use 15-minute confirmation code (only its
  hash is stored); the member then types "erase my data" to confirm. Nothing changes before step two.
  Step two runs in **one database transaction** that also claims the code: if anything fails, everything
  rolls back, nothing is erased and the code still works. On success the session ends.
* **Administrator-initiated.** Only for a member who is already offboarded: create a **Data requests**
  record of kind `erasure`.

Policy applied by `cms/src/lifecycle/erasure.ts`: deleted are the profile, mentorship offer, group
memberships and authored stories. Anonymised in place (so other people's conversations stay coherent) are
mentorship requests sent or received and the founder name on groups they founded. **[OWNER]** The group
name and description a founder wrote are *retained* verbatim (the group belongs to its other members too);
decide whether an erased founder's group text should be removed, handed over or kept. Scrubbed: moderation
snapshots, reporter text and resolution notes about their content; reports they filed (detail, snapshot and
staff note); reports of mentorship requests addressed to them; legacy story reports about their stories; the
offboarding reason and notice address; and applications, decision notes and outbox recipients as follows.

*How applications and outbox rows are found.* Only through links: applications linked to the member (member
link, or through an invitation linked to them; sign-in sets both automatically, see section 4), plus **unlinked** applications with the same contact email as
one of those. The offboarding notice address is free text and is **never** a match key. Outbox rows to those
emails, to `Member #id`, or announcing one of those invitations (`invitation_id`), have only their recipient columns redacted (rows stay). The counts matched are
returned (member erasure) so the blast radius is visible. **Email-reuse caveat:** if two different people
share one contact address (a family address, a club mailbox), erasing one also anonymises other unlinked
applications and outbox rows to that address; check before erasing. An application that was
never linked (the person never signed in, or the realm token carried no verified email or it did not match an application) is the one case left to an administrator:
set the **member** picker on it before erasing. An unlinked, never-invited application with a different email cannot be tied to a person.

*Files.* The database erasure commits first; local mirror files are rewritten only after the commit (a
rolled-back erasure never touches them). If that file step fails, the erasure stands, the response says
`mirror: pending` and `lifecycle:sweep` completes it (it is idempotent). An administrator-initiated erasure runs
inside the admin save, so it cannot redact mirror files or write its confirmation file itself: **run
`lifecycle:sweep` after every administrator-initiated erasure** (the Data requests admin page says so too). The
confirmation file is written once and marked (`mirrored_at`, set only after the file is confirmed written), so a copy an operator deletes is not recreated; a write that fails leaves the row unmarked and the next sweep retries it, reporting the count as `mirror.failed`. Files are written atomically (private temporary file, sync, rename). The sweep retries every outbox row that has no file copy: it rebuilds denial, offboarding, staff and confirmation files from the database, but never an invitation, whose link exists only in its file (only a hash of the token is stored). An invitation without a file that could still be redeemed is listed as `mirror.undeliverable` and shown as "Undeliverable" in the admin outbox list: reissue the invitation. Staff notices
(`staff-notice`) are recorded even when the directory is unwritable, and the sweep writes their file later. An invitation whose
invitation is already redeemed, revoked or expired is marked settled (nothing is owed), and the sweep removes leftover
`*.tmp` files of crashed writes older than ten minutes. Erasure and offboarding also **revoke any still-pending invitation** for the person,
so its link answers like any dead token.
The member row becomes a tombstone (status
`erased`, no roles, name and OIDC subject wiped) keeping only the one-way identity hash so a still-live
realm account cannot re-enter. A confirmation is appended to the outbox. The operator then runs
`provision-member.ts offboard` for the realm user. **[OWNER]** whether tombstones, moderation records
and audit rows may be retained, and for how long.

## 9. Housekeeping

The sweep ends by itself (it closes the adapter and exits; a 120 s timer bounds a stuck run), so it is safe under a systemd timer: exit code 0, or non-zero when mirror work failed or, with `CMS_PUBLIC_DEPLOYMENT=1`, when `LIFECYCLE_OUTBOX_DIR` is unset. Without that directory the summary says `mirror.skipped: outbox directory not configured` because no file can be redacted or written.

```sh
cd cms && direnv exec . tools/with-local bun run lifecycle:sweep               # expire invitations, report
cd cms && direnv exec . tools/with-local bun run lifecycle:sweep -- --purge-moderated
```

The sweep expires stale invitations, withdraws unreviewed applications, reports `unlinkedRedeemedApplications`, completes any pending mirror
redaction after an erasure, and reports content past its grace period. It deletes
moderation-hidden content only with `--purge-moderated` (in one transaction, memberships and stories of a
purged group first) and blanks the snapshots of reports about what it deleted; offboarded members are never
erased automatically. **[OWNER]** retention periods (including how long reports and their notes are kept)
before a scheduled run is added.

**Scheduling.** The sweep is manual; nothing in this repository runs it on a timer. The release bundles
(`tools/release/`) contain only `bin/start` and, for the CMS, `bin/migrate`: they have no systemd unit, timer or
cron definition and no packaged sweep entrypoint (the sweep is a Bun script and bundles carry no Bun). Recommended:
once a day at a quiet hour (for example 03:30 server time), without `--purge-moderated` until the owner sets retention
periods. Until a packaged entrypoint exists, run it from a source checkout of the deployed revision with the CMS runtime
environment (`DATABASE_URI`, `PAYLOAD_SECRET`, `LIFECYCLE_OUTBOX_DIR` and the rest of the CMS configuration):

```sh
cd /path/to/checkout/cms && bun run lifecycle:sweep   # JSON summary on stdout; a non-zero `mirror.failed` means some files are still pending
```

The platform repository (Womb) must own the timer and its service account (the account must be able to write
`LIFECYCLE_OUTBOX_DIR`); this repository defines no infrastructure. Run it also after every administrator-initiated
erasure, as described under Erase. Follow-up for the release layout: package a `bin/sweep` entrypoint built like
`bin/migrate` so the timer does not need a source checkout.

**Local databases.** A development database that ran the discarded early migration `20261119_014038` (or an
intermediate `021150`) must be reset: roll back or drop it and run `migrate` again; the migration was
regenerated and is not an upgrade of those.

## Permissions summary

| Actor | Can |
| --- | --- |
| Anonymous | Submit `/apply/` (limited); check and redeem a valid link. Everything else: 401/403. |
| Unapproved or offboarded/erased member | Nothing under `/members/` or `/api/lifecycle/*` (401/403). |
| Member | Own export and erasure; report content they can read; read only applications/invitations linked to them. |
| Editor | Review applications; read and resolve reports. Cannot read or search members, identity fields, reporter identity, token hashes, the outbox, or offboard/erase. |
| Administrator | Everything above plus offboarding, erasure of offboarded members, the outbox and linking records to a member; may list and search members by display name and status in the admin pickers (read-only, no identity fields or roles). |

## Verify

```sh
direnv exec web bun run check && direnv exec web bun test
cd cms && direnv exec . bun run check && direnv exec . tools/with-local bun test
direnv exec identity bun test identity/test
```

Local stack end-to-end (see `docs/local-preview.md`): apply at `/apply/`, approve in the CMS admin, read
the link from the outbox mirror, accept it at `/join/#<token>`, then run the provisioning script above.

## Decisions the owner still owes

* Approval policy wording, approver names and fallback approvers; real roster of members and alumni.
* How invitations and notices are delivered (no mail transport exists); production invitation delivery
  and first-password handling in Keycloak.
* Invitation lifetime, offboarding grace period and the retention periods for moderation content,
  reports, tombstones, the outbox and audit rows (all current numbers are placeholders).
* Moderation owner and backup, appeal process, who may approve (editors or only administrators).
* Whether alumni and current members need different approval evidence.
