# Terrace Friend Club

[GitHub is the primary repository](https://github.com/terracefclub/tfc-website).
Develop against `dev` through reviewed pull requests with all three Actions jobs
green; `prod` and `dev-post-vanilla` remain separate preserved branches.

```sh
git clone git@github.com:terracefclub/tfc-website.git
cd tfc-website
direnv allow web
direnv exec web check-shell
direnv exec web git switch -c codex/my-change origin/dev
# Edit and validate through the component dev shells.
direnv exec web gh pr create --base dev
```

Nix/devenv/direnv provide the declared tools, including `gh`; a user-profile
GitHub CLI installation is unnecessary. See [migration and mirror operations](docs/github-migration.md)
for original-history preservation, the one-way `github/*` GitLab mirror and
verification commands. The original GitLab issues/MRs remain the historical
audit trail. The old private `tfc-website-v1-wagtail` repository is separate.


# Terrace local preview

From this checkout, approve the component shells once with `direnv allow identity`,
`direnv allow cms`, and `direnv allow web`, then run `./tools/local-stack start`.
Use `./tools/local-stack status` to check the identity, CMS and website together.
Run `./tools/local-stack stop` when the active task ends; it preserves component
state and refuses uncertain ownership. Do not leave detached previews unattended.
See [local preview setup](docs/local-preview.md) for URLs, synthetic sign-in
references, isolated ports and the development-only release boundary.

# Historical legacy notes

The notes below are retained for historical context. Use the current component
shells and preview instructions above rather than the old scripts/runner example.

# Flabyrinth

The boiler room of the FUTURE at Womb HQ, managed by Forkman, grower of sheets, stoker of peeps. This is a mongo monorepo magoo. May you find your way as you lose yourself in the flabyrinthian tunnels of metromomma. Main quest: TBA. Guidelines? Turn back or read further:

## [Live Development Demo](https://tfc-website-staging-stable.herokuapp.com)

## Environment Variables

To run this project, you will need to add the following environment variables to your .env file

`GOOGLE_CREDENTIALS`

# TFC Website

TFC Website Revamp Project

https://docs.google.com/document/d/12Hb0rczOJEcjdv2pzkIkSqdRnas9zvIRU98MMf7aNEw
https://drive.google.com/file/d/12EHvHrF0ASJr5fxwi042bEIhLPCaYy9v/view?usp=sharing

# Develop locally
```
./scripts/develop.sh
./scripts/gitlab-ci-test.sh
```

# Locally test CI build
Unfortunately, other steps in the CI pipeline are not supported for testing yet on an independent runner. Not sure how to go about testing without clogging up git and pipelines.

```
docker run --rm -v $PWD:$PWD -v /var/run/docker.sock:/var/run/docker.sock -v gitlab-runner-config:/etc/gitlab-runner --workdir $PWD --name gitlab-runner -e RUNNER_PRE_BUILD_SCRIPT="export $(cat .env | tr '\n' ' ')" gitlab/gitlab-runner:latest exec docker --docker-privileged build
```

# Upload any remote data
```
pg_dump -Fp --no-acl --no-owner -h localhost -U user web > latest.dump
# for example:
```

# Restore local database
```
pg_restore --verbose --clean --no-acl --no-owner -h localhost -U user -d web <latest.dump>
```
