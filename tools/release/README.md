# Linux release bundles

Build from a clean dedicated Linux x86-64 checkout without application dotenv files, through the
shared Falcon heavy-build queue. Approve its web/CMS direnv environments once.
From the repository root:

```sh
direnv allow web
direnv allow cms
./tools/release/build /absolute/private/output
```

Keep the checkout path short (for example `~/rc/<short-name>`, not a directory named by a full 40-character commit SHA). The
build database listens on a Unix socket under `.state/release-build-*` inside the checkout, and the full socket path must stay under the
PostgreSQL limit of 107 bytes; a long checkout path makes the cluster fail to start.

Each invocation creates its own private Unix-socket-only PostgreSQL cluster and
empty upload directory under `.state/release-build-*`, applies
explicit migrations, builds both applications and stops its database. It does not
load local fixture credentials or the invoking shell's application secrets. Raw
build diagnostics stay in owner-only `.state/release-build-*/build.log`; do not
publish these logs. Cancellation targets only its recorded detached child group,
with TERM then KILL after five seconds. Retry using a fresh checkout; preserve the
private log for investigation. A retry uses a new database directory and never
loads existing component fixture state.

When building an exported source archive without Git metadata, set
`TERRACE_RELEASE_REVISION` to its full reviewed commit SHA and `SOURCE_DATE_EPOCH`
to that commit's integer Unix timestamp. The CI jobs use their own commit metadata.
The Linux Node 24.21.0/Bun 1.4.4 pins are in `runtime.json`. GNU tar is required.

The two independent flat-root archives are named
`terrace-{web,cms}-<revision>-linux-x64-gnu.tar.gz`. Each has a checksum sidecar;
`SHA256SUMS` indexes both, and separate `*.release.json` files duplicate the
internal manifests. Output must be an owner-only directory. Existing artifacts
are never overwritten. Private state, env files, logs, external symlinks and the
active build secret/database inputs fail packaging. Internal dependency symlinks
are materialized. This is an exclusion and active-input check, not a substitute
for building from a reviewed clean checkout without production credentials.

To package an already-built component on Linux, using the same metadata:

```sh
direnv exec cms bun tools/release/pack.ts web /absolute/private/output
direnv exec cms bun tools/release/pack.ts cms /absolute/private/output
```

The separately bundled CMS migrator, lifecycle sweep and operator tools get their own dependency
trace using the tracer bundled with pinned Next; application code/migrations stay
bundled and only traced dependency files supplement the request-server output.

CI publishes only these secret-free artifacts, with seven-day retention. It
runs the extracted CMS migrator against a separate empty database twice, verifies
an unchanged migration ledger, runs the extracted `bin/sweep` to write and then
redact a synthetic outbox copy, then starts the bundle for HTTP tests and runs the
extracted `bin/roster-invite` and `bin/wp-import` against real PostgreSQL
(`cms/test/release-tools.test.ts`). Retain selected release archives
and their checksums outside expiring CI storage before deployment.

## Runtime contract

Install the pinned Node executable, Bash and a compatible Linux x86-64 glibc
runtime. Native CMS image dependencies are included; validate them on the target
runtime before activation. No Bun, source checkout, package install, application
build or network package download is required at startup.

Verify `sha256sum -c SHA256SUMS` before extraction into a new release directory.
Check `release.json` component, revision and runtime pins against the intended
release. Its file hashes cover every packaged file except the manifest itself;
the archive hash covers the entire artifact. Keep code immutable. The CMS contains
an empty `.next/cache` mount point; supply a private writable cache there. Supply
uploads in an existing writable absolute `CMS_MEDIA_DIR` outside the release.
Never copy `.state` into an archive or use uploads as a code directory.

Load runtime settings from protected service credentials or an external
owner-only environment file, never the bundle or command-line arguments. See
`../../cms/README.md` and `../../web/README.md` for authentication and content
settings. The web process needs no database or CMS editorial credential. Omit
all bootstrap variables in public mode. The separate public-CMS opt-in policy
continues to gate HTTPS activation; packaging does not enable it.

Run CMS `bin/migrate` as an explicit operator step with the target database and
runtime configuration, after verifying a restorable backup. Run it once more to
confirm no pending migration. Server startup never runs migrations.

