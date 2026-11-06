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
