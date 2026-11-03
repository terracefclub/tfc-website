# Linux release bundles

Build from a clean dedicated Linux x86-64 checkout without application dotenv files, through the
shared Falcon heavy-build queue. Approve its web/CMS direnv environments once.
From the repository root:

```sh
direnv allow web
direnv allow cms
./tools/release/build /absolute/private/output
```

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

The separately bundled CMS migrator gets its own dependency trace using the
tracer bundled with pinned Next; application code/migrations stay bundled and
only traced dependency files supplement the request-server output.

CI publishes only these secret-free artifacts, with seven-day retention. It
runs the extracted CMS migrator against a separate empty database twice, verifies
an unchanged migration ledger, then starts the bundle for HTTP tests. Retain selected release archives
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
confirm no pending migration. Server startup never runs migrations. Start each
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

## Validation

From the repository root:

```sh
direnv exec web bun test web/tests/release-package.test.ts web/tests/release-child.test.ts
direnv exec cms bun run --cwd cms check:release
```

These synthetic tests cover private-input exclusion, symlink/invalid-runtime
rejection, artifact manifests, launch boundaries, bounded FIFO errors and exact
owned-process cancellation. A relocated production/SSO and native-image smoke
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
immutable bundle, private writable cache/uploads and its fresh PostgreSQL socket.
The source checkout and build database are absent. It runs the extracted CMS
migrator against the empty database and repeats it with an unchanged six-migration
ledger, then normal editorial/member SSO, draft/publish/withdrawal and moderation
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