`bin/migrate` prints `CMS release migrations complete.` and exits 0 on success, and prints nothing else
(Payload's own logging is silent). When a migration fails, Payload's adapter rolls that migration back and
exits 1 by itself; `bin/migrate` writes one line to stderr first:
`CMS release migration <name> failed (<ErrorClass> <SQLSTATE>): <reason>.` The line is redacted by
construction (`cms/tools/release-migrate-failure.ts`): the migration name, the error class, the PostgreSQL
code and, only for schema-level codes (class 42, and 23502, 23503, 23505, 23514), the server message, which
names objects, not values. Any other code or no code gets `details suppressed; inspect the protected runtime
configuration and database state` instead of the message, so row values, roles, hosts, SQL, parameters,
stacks and connection settings never reach the journal. Earlier migrations stay applied; read the cause in
PostgreSQL's own log, which has the full detail. A failure outside a migration (configuration, connection)
still prints `CMS release migration failed; inspect the protected runtime configuration and database state.`
and exits 1. Tests: `cms/test/release-migrate-failure.test.ts` (`tools/with-local bun test`).

CMS `bin/sweep` is the packaged member-lifecycle housekeeping (`lifecycle:sweep`;
see `../../docs/member-lifecycle.md`, section 9). Run it with exactly the CMS
runtime configuration of `bin/start`, as the same operating-system account as the
CMS (it writes `LIFECYCLE_OUTBOX_DIR`, forced to mode 0700 with 0600 files), on a
daily timer and after every administrator-initiated erasure. It accepts only
`--purge-moderated`. It prints one JSON line of counts and outbox row ids (never
addresses or message text) and always ends on its own. Exit codes:

| Code | Meaning |
| ---- | ------- |
| 0 | Everything it set out to do was done. |
| 1 | A labelled failure: mirror work failed, the unlinked-application count could not be read, the runtime configuration or database was unusable or, in a public deployment, the outbox directory is unset. The timer unit shows the failure; the next run retries it. |
| 2 | It timed out (a 120 s bound). |
| 64 | Usage error: an unknown argument. It prints `Usage: bin/sweep [--purge-moderated]` and does nothing else (no configuration is loaded, no database is touched). |

Like `bin/migrate`, it
needs no `PORT` and opens no listener. A public CMS (`CMS_PUBLIC_DEPLOYMENT=1`)
refuses to run either command without valid lifecycle settings.

CMS `bin/roster-invite` and `bin/wp-import` are the two operator tools; see
[Operator tools](#operator-tools-binroster-invite-and-binwp-import). Start each
component with `PORT` explicitly set (1024–65535) and execute its `bin/start`.
Both launchers set production mode and bind to `127.0.0.1`. A deployment gateway
must provide any external routing/TLS; the bundle opens no public listener.
The website also requires canonical `ORIGIN` (HTTPS, or HTTP on `127.0.0.1`),
equal to `MEMBER_AUTH_ORIGIN` when member sign-in is configured. Set the external
origin explicitly; the Node adapter's inferred HTTPS origin breaks loopback HTTP
callbacks and form checks. Origin settings belong in external runtime config.

Keep the previous verified release alongside the new one. Code rollback switches
the service to that previous immutable root, using its recorded archive hash and
compatible runtime config. Database rollback is a separate recovery operation:
code rollback does not reverse migrations. Restore only from a verified backup
with the matching uploads and application version, following the hosting recovery
procedure. Never delete the previous data or upload directory during a release.

## Operator tools: `bin/roster-invite` and `bin/wp-import`

The CMS bundle carries the two operator command lines, so a host needs neither Bun
nor a source checkout to run them:

| Entry | Same as | Document |
| ----- | ------- | -------- |
| `bin/roster-invite` | `bun run roster:invite` (`cms/tools/roster-invite.ts`) | `docs/member-lifecycle.md`, "Bulk roster onboarding" |
| `bin/wp-import` | `bun tools/wp-import.ts` (`cms/tools/wp-import.ts`, the CMS applier) | `docs/wordpress-import.md`, "Running the applier on a host" |

Each is built like `bin/sweep`: `cms/tools/release-<tool>.ts` only calls the source
command line's own `main()`, Bun bundles it for Node (`--target=node`, packages
external) and the dependency trace adds the packages it imports. So the arguments,
the defaults (the roster tool's dry run), the journal, the output and the refusals are
the source tool's. Both are listed in `release.json` `entrypoints` and covered by its
per-file hashes and by the archive hash a host pins. The WXR planner
(`web/tools/wp-import/`) is not packaged: it runs on the operator's machine with the
export, and only its private plan file goes to the host.

Run them like `bin/sweep`: as the CMS's own operating-system account, with exactly the
CMS runtime environment of `bin/start`. The launcher checks Node and `CMS_MEDIA_DIR`,
sets production mode, runs from the release directory and passes the arguments
unchanged, so every path must be absolute (both tools refuse a relative one). The
roster file, the import plan, their directories and the reports must belong to the
account that runs the tool (mode 0600 in an owner-only directory outside every Git
checkout).

Both tools decide "production" the same way (`cms/tools/local-database.ts`,
`productionTarget`): a public deployment (`CMS_PUBLIC_DEPLOYMENT=1`, which the host's CMS
environment sets) or a database that is not local. Every write to a production target
(roster `apply` and `rollback`; importer `apply`, `publish` without `--dry-run`,
`rollback`) needs `--confirm-production`, and in a public deployment the valid production
configuration; dry runs need neither. This is what used to keep the importer out of the
bundle: its local-database guard alone passes against a host's own local socket, so it now
asks for the same confirmation the roster tool always has, in source and packaged form
alike. One difference remains: the roster tool refuses a non-local database without the
public profile, while the importer accepts it as an approved target named by
`--allow-nonlocal-database`. Run by hand without the CMS environment, neither tool
starts (the configuration needs `PAYLOAD_SECRET` and `DATABASE_URI`).

A Womb host renders the CMS environment as a root-only file. The infrastructure repository's
`terrace-cms-tool roster-invite|wp-import ARGS...` (root only) runs these tools with it as the CMS
account; the operator procedure is in [`docs/website-host.md`](https://github.com/terracefclub/womb/blob/trunk/docs/website-host.md). It is proven in VM tests only;
nothing has been run on a real host.

### Why this packaging

The CMS bundle already requires Node 24.21.0, and the tools' code needs nothing else:
their only Bun-specific construct is `import.meta.main` (no `Bun.*` API, no `bun:`
module, no Bun-only package). Alternatives considered and rejected:

- **Ship Bun with the release, or install it on hosts.** A second runtime and pin on every
  host (the Linux Bun 1.4.4 executable is 107 MB, 52 MB gzipped; the whole CMS archive is far smaller), its own updates and
  security surface, and a change to the runtime contract above ("No Bun"), for no
  capability the tools use.
- **`bun build --compile` executables.** Each one embeds a whole Bun runtime (about the
  size above, twice), so it is the previous option in another form.
- **Port the tools to plain Node source.** Not needed: Bun already emits Node ESM for
  `bin/migrate` and `bin/sweep`, and a port would be a second copy of the code to drift.
- **Separate release-only logic** (as `release-sweep.ts` has). The two entries call the
  source `main()` and nothing else, so the packaged and source tools cannot diverge.
  The entries do not rely on Bun's Node translation of `import.meta.main` in the
  entry file: that check is true in Node only because both of its sides are `undefined`.
- **A third archive for tools.** A host would need another pin; inside the CMS bundle the
  existing CMS pin covers them.
- **Keep a source checkout on the host.** Needs Bun, `node_modules` and a Git checkout on
  a production host, which is the gap this closes.

Cost, measured on the builder: the CMS archive grew from 27,862,737 to 27,943,113 bytes
(+80,376), against a rebuild of `eab4189` (the commit hosts pinned before this change, not
this change's base); no new runtime, dependency or host package.

The archives are not byte-reproducible, and were not before this change: two clean builds
of one commit differed only in files derived from the Next.js build ID (CMS) and in
SvelteKit chunk names (website), while the four CMS operator entries were identical. A
consumer therefore pins the hash of the one build it keeps, not a hash it expects a rebuild
to reproduce.

## Validation

CI cannot run the Linux-only smoke, so the CMS job keeps it from going stale
(`cms/test/release-proof.test.ts`, run early by `cms/tools/ci.ts` and again in the full test run):
the identity-settings parser (`identity-env.ts`) is tested against the key set the identity bootstrap exports
(`identity/tools/app-env-keys.ts`); every `/api/<slug>` and `/admin/collections/<slug>` the smoke and
`cms/tools/test-*.ts` use, and every report field the moderation browser check reads, must exist in the Payload
configuration; the sweep summary check shared with the smoke (`sweep-summary.ts`) is applied to the source
`release-sweep.ts` and the packaged `bin/sweep` against a migrated PostgreSQL database; and `check:release` type-checks
this directory and the browser checks. A change to the smoke, the sweep entry or the browser checks still
needs the builder proof below at its head commit.

From the repository root:

```sh
direnv exec web bun test web/tests/release-package.test.ts web/tests/release-child.test.ts
direnv exec cms bun run --cwd cms check:release
```

These synthetic tests cover private-input exclusion, symlink/invalid-runtime
rejection, artifact manifests, launch boundaries, bounded FIFO errors and exact
owned-process cancellation.

`cms/test/release-tools.test.ts` runs the packaged `bin/roster-invite` and
`bin/wp-import` of an extracted CMS release (named by `TERRACE_RELEASE_CMS`) against
real PostgreSQL: a roster dry run writes nothing, an apply writes the journal and its
rows, a re-run is idempotent, rollback works, the per-address lock wait follows
`LIFECYCLE_LOCK_TIMEOUT_MS` (300, default and 6000 ms against a held lock), the fixture
import runs, and unknown arguments are refused exactly as by the source tools. CI runs
it on the archive it has just built; without the variable the tests are skipped. On the
builder, after `./tools/release/build OUTPUT` in the same checkout:

```sh
release=$(mktemp -d)
tar -xzf OUTPUT/terrace-cms-*-linux-x64-gnu.tar.gz -C "$release"
cd cms
direnv exec . tools/local-up
direnv exec . tools/with-local bun run migrate
direnv exec . tools/with-local bun run bootstrap:local
TERRACE_RELEASE_CMS="$release" direnv exec . tools/with-local bun test test/release-tools.test.ts
direnv exec . pg_ctl -D .state/postgres stop
```

A relocated production/SSO and native-image smoke
proof remains required before an archive is accepted for hosting. A successful
loopback proof does not establish public TLS, gateway/cache policy, backup
recovery or live deployment readiness.

Run the stronger acceptance proof in a dedicated Linux checkout without existing
identity fixture state (approve `cms` and `identity` direnv first), against the output directory containing exactly
one web/CMS pair:

```sh
direnv allow cms
direnv allow identity
./tools/release/smoke /absolute/private/output
```

The runner reserves dedicated loopback ports 18386/19386, 13048 and 14294, refuses
an existing identity fixture state, and bootstraps only fresh synthetic identities.
It verifies archive and file hashes, extracts into an unrelated private directory,
and runs Node inside an empty Bubblewrap filesystem with only `/nix/store`, the
immutable bundle, private writable cache/uploads/outbox and its fresh PostgreSQL socket.
The source checkout and build database are absent. It runs the extracted CMS
migrator against the empty database and repeats it with an unchanged
ledger, then runs the extracted `bin/sweep` to write a synthetic pending outbox
copy (0600 in a 0700 directory), checks its JSON summary (counts only, no address)
and, after a synthetic erasure of its recipient, redacts it, then normal editorial/member SSO, draft/publish/withdrawal and moderation
browser checks. The final media check uploads synthetic PNGs, exercises native
image optimization/cache and requests the exact private optimizer URL first with
an editorial session and then anonymously; either must deny image bytes.

All runtime/provider/browser logs remain in owner-only `release-proof-*/proof.log`
beside the checkout; browser captures stay in its private `.state` subdirectory.
Cold identity-shell setup is bounded to 15 minutes; other commands to four minutes.
Nothing in those logs is a release artifact. The runner stops
only recorded/fingerprinted runtime groups and its own fresh database. Retain the
protected proof directory for inspection; never publish credentials or synthetic
state with the archives. `TERRACE_TEST_BROWSER_BINARY` lets the existing browser
checks use the pinned Linux Chromium without downloading another browser.
