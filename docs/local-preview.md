# Start the local Terrace preview

The repository owns one loopback-only identity, CMS and website stack. It uses
the existing component launchers and pinned devenv tools; nothing is installed
in a user profile or dotfiles. The legacy apps are not started.

Run local compute only during an actively supervised task and stop it when the
task ends. `start` still launches detached services in this increment; it does
not provide a finite supervised session. Bounded `run` supervision is a separate
follow-up. Do not leave a preview running unattended.

From a clean checkout with Nix, devenv and direnv available, approve each checked-in
shell once, then use one command:

```sh
direnv allow identity
direnv allow cms
direnv allow web
./tools/local-stack start
```

The first start downloads the pinned Keycloak release and installs the pinned
CMS/web dependencies through their devenv shells. It starts local PostgreSQL on
a private Unix socket, explicitly applies pending Payload migrations, then starts
the CMS and website detached. It does not use schema push or the local password
administrator/content bootstrap. CMS access uses each synthetic editor's own
Keycloak identity. The initial CMS has no published content; the website's
sample preview is visibly labelled, and **View published site** shows only what
an editor has actually published.

Default URLs are the website at `http://127.0.0.1:4194/`, CMS sign-in at
`http://127.0.0.1:3040/admin/login`, and Keycloak at `http://127.0.0.1:8186/admin/`.
The identity management port is 9186. Every listener is loopback-only. (`8184` is the default only when the
identity realm is started on its own, outside `tools/local-stack`, see `identity/README.md`; `KEYCLOAK_HTTP_PORT`
selects the port for the identity tools, and a stack started with `--identity-port 8190` uses `8190`.)

If another checkout already uses those ports, leave it running and choose a
separate set before the first start:

```sh
./tools/local-stack start --identity-port 8190 --cms-port 3046 --web-port 4252
./tools/local-stack status
./tools/local-stack stop
```

Chosen ports are retained in `identity/.state/local-stack-config.json`; later
commands use that set. Ports must be distinct integers from 1024 to 64535,
including the management port 1000 above the identity port. Only those exact
website/CMS callbacks are registered for this isolated realm, without wildcards.
Changing ports while a managed service is running is refused.

## Sign in

Startup and status print URLs, synthetic usernames, and credential references,
never passwords or tokens. Open the protected `identity/.state/credentials.json`
locally to find the corresponding key:

| Purpose | Synthetic username | Credential key |
| --- | --- | --- |
| Current member | `local-member` | `memberPassword` |
| Alumni member | `local-alumni` | `alumniPassword` |
| CMS editor | `local-editorial-editor` | `editorialEditorPassword` |
| CMS administrator | `local-editorial-admin` | `editorialAdminPassword` |
| Local identity administrator | `terrace-local-admin` | `adminPassword` |

Credentials and settings stay in the relevant component's ignored `.state/`
directory (0700 directories, 0600 credential files). Do not paste them into
commands, logs, chat or Git. Healthy repeat starts reuse services, accounts and
secrets. A fully healthy repeat only verifies ownership/health and prints status;
it does not bootstrap the realm or migrate a live CMS. Migrations run explicitly
whenever this command starts a stopped CMS.

## Status and failures

`./tools/local-stack status` performs ownership and HTTP health checks. It exits
zero only when all three managed services are healthy. It does not start,
reconfigure or terminate a service. No editor or member token is used for health.

Startup checks all chosen TCP ports before starting components. It refuses
unrelated listeners, even when their HTTP responses look healthy. Managed
PID records are verified against a fingerprint of the component working directory,
arguments and start identity; listeners must belong to that process group. PID reuse or uncertain ownership
never authorizes termination. Each existing launcher records the invocation that
started a new process, so failure cleanup affects only verified processes from
that invocation, in reverse order. Pre-existing services and all database/media
files are retained. Component output stays in private `.state/local-stack.log`
files; the entry shell has `identity/.state/local-stack-entry.log`.

A lifecycle lock serializes startup and stop in the same checkout. Normal
failure and handled interrupts release it. After a forced kill, inspect the
recorded owner in `identity/.state/local-stack.lock/owner.json` before removing a
stale lock. Stop refuses an active or uncertain lock; interrupt the active startup
and verify its exit before retrying. Never stop a shared preview or clear a
component's data to free a port.

