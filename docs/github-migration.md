# GitHub migration

The intended primary repository is [terracefclub/tfc-website](https://github.com/terracefclub/tfc-website),
with `dev` for development and `prod` preserved separately. The old private
`tfc-website-v1-wagtail` repository is unrelated and must not be overwritten.
The original [GitLab project](https://gitlab.com/terrace/tech/tfc-website) retains
its branches, commits, issues and merge-request audit records. Its historical
default is `prod`; GitHub deliberately uses `dev`.

A fresh protected bundle preserves only the three live GitLab branches (`dev`,
`prod`, `dev-post-vanilla`) and their complete history. There were no live tags.
Local agent branches are excluded. Do not force-push rewritten history to the
original GitLab project or replace its original refs with a derivative.

GitHub push protection rejected a historical `MAPBOX_ACCESS_TOKEN` scalar in
`heroku.yml`. The detector called it a secret token, but static inspection found
a `pk.` public-token prefix, not `sk.`; [Mapbox documents that distinction](https://docs.mapbox.com/help/getting-started/access-tokens/).
The exact value is absent at all three current heads. No provider call or
revocation evidence is implied. Original history and the bundle remain intact.
The authorized publication path is a sanitized derivative in a separate private
clone, replacing only that exact historical value; no push-protection bypass is
used. Keep the exact-value replacement file and complete old/new commit map
private. Do not put a credential in command arguments or shell history.

Use the standard locked `git-filter-repo` tool from the **Linux** web dev shell;
it is deliberately not added to the Mac shell. On the build host, in the fresh
private derivative clone only, with the replacement file already protected:

```sh
direnv exec /PATH/TO/THIS/CHECKOUT/web git -C /PRIVATE/DERIVATIVE.git filter-repo \
  --replace-text /PRIVATE/exact-replacement.txt \
  --preserve-commit-hashes --preserve-commit-encoding \
  --prune-empty never --prune-degenerate never \
  --refs refs/heads/dev refs/heads/prod refs/heads/dev-post-vanilla
```

Supervise this command under the existing shared build lock with a 300-second
active timeout and exact owned-process cleanup. Verify all rewritten trees differ
only by the exact replacement, commit messages/identity metadata/topology are
preserved, all three mapped heads match, and the protected source bundle is
unchanged. Rescan all publication refs and require GitHub push protection to accept
them normally. Publish only those mapped refs to the empty destination, then set
default `dev`. Retain the original GitLab SHA links and protected old/new map.

## Equivalent CI

`.github/workflows/ci.yml` ports the three existing GitLab jobs without deploys:
web frozen install/check/test/build/release packaging; CMS frozen install and the
unchanged `cms/tools/ci.ts` with the same PostgreSQL17.11 digest (migration,
bootstrap, production release and extracted-release HTTP tests); and identity
policy tests in the same Bun1.4.4 Alpine digest. Web/CMS retain their Node24.21
container digest and Bun1.4.4. Checkout and artifact actions use full commit SHAs.
The checked-out Git revision/date feed the existing release metadata variables.
Release artifacts retain the seven-day expiry and exact secret-free file patterns;
private build logs and runtime fixtures are excluded.

Only contents-read permissions are requested; checkout credentials are not
persisted, jobs have finite timeouts and obsolete runs on the same ref/PR cancel.
The workflow runs on dev/prod pushes and pull requests, plus explicit dispatch.
Require all three green Actions jobs and independent exact-source review before
merging the CI PR. The original GitLab CI file remains unchanged until the separate
mirror decision; a mirror must use a new project or nonconflicting namespaced
refs so the original GitLab branch history cannot be rewritten.


## Contributor tools and one-way mirror

From a fresh checkout with Nix/devenv/direnv available, run `direnv allow web`
then `direnv exec web check-shell`. The check requires the resolved `gh` binary
to be the declared `pkgs.gh` file, not an incidental user-profile executable;
it checks versions/tool availability only, without login or service startup.
`web/AGENTS.md` and the README describe GitHub `dev` pull requests and the three
required hosted checks.

The separate `GitLab mirror` workflow runs after published `dev`, `prod`,
`dev-post-vanilla` and tag pushes, or explicit dispatch. It checks out trusted
`dev`, uses the exact reviewed shared mirror script, pins the GitLab SSH host key,
and reads only the repository-scoped `GITLAB_MIRROR_KEY` secret. The workflow does
not run for pull requests. The write key is project-scoped and explicitly allowed on the new
`github/*` protected namespace. The script selects only that namespace; the
original branches/default and historical records retain their existing policy.

Source branch `dev` maps to GitLab branch `github/dev` (likewise the other two);
source tag `NAME` maps to `github/NAME`. Pushes are atomic, non-forcing and never
delete refs. `ci.skip` prevents duplicate GitLab pipeline spending. Every pushed
ref is read back and compared with the source SHA. A divergent destination fails
closed rather than rewriting either history. The original public GitLab refs
remain unchanged; retain the protected original/derivative commit map and bundle.
Original signed-commit verification remains available in that original archive.

Verify the hosted mirror with:

```sh
direnv exec web gh workflow run gitlab-mirror.yml --ref dev
direnv exec web gh run list --workflow gitlab-mirror.yml --limit 5
```

A successful run reports three verified branches and the published tag count.
Confirm `git ls-remote` on both endpoints: compare GitHub `refs/heads/dev` with
GitLab `refs/heads/github/dev`, the other two mapped heads and namespaced tags.
This is source/audit mirroring, not an application deployment or a backup of
runtime member data. Retain the original GitLab commit/MR/issue links.
