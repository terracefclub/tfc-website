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
| Public pages `/apply/`, `/join/<token>`; member page `/members/account/` | `web/src/routes/` |
| Spam guard (rate limit, honeypot, signed timing token) | `web/src/lib/server/apply-guard.ts` |
| Realm user tooling (idempotent) | `identity/tools/provision-member.ts` |

Configuration (local values are generated into the ignored `identity/.state/app.env` by the identity
bootstrap; never print or commit them):

| Variable | Purpose |
| --- | --- |
| `LIFECYCLE_INTAKE_SECRET` | Shared website-to-CMS secret for apply/redeem (32+ chars). Unset means the endpoints answer 503 and `/apply/` shows "not open". |
| `LIFECYCLE_OUTBOX_DIR` | **Required to approve anyone.** Directory for the file mirror of the outbox (`cms/.state/outbox` locally). It is forced to mode 0700 and files are 0600. If unset, approval fails (503) and rolls back rather than issuing an invitation nobody can see. |
| `LIFECYCLE_PUBLIC_ORIGIN` | Origin used in invitation links. Default `http://127.0.0.1:4194` outside production; when `NODE_ENV=production` it must be an explicit public `https` origin or approval fails (503). |
| `LIFECYCLE_APPLICATION_DAYS` | Pending applications older than this are withdrawn automatically, default 60. **[OWNER]** placeholder. |
| `ADDRESS_HEADER`, `XFF_DEPTH` (website) | Required in production behind a proxy so the rate limit sees real client addresses (see below). Without them `/apply/` stays closed, unless `LIFECYCLE_DIRECT_CLIENTS=1` states there is no proxy. |
| `LIFECYCLE_INVITATION_DAYS` | Invitation lifetime, default 7. **[OWNER]** placeholder. |
| `LIFECYCLE_GRACE_DAYS` | Offboarding and moderation grace period, default 30. **[OWNER]** placeholder. |

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
`staff-notice` to the outbox (at most one a day) when the queue passes 400 so reviewers see it filling.

**Deploy requirement.** The rate limit uses the address SvelteKit's adapter-node reports. Behind a reverse
proxy that is the proxy's address unless the website runs with `ADDRESS_HEADER=X-Forwarded-For` and
`XFF_DEPTH` set to the number of trusted proxies (for example `1`). The application never reads
forwarded headers itself, so a client-supplied `X-Forwarded-For` cannot choose its own bucket. In production
the form refuses to open until `ADDRESS_HEADER` is set (or `LIFECYCLE_DIRECT_CLIENTS=1` says the server faces
clients directly). Add these to the production environment for the website.

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
administrators, and **never contain links or tokens**. In local preview the same message is also written
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
KEYCLOAK_HTTP_PORT=8190 direnv exec identity bun identity/tools/provision-member.ts provision \
  --username verify.alumna --email person@example.org --name "Verify Alumna" --role alumni
```

* A new user gets a temporary password (change forced at first sign-in), written to
  `identity/.state/provisioned/<username>.txt` (mode 0600), never printed. Deliver it privately.
* Running it again for an existing user keeps their credentials, re-enables the account and sets
  exactly the granted role (the other member role is removed).
* The script refuses anything but the loopback local realm. For a production realm an operator uses
  the Keycloak admin console following the same steps; **[OWNER]** production enrollment, verified
  contact ownership and password delivery are still open.

After the person first signs in, an administrator may set the optional **member** link on their
application and invitation. That lets the member (and only that member) read those two records.

## 5. Offboard

An administrator creates a **Member offboardings** record for the member (reason, optional notice
email). On creation:

1. The member row is marked `offboarded`. The CMS authentication strategy and `isMember` then refuse
   them (401/403) **even if the realm still lets them sign in**.
2. Everything they own is hidden but kept: profile and directory entry, stories, founded groups,
   mentorship offer and mentorship requests (sent and received).
3. An offboarding notice is appended to the outbox.

Then the operator closes the realm side:

```sh
KEYCLOAK_HTTP_PORT=8190 direnv exec identity bun identity/tools/provision-member.ts offboard --username verify.alumna
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
changes, not on later edits. A hidden group also stops opening its stories to members, and authors cannot
delete their own content while it is hidden, so evidence is kept. Members may file at most 20 reports an hour.
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
mentorship requests sent or received and the founder name on groups they founded. Scrubbed: moderation
snapshots, reporter text and resolution notes about them; legacy story reports about their stories; the
reports they filed; the offboarding reason and notice address; applications and decision notes, found by
member link, through their invitations and by contact email; and the recipient columns of outbox messages
addressed to them (rows stay, the personal columns are redacted, and matching local mirror files are
rewritten). Because applications are found through those links, **link the application or invitation to the
member before erasing** when you can; an unlinked, never-invited application cannot be tied to a person. The member row becomes a tombstone (status
`erased`, no roles, name and OIDC subject wiped) keeping only the one-way identity hash so a still-live
realm account cannot re-enter. A confirmation is appended to the outbox. The operator then runs
`provision-member.ts offboard` for the realm user. **[OWNER]** whether tombstones, moderation records
and audit rows may be retained, and for how long.

## 9. Housekeeping

```sh
cd cms && direnv exec . tools/with-local bun run lifecycle:sweep               # expire invitations, report
cd cms && direnv exec . tools/with-local bun run lifecycle:sweep -- --purge-moderated
```

The sweep expires stale invitations, withdraws unreviewed applications and reports content past its grace period. It deletes
moderation-hidden content only with `--purge-moderated` (in one transaction, memberships and stories of a
purged group first); offboarded members are never erased
automatically. **[OWNER]** retention periods before a scheduled run is added.

## Permissions summary

| Actor | Can |
| --- | --- |
| Anonymous | Submit `/apply/` (limited); check and redeem a valid link. Everything else: 401/403. |
| Unapproved or offboarded/erased member | Nothing under `/members/` or `/api/lifecycle/*` (401/403). |
| Member | Own export and erasure; report content they can read; read only applications/invitations linked to them. |
| Editor | Review applications; read and resolve reports. Cannot read members, identity fields, reporter identity, token hashes, the outbox, or offboard/erase. |
| Administrator | Everything above plus offboarding, erasure of offboarded members, the outbox and linking records to a member. |

## Verify

```sh
direnv exec web bun run check && direnv exec web bun test
cd cms && direnv exec . bun run check && direnv exec . tools/with-local bun test
direnv exec identity bun test identity/test
```

Local stack end-to-end (see `docs/local-preview.md`): apply at `/apply/`, approve in the CMS admin, read
the link from the outbox mirror, accept it at `/join/<token>`, then run the provisioning script above.

## Decisions the owner still owes

* Approval policy wording, approver names and fallback approvers; real roster of members and alumni.
* How invitations and notices are delivered (no mail transport exists); production invitation delivery
  and first-password handling in Keycloak.
* Invitation lifetime, offboarding grace period and the retention periods for moderation content,
  reports, tombstones, the outbox and audit rows (all current numbers are placeholders).
* Moderation owner and backup, appeal process, who may approve (editors or only administrators).
* Whether alumni and current members need different approval evidence.
