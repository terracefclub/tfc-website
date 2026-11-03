# Member community

The six community collections require an approved Keycloak member identity. Editorial accounts do not grant community access. The separate report queue exposes only submitted snapshots to CMS administrators. Responses are private, uncacheable and excluded from indexing; relationship depth is zero at this boundary. Member identities themselves are not a directory.

| Collection | Who can read | Who can change |
| --- | --- | --- |
| `member-profiles` | Owner; other approved members only when `directoryVisible` is on | Owner |
| `member-stories` | Approved members for community stories; joined members for group stories; the author retains their own stories | Author |
| `member-groups` | Approved members | Any approved member can create; founder can edit |
| `group-memberships` | The member who joined | Self-service join/leave; founders remain in their groups |
| `mentorship-offers` | Owner; other approved members only while `optIn` is on | Owner |
| `mentorship-requests` | Requester and mentor only | Requester can withdraw; mentor can accept/decline and write a private reply |
| `story-reports` | CMS administrators only | Approved members can submit one report per readable story; administrators can mark reviewed or delete |

Profiles and mentorship offers are hidden by default. They contain no automatic email, phone or other contact import. Names attached to stories, group creation and mentorship requests are captured from the authenticated author when they choose to contribute. Story text is plain text, never trusted HTML. Group names and descriptions are discoverable by approved members; any approved member can join. This is not an invitation-only subgroup model.

Ownership fields and identity snapshots are set by the server. Unique database constraints prevent duplicate profiles, offers, group joins and mentorship requests between the same people. A mentor who opts out stops receiving new requests; existing requests stay private to their participants. No emails or external notifications are sent. Reporting captures the selected story, author display name and chosen reason only after checking current read access; its snapshot survives story edits and deletion. The member form discloses that CMS administrators will receive it. Members and ordinary editors cannot read, update or delete the queue. Administrator changes preserve the original snapshot and reason; only the review status can change. Public profiles, private uploads, chat, account deletion and broader moderation remain outside this slice.

Reads are capped at 100 records per page. A member may join up to 100 groups. Writes are limited to 30 per minute per authenticated member in each CMS process, with bounded rate-limit memory. Deploy a shared gateway limit before scaling to multiple CMS processes. Existing database data is retained; a rollback of the community migration drops these tables and must never be run against live member data without a verified backup and recovery plan.

Run `tools/with-local bun run migrate`, then `tools/with-local bun test`. `CMS_HTTP_URL` adds direct REST rejection/header checks against an owned CMS process. The PostgreSQL tests cover forged ownership, editorial/member separation, profile visibility, group entry/exit, duplicate joins, mentorship consent, private requests and responses. The identity suite separately covers JWT validation, approval and revocation. Browser tests for the member interface belong to the separate `web/` change.
