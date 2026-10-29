# Identity development

- Follow `../web/AGENTS.md` for isolated worktrees, fetching/rebasing dev before commits, hooks and secret handling.
- Use `direnv exec identity` from the repository root. The local runtime stays under ignored `.state/`; never print credential files, access tokens, private logs or raw authentication failures.
- Run `bun test identity/test` for policy checks. Validate changes against this dedicated loopback realm; never apply `local-up.ts` to personal or production Keycloak. Bootstrap output is safe, but suppress/redact stderr when credentials are handled.
- Keep public registration disabled and require explicit approval for real members/alumni. Synthetic local fixtures may be reconciled by the local bootstrap. Production identities require an auditable invitation workflow and separate per-user accounts.
- Never run Nix, container or heavy production builds on the Mac. Keycloak runs as a detached native Java process from the pinned official release; preserve exact process ownership when stopping it.
