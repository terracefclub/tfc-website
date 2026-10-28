# Terrace web preview

A standalone SvelteKit redesign in `web/`. The legacy frontend and backend remain available as references. This preview has no CMS or payment integration; all event listings are visibly labeled examples. Published newsletter PDFs and outbound donation links use Terrace's current official site.

## Local development

From `web/`, run `direnv allow .` once, then:

```sh
direnv exec . bun install --frozen-lockfile
direnv exec . bun run dev
```

The dev server hot reloads changes. For validation:

```sh
direnv exec . bun run check
direnv exec . bun test
direnv exec . bun run build
```

`devenv.nix` supplies Bun and TypeScript. `bun.lock` and `devenv.lock` pin dependencies. Nothing needs to be installed in a user profile or dotfiles. The SvelteKit Node adapter produces a deployable Node server; hosting, content migration, and CMS selection remain separate decisions.

The active GitLab pipeline only checks, tests, and builds `web/` with a digest-pinned Bun image. Its build artifact expires after seven days. The former Heroku, Docker, and Terraform pipeline is archived at `.gitlab/legacy-ci.yml` as an inert reference; GitLab does not include or execute it.

Commit through the web shell (`direnv exec web git commit ...` at the repository root). Its local hook path runs web checks and tests for staged web/CI changes and scans the entire staged patch with gitleaks in redacted mode. The hook configuration lives in `devenv.nix`; it does not reformat the legacy code. Automatic hook installation is disabled because this repository's bare Git directory is shared by every worktree; the shell appends a temporary `core.hooksPath` without changing shared Git config.

## Content boundary

`src/lib/content/index.ts` defines the typed `TerraceContent`, `TerraceEvent`, and `Newsletter` shapes. A future CMS adapter can replace `fixtureContent` without changing page markup. The existing repository's calendar sync, menu document import, newsletter documents, and show media are future migration inputs. They are not executed by this preview.

The official [events page](https://princetonterraceclub.org/events/) showed no upcoming events when checked on 2026-10-27. Sample events exist only to demonstrate filtering and detail presentation. The site labels them throughout and links to the official calendar. Newsletter issue URLs and the donation destination were checked against the official site on that date.

## Assets

Clubhouse imagery and the badge were copied from this repository's `frontend/public/img/`: `background.jpg` → `web/static/images/clubhouse.jpg`, `tfc_1.jpg` → `clubhouse-snow.jpg`, `tfc-circle.png` → `food-is-love.png`, and `favicon-32x32.png` → `web/static/favicon.png`. Fonts are bundled from the `@fontsource-variable` packages; the rendered site does not request a font CDN.
