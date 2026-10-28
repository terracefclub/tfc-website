# Terrace web agent notes

- Work in an isolated Terrace worktree based on `origin/dev`; leave the legacy `frontend/` and `backend/` intact. Fetch and rebase `origin/dev` immediately before a commit. Do not run the legacy app.
- Enter this subproject with `direnv allow web` once, then use `direnv exec web <command>` from the repository root. Bun, TypeScript, Git, glab, gitleaks, and the commit hook runner come from this dev shell. Do not install user packages or edit dotfiles.
- For development: `direnv exec web bun run dev`. For validation from `web/`: `direnv exec . bun install --frozen-lockfile`, `direnv exec . bun run check`, `direnv exec . bun test`, `direnv exec . bun run build`.
- Commit from the repository root through `direnv exec web git commit ...`. The shell selects a worktree-local hook path without changing shared Git config; hooks check and test the new web app when web/CI files are staged, and scan every staged patch with redacted gitleaks.
- Do not print or commit a secret value. The active GitLab CI only validates the web app; `.gitlab/legacy-ci.yml` is an inert archive. Keep events visibly marked as sample content until a verified calendar source is connected.
