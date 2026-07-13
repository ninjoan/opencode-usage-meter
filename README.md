# OpenCode CLI Usage Meter

Standalone OpenCode TUI plugin package for showing CLI usage in the sidebar.

The plugin registers one public `sidebar_content` block. It probes only `codex /status` and `claude /usage`, safely normalizes exposed quota windows, and fails closed as `Data unavailable`. Public prompt, status, and idle events adapt refresh cadence from 2 to 5, 15, and 30 minutes; resource pressure is an explicitly injectable host boundary because the public OpenCode API does not expose it.

## Checks

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm pack:dry-run
pnpm smoke:consumer
pnpm smoke:pty-native
```

## Behavior harness and package smoke

Phase 3 behavior is covered by a deterministic in-process plugin behavior harness that imports `src/tui.js` and injects fake Codex/Claude transport responses. It covers registration, refresh, toggle, partial failure, and disposal without real credentials, network, cookies, Keychain, provider APIs, packed-package execution, or fake executables.

Claude remains pipe-first, with an optional PTY fallback on Linux and macOS. The fallback dynamically loads exactly `node-pty@1.2.0-beta.12`; if the optional native module is missing or cannot load, Claude usage degrades safely to `Data unavailable`. Version 1.1.0 was rejected because its published macOS arm64 `spawn-helper` lacked executable mode. The exact beta tarball ships executable arm64 and x64 helpers, avoiding a CI-only `chmod` workaround, but prerelease dependency stability remains a supply-chain risk. Installing the fallback permits lifecycle scripts only for `node-pty` (alongside the existing `esbuild` and `msgpackr-extract` allowances). Linux cold install/import/spawn/terminate is locally proven; macOS remains pending CI runtime proof and is not claimed as successful.

`pnpm smoke:consumer` remains a separate `--ignore-scripts` package export-shape/import boundary: it packs the package into a temporary consumer and imports the package root plus `/tui`. It does not exercise plugin behavior or require the optional native fallback.

Fixtures must never contain real credentials, tokens, cookies, Keychain data, or provider auth files.
