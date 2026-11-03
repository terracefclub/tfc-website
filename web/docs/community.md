# Member community pilot

The private space starts at `/members/` and requires an approved Keycloak
`current-member` or `alumni` role. Account creation alone never grants access.
See [identity setup](../../identity/README.md), [web sessions](../README.md#private-member-sessions),
and [CMS boundaries](../../cms/COMMUNITY.md) before enabling the pilot.

## What members can do

- Edit a profile and choose whether it appears in the private directory. Sharing
  is off by default; turning it off removes the profile from other members' views.
- Share plain-text stories with the approved community or a joined group, then
  edit or remove their own stories. The audience is explicit on each form.
- Report another member’s readable story once. The form explains that CMS
  administrators receive a snapshot, author display name and selected reason.
  The queue is private to administrators, who can mark reports reviewed.
- Create and edit their own groups, discover groups, and join or leave them.
  Groups are open to every approved Terran; their stories require membership.
  Founders remain members. Private invitations and group moderation are not yet implemented.
- Opt in to mentorship, send an in-site request, privately accept or decline it
  with a reply, and withdraw their own requests. Turning off mentorship prevents
  new requests and removes the offer from discovery. Existing requests remain
  visible only to their two participants. No email notifications are sent.

Profiles and mentorship offers contain no dedicated contact fields. Members can
choose to include details in their own text, so forms explain who can read it.
No private media uploads, custom HTML/CSS, public member profiles, or arbitrary
external embeds are supported. These are text-first community tools, not a
moderated production social network. Reviewer procedures, account
erasure/export, and upload safety need a separate release before a broad launch.

## Look and feel

The private pages reuse the public palette and local Anton face (`members.css`; the standalone
sign-in/denied page loads `static/fonts/anton-latin-400.woff2`, OFL). Consent switches are native
checkboxes restyled as OFF/ON and must stay unchecked by default; keep every control, label and
test id when restyling.

## Runtime and checks

The SvelteKit server sends the signed-in member's bearer token to Payload; it
never uses an editorial administrator token. Payload enforces ownership, group
membership, sharing consent, and participant-only mentorship. Server forms
validate bounded fields and forward only allowed values; SvelteKit enforces
same-origin form submissions. All private responses forbid caching and indexing.

Use the repository identity launcher and your own CMS database when developing;
never point synthetic tests at a shared or production database. The member
frontend needs the same `MEMBER_AUTH_*` service environment as the identity
preview and `CMS_ORIGIN` for the migrated CMS. Register the exact callback and
logout return for the chosen web port. Keep credentials in ignored service
files, never in commands or documentation. `bun run dev` supports hot reload.

Run `bun run check`, `bun test`, and `bun run build` from `web/` through its dev
shell. CMS tests cover actual PostgreSQL ownership and privacy boundaries; web
tests cover escaped rendering, form validation and session protection. Before
releasing, verify with real Keycloak sessions:

1. An unapproved account is refused; both approved roles can enter and sign out.
2. A private profile stays hidden from the other account, appears after consent,
   and disappears when consent is withdrawn.
3. A group story is hidden before joining, visible after joining, and hidden
   after leaving. Another member cannot edit an author's story or group.
4. Mentorship starts off, can be enabled and disabled, and a private request and
   reply reach only their two participants.
5. Reload and token refresh retain saved data. HTML-like text stays literal.
   Keyboard navigation and mobile forms remain usable.

Lists are paginated. CMS writes are rate-limited per member for the single-process
pilot; multiple workers require a shared limiter and shared session store first.