## Stop and preserve local data

From this checkout, run `./tools/local-stack stop` (with the same optional port
flags if needed). It verifies the saved checkout, component, port, PID, start/argv/
working-directory fingerprint and process group before acting. It requests
graceful shutdown in website → CMS → identity → database order. PostgreSQL is
stopped with `pg_ctl -m fast` only when its PID file matches the verified process.
Credentials, database files, uploaded media, ownership records and logs remain.
Repeated stop is harmless once those recorded processes and listeners are gone.

A reused PID, unavailable inspection, mismatched record, unrelated listener,
or surviving child produces a nonzero result without authorizing a signal to an
uncertain process. Other verified components are still stopped. An absent group
leader does not authorize killing its orphan process group. Successful stop
verifies the service groups and TCP listeners are gone; a nonzero result requires
active inspection before leaving the task idle. No broad process-pattern kill is
used and stop does not create replacement accounts, services or data.

Legacy records created before group recording are deliberately refused while
running; Linux fingerprints also now include kernel start ticks and boot identity.
They are not silently adopted or rewritten. Verify and stop such old processes
independently using the owner's recorded identities, then a new startup from the
retained state will create current ownership records. Old state is never removed
to bypass this check.

## Sample content versus published content

A fresh local preview shows **sample content**, not what is in the CMS: `/events/`, `/newsletter/` and the like show the
labelled fixtures, and `/news/` and `/pages/{slug}/` show their empty states, even when the CMS holds published (or imported
and published) documents. The website reads the CMS only after the **published-preview cookie** is set in your browser:

1. Open the website at its preview origin (`http://127.0.0.1:4194/` by default, which is also the only origin the toggle is
   offered on unless `TERRACE_LOCAL_PREVIEW_ORIGIN` names another exact loopback origin) in the browser you will check with.
2. Press **View published site** in the page header (a small form button next to **Editor sign-in**). It POSTs to
   `/preview/source/published/`, which sets the cookie `terrace_published_preview_4194` (`HttpOnly`, `SameSite=Strict`, path `/`)
   and sends you to `/events/`. The same button then reads **View sample site**, which clears the cookie.
3. Reload the page you were checking. Only **published** documents appear; drafts never do (there is no draft preview, see
   [wordpress-import.md](wordpress-import.md#frontend)).

Without a browser, the same switch works from the command line (the `Origin` header must equal the preview origin):

```sh
curl -si -c /tmp/preview.jar -X POST -H 'Origin: http://127.0.0.1:4194' http://127.0.0.1:4194/preview/source/published/ | head -1   # 303
curl -s -b /tmp/preview.jar http://127.0.0.1:4194/news/ | grep -c '<article'    # published posts, not the empty state
```

The switch exists only in the local development server (`TERRACE_LOCAL_PREVIEW=1`, `CMS_ORIGIN` set); a production build with
`CMS_ORIGIN` reads the CMS directly and has no toggle. The cookie name is fixed to the default port, so a stack on other ports
still uses `terrace_published_preview_4194`; `tools/local-stack` sets `TERRACE_LOCAL_PREVIEW_ORIGIN` to the stack's own website origin, so the button appears there and the `Origin` header in the command above must be that origin.

## Member lifecycle

Application, approval, invitation, offboarding, moderation, export and erasure flows, with their
local outbox mirror and the realm provisioning script, are described in
[member-lifecycle.md](member-lifecycle.md).

## Checks and release boundary

From the repository root:

```sh
direnv exec identity bun test identity/test
```

The tests cover exact local callbacks, port validation, process identity/PID reuse,
concurrent lifecycle exclusion, surviving-child detection, inspection failures,
unrelated listener preservation and retained state. Process checks run when the
host provides inspection; the CLI listener test also needs `lsof`. From `web/`, run
`direnv exec . bun run check` and `direnv exec . bun test`. Browser checks in
`cms/tools/test-editorial-browser.ts` and `test-reports-browser.ts` consume the
same checkout's identity environment and fixture file; their commands are in
`cms/README.md`. No cross-worktree secret paths are required.

This is a local development stack: HTTP, Keycloak's local H2 database and bounded
in-memory application sessions are unchanged. Production identity/PostgreSQL,
TLS, backups/restore, real enrollment and deployment remain separate release gates.
