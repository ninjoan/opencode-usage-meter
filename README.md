# OpenCode CLI Usage Meter

Standalone OpenCode TUI plugin package for showing CLI usage in the sidebar.

This PR only establishes the package contract: `.`/`./tui` resolve to `dist/tui.js`, Node is `>=22.13`, OpenCode/OpenTUI/Solid are peers, and the TUI entrypoint registers `sidebar_content` with `Data unavailable` until provider slices land.

## Checks

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm pack:dry-run
```

Fixtures must never contain real credentials, tokens, cookies, Keychain data, or provider auth files.
