# OpenCode CLI Usage Meter

Standalone OpenCode TUI plugin package for showing CLI usage in the sidebar.

The plugin registers one public `sidebar_content` block. It probes only `codex /status`, safely normalizes percentage/reset data, and fails closed as `Data unavailable`. Public prompt, status, and idle events adapt refresh cadence from 2 to 5, 15, and 30 minutes; resource pressure is an explicitly injectable host boundary because the public OpenCode API does not expose it.

## Checks

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm pack:dry-run
```

Fixtures must never contain real credentials, tokens, cookies, Keychain data, or provider auth files.
