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
| Bulk roster onboarding (opt-in operator tool) | `cms/tools/roster-invite.ts`, `cms/src/lifecycle/roster.ts` |

## Production configuration

The single list of settings for the member lifecycle and the imported-content frontend. Local values are
generated into the ignored `identity/.state/app.env` by the identity bootstrap; never print or commit them. In
production supply them through protected service credentials or an external owner-only environment file, never
in the bundle or on a command line.

The CMS refuses to start in a public deployment (`CMS_PUBLIC_DEPLOYMENT=1`) when its settings below are
invalid (`cms/src/runtime-policy.ts`, covered by `cms/test/runtime-policy.test.ts`). The website never refuses
to start for these; at startup it logs one `[config]` line per missing setting (names only, never values;
`web/src/lib/server/production-config.ts`) and the affected feature fails closed, as the last column says.

**CMS** (`bin/start`, `bin/migrate`, the housekeeping sweep `bin/sweep` and the operator tools `bin/roster-invite` and
`bin/wp-import` need the same CMS values; the sweep and the roster tool also need the outbox settings):

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
status to `approved` or `denied` (optionally a decision note). **Approving needs both fields: set _Status_ to `approved` and choose _Grant Role_.** Saving an approval without a role is refused with "Choose the role to grant before approving." and nothing changes. The server records the reviewer and
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

* **The email is taken from the approved application**: `--application ID` is required, the script reads that application's contact email (status must be `approved`; `psql` and `DATABASE_URI`, so run it through `cms/tools/with-local`; the connection goes to psql through `PG*` environment variables, never argv, and any failure is a fixed message; an erased application, whose status erasure moves to `withdrawn` and whose address is the erased sentinel, is refused, as is an application without a pending or redeemed invitation) and a typed `--email` is only accepted if it equals it. That address is what binds the person's first sign-in to their application and invitation (next subsection). The script marks it verified.
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
   It runs right after the member row is created, and afterwards only when one cheap query finds a redeemed, unlinked invitation for that address (so an ordinary request costs one read, served by the partial indexes `member_invitations_redeemed_unlinked_idx` and `member_applications_approved_email_idx`, verified with `EXPLAIN` on a 20,000-row table); a person who signs in before accepting the link is therefore bound at their next request after redeeming. The bind locks the member row and re-checks its status (erasure takes the same lock first, so a sign-in can never bind after an erasure), then locks the candidate applications and invitations in id order, so concurrent first sign-ins queue instead of deadlocking.
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

**Scheduling.** The CMS release bundle ships the sweep as `bin/sweep` (built like `bin/migrate`; see
`tools/release/README.md`), so a production timer needs no source checkout and no Bun. Run it as the CMS's own
operating-system account with exactly the CMS runtime environment of `bin/start` (`DATABASE_URI`, `PAYLOAD_SECRET`,
`CMS_MEDIA_DIR`, `LIFECYCLE_OUTBOX_DIR`, `LIFECYCLE_PUBLIC_ORIGIN` and the rest of the CMS configuration above):

```sh
/path/to/release/cms/bin/sweep                     # one JSON line of counts; same exit contract as above
/path/to/release/cms/bin/sweep --purge-moderated   # only after the owner sets retention periods
```

Recommended: once a day at a quiet hour (for example 03:30 server time), without `--purge-moderated` until the
owner sets retention periods. The platform repository (Womb) owns the timer and its service account; this
repository defines no infrastructure. Run it also after every administrator-initiated erasure, as described under
Erase. From a source checkout the same housekeeping remains `bun run lifecycle:sweep` (above).

**Local databases.** A development database that ran the discarded early migration `20261119_014038` (or an
intermediate `021150`) must be reset: roll back or drop it and run `migrate` again; the migration was
regenerated and is not an upgrade of those.

## Bulk roster onboarding

