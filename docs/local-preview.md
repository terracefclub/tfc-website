# Start the local Terrace preview

The repository owns one loopback-only identity, CMS and website stack. It uses
the existing component launchers and pinned devenv tools; nothing is installed
in a user profile or dotfiles. The legacy apps are not started.

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
The identity management port is 9186. Every listener is loopback-only.

If another checkout already uses those ports, leave it running and choose a
separate set before the first start:

```sh
./tools/local-stack start --identity-port 8190 --cms-port 3046 --web-port 4252
./tools/local-stack status
./tools/local-stack start
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

A startup lock prevents concurrent invocations in the same checkout. Normal
failure and handled interrupts release it. After a forced kill, inspect the
recorded owner in `identity/.state/local-stack.lock/owner.json` before removing a
stale lock. This increment provides startup/status only; stopping or replacing a
running stack requires checking its recorded process identities first. Never
stop a shared preview or clear a component's data to free a port.

## Checks and release boundary

From the repository root:

```sh
direnv exec identity bun test identity/test
```

The tests cover exact local callbacks, port validation and process identity/PID
reuse checks when the host provides the inspection tools. From `web/`, run
`direnv exec . bun run check` and `direnv exec . bun test`. Browser checks in
`cms/tools/test-editorial-browser.ts` and `test-reports-browser.ts` consume the
same checkout's identity environment and fixture file; their commands are in
`cms/README.md`. No cross-worktree secret paths are required.

This is a local development stack: HTTP, Keycloak's local H2 database and bounded
in-memory application sessions are unchanged. Production identity/PostgreSQL,
TLS, backups/restore, real enrollment and deployment remain separate release gates.