**Opt-in and unused by default.** The public `/apply/` form (everyone applies, a reviewer approves) is the only flow the
website uses. For a club that already holds a roster of members and alumni there is an operator tool that turns a CSV
into approved applications and invitations. **[OWNER]** whether to use it at all (everyone-applies versus bulk-invite)
is undecided. Nothing changes if it is never run: the apply form, approval, invitations, linking and erasure behave as before.
(One internal change: the form's "is there a pending application for this address, then create one" step now runs in one transaction under a
per-address lock, which the roster tool shares; the responses are the same.)

The tool never sends anything. There is no mail transport; it writes the same outbox mirror files a UI approval does, and
an operator delivers each link from them.

```sh
# From a source checkout (local development):  cd cms && direnv exec . tools/with-local bun run roster:invite -- ...
# From the CMS release bundle the same tool is bin/roster-invite, with the same arguments (see "Running it on a host" below).
# 1. A dry run reads the file and writes nothing to the database. Terminal output is counts and hashes only.
bun run roster:invite -- dry-run --file ~/.terrace-private/roster.csv --operator admin@example.invalid --report ~/.terrace-private/roster-dry-run.json [--limit 50] [--reinvite-lapsed]
# 2. Review the report (row numbers and reasons), then apply with the planSha256 it printed and the SAME file, operator, limit and flags.
bun run roster:invite -- apply --file ~/.terrace-private/roster.csv --operator admin@example.invalid --plan-sha256 <planSha256> [--limit 50] [--reinvite-lapsed] [--report OUT.json] [--confirm-production]
# 3. Undo a run that nobody has redeemed or been linked to.
bun run roster:invite -- rollback --run <runId> --operator admin@example.invalid [--report OUT.json] [--confirm-production]
```

**Running it on a host.** The CMS release bundle ships the tool as `bin/roster-invite`: the same command line built for Node, like `bin/sweep`
(`tools/release/README.md`, "Operator tools"), so a host needs no Bun and no source checkout. Run it exactly like `bin/sweep`: as the CMS's own
operating-system account, with exactly the CMS runtime environment of `bin/start` (which sets `CMS_PUBLIC_DEPLOYMENT=1`), never `tools/with-local`.
The roster file, its directory and the reports must belong to that account (the private-file rules above), and every path must be absolute:

```sh
/path/to/release/cms/bin/roster-invite dry-run --file /private/dir/roster.csv --operator admin@example.invalid --report /private/dir/roster-dry-run.json
/path/to/release/cms/bin/roster-invite apply --file /private/dir/roster.csv --operator admin@example.invalid --plan-sha256 <planSha256> --confirm-production
```

How that environment reaches the tool is the host's job. On a Womb host the CMS environment is a root-only file rendered by the secret manager, and the
platform provides `terrace-cms-tool roster-invite ARGS...` (root only), which runs `bin/roster-invite` with it as the CMS account; the operator procedure is in
[`docs/website-host.md`](https://github.com/terracefclub/womb/blob/trunk/docs/website-host.md) in the infrastructure repository. It is proven in VM tests only; nothing has been run on a real host. Do not copy or `source` the rendered file by hand.

**CSV format.** UTF-8, comma separated (RFC 4180 quoting), a header row required, at most 1 MiB and 2000 rows. Columns:
`name`, `affiliation` (`current-member` or `alumni`), `class_year` (optional, a four-digit year) and `contact_email`. Cells are trimmed;
no other column is accepted. Row numbers in reports are spreadsheet rows (the header is row 1). The file must be owned by you with mode `0600`
in an owner-only directory **outside every Git checkout** (the same refusals as the importer's private outputs); reports are new `0600` files
there too, and the report path is checked before anything is applied. The file is never copied or stored: the database holds only what an application holds.

**Validation is the apply form's.** A row is valid exactly when `/apply/` would accept it (one shared function,
`cms/src/lifecycle/intake-validation.ts`): name 1 to 120 characters, a well-formed address, affiliation, class year 1904 to 2200. The file adds
three strictnesses of its own: a four-digit class year only, no control characters, and an address that appears more than once in the file rejects
every row that uses it (`duplicate-email-in-file`). Rejected rows are listed in the report with a row number and a reason, never a name or address.

**What `apply` does**, per valid row, in one transaction under the per-address lock: creates the application already `approved` (role granted = the row's
affiliation, reviewer = the operator, decided now), calls `issueInvitation`, the function approval calls (so the invitation, using the invitation lifetime
setting, and its outbox row are what an approval produces), and journals the row. The mirror file, which holds the link, is written **after the commit**, so a
failed row leaves no file. Because these applications are inserted already approved, the status-transition hooks of a UI approval (which run only when a pending
application is updated) do not run; the tool calls the one that matters, `issueInvitation`, itself, and the reviewer and decision time the hook would record are set directly.
A failure before commit rolls the row back and stops the run. A failure writing the file after commit is retried up to three times while the link is still in memory, and the link is dropped from memory after the last attempt either way. If it still fails the run stops
(`failure: mirror-failed`, `failed`) with that one invitation committed, live and without a link file; its outbox id is printed as `undeliverable`, and the sweep and the admin outbox list show it as "Undeliverable". **Recovery without
rolling back the delivered links:** in the admin set that one invitation's status to `revoked`, then reissue it by running the tool on a one-row file for that person (a dry run, then apply with `--reinvite-lapsed`, since a revoked invitation counts as lapsed).
Rolling back the whole run remains possible (a failed run can be rolled back).

**What is skipped on a re-run, and what is not.** Skipped always: an address whose application or invitation is linked to a member, active or offboarded (`member-linked`, whatever the flag), an address with a redeemed or live invitation (`invitation-redeemed`, `invitation-live`), an approved
application (`application-approved`) or a pending one (`application-pending`). Skipped by default, re-invited only with **`--reinvite-lapsed`** (part of the plan hash):
a denied application (`previously-denied`), a withdrawn one (`application-withdrawn`), an expired invitation (`invitation-expired`) or a revoked one (`invitation-revoked`). So running
a finished file again creates nobody, but a file whose earlier invitations have lapsed is not silently re-sent either. After a rollback the people are lapsed (withdrawn, revoked) and
need the flag.
**The tool cannot recognise people who asked to be erased.** Erasure keeps no identifier (their application's address becomes a placeholder), so their real address matches nothing and
a roster that still lists them would invite them again. Remove them from the roster file before running; every dry-run summary repeats this. **[OWNER]** an optional suppression list (a keyed hash
of an erased person's address kept only to avoid contacting them again) is not implemented; decide whether the club wants one.

**Bounds.** `--limit N` (default 50) caps the rows created by a run; no setting exceeds the hard maximum of 200. Refused before anything is written: no
`LIFECYCLE_OUTBOX_DIR`, or a `LIFECYCLE_PUBLIC_ORIGIN` that is not a valid origin (the same check approval makes); a `--plan-sha256` that does not match. Roster-created invitations count towards
the pending-queue size the form protects (pending applications plus live invitations above 500): the dry run reports `exceedsPendingCap`, and an apply that crosses it writes one staff
notice a day to the outbox.

**What the plan hash proves, and what it does not.** `planSha256` is the SHA-256 of: the file's bytes, the limit, the operator's account id, `--reinvite-lapsed`, the identity of the database
(its name and, where the server allows reading it, the cluster's system identifier) and the sorted set of row numbers that apply would create **right now**. `apply` recomputes it against the live
database. A match therefore means: the same file, limit, operator and flag, the same database, and the same set of rows to create, as a dry run someone looked at. The identity is printed (`databaseIdentity`) with `clusterBound: true|false`.
A logical copy (dump and restore) has a different cluster identifier and cannot unlock production; a physical clone with the same system identifier and the same database name would. Where `pg_control_system` is unavailable to the connecting role
(`clusterBound: false`, identity `name:unavailable`) only the database name is bound, which a staging database of the same name would match: check the flag in the dry-run summary. A different limit, a dry run
against a differently named or logically copied database, or rows that became duplicates since (another run, an application arriving) all refuse with "re-run the dry run"; apply never quietly creates a different set. For the same
reason a finished file's old hash no longer matches (the set to create is now empty): run the dry run again; it shows nothing to do. It is **not authentication**: anyone who can run the tool and
read the dry run can produce the hash.

**Safety model (it may run against production).** The tool does not refuse a non-local database, as the importer does. Instead:

* `--operator` names an existing **administrator** (staff user id or email) and is recorded as the reviewer. It is **attribution, not authentication**: nothing proves the person at the keyboard is that account.
  The real control is who can reach the database and the production environment. Editors cannot be named: the tool issues many links at once and the outbox is administrator-only.
  The check reads `users.role` from the database. Under editorial SSO that column is set when the staff row is first created and is not refreshed at later sign-ins, and the row keeps no last-sign-in time, so a demotion
  in the identity provider is **not** seen by this check (the summary shows `operatorSsoManaged`, true for SSO-created rows). No recency window is enforced because none can be: it is a known limitation, mitigated only by who holds the production environment.
* `apply` requires `--plan-sha256` (above), in every environment.
* A production target (`CMS_PUBLIC_DEPLOYMENT=1`, or a database that is not a local socket or loopback) requires the complete public-deployment configuration (the CMS runtime validator, including `LIFECYCLE_OUTBOX_DIR`, `LIFECYCLE_PUBLIC_ORIGIN`, no `CMS_LOCAL_BOOTSTRAP`) and `--confirm-production`.
  A non-local database without `CMS_PUBLIC_DEPLOYMENT=1` is refused as inconsistent. **Caveat:** an SSH tunnel to a production database arrives on loopback, so without `CMS_PUBLIC_DEPLOYMENT=1` it is treated as local and
  `--confirm-production` is not asked for. Always run the tool with the real production environment loaded (as shown above), not a development profile pointed at a tunnel.
* Terminal output is fixed text, counts, hashes and the database identity (not secret). The per-address lock waits at most a few seconds (`LIFECYCLE_LOCK_TIMEOUT_MS`, default 3000): a public submission for an address held that long gets the generic 503 `Unavailable.` and stores nothing, and a roster row stops the run with `failure: address-locked`. Two overlapping applies cannot both start: claiming the running slot is atomic and the second is refused (`run-in-progress`). Errors never quote the file, a path or a connection string. The summary is printed first, then the private report is written, so a report failure never hides the run id.

**Journal and rollback.** Each apply is recorded in `roster-runs` (run id, operator id and display name, limit, flag, database identity, the file's and the plan's SHA-256, counts, and who rolled it back and when) with one
`roster-run-items` row per created application (row number, application and invitation ids). Both are administrator-readable and written only by the tool; the operator's display name stays if the account is deleted. A run that
creates nothing leaves no entry. A run that has stopped heartbeating for 30 minutes is marked `failed` by the next apply or rollback. `rollback --run ID` revokes the run's invitations and withdraws its applications in one
transaction **only if none of them was redeemed or linked to a member**; otherwise it changes nothing and reports the counts (`redeemed`, `linked`). After the commit it redacts the run's own mirror files (the existing erasure redaction: names and addresses removed);
repeating a rollback repeats only that redaction. The outbox database rows are not redacted, as for any withdrawn application.

**What the operator still does by hand.** (1) Deliver each link from the mirror files in `LIFECYCLE_OUTBOX_DIR` privately. (2) For everyone who accepts, create the realm
user with `provision-member.ts provision --application ID` (section 4); first sign-in then binds the person to their application by verified email. (3) Watch the
sweep's `unlinkedRedeemedApplications` and `undeliverable` counts. **[OWNER]** who is on the roster, who may run it, how links are delivered at this volume, the per-run limit, and the suppression list above.

**Known gap.** The packaged `bin/roster-invite` is tested against real PostgreSQL from an extracted release (`cms/test/release-tools.test.ts`), but no real host
has run it yet: the Womb wrapper `terrace-cms-tool` that supplies the CMS environment and account is proven in VM tests only (see "Running it on a host").

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
* Whether to bulk-invite an existing roster at all, who may run it and at what volume (see Bulk roster onboarding).
