# Design: OpenCode CLI Usage Meter — Phase 3 / PR3

## Technical Approach

Revise the current Codex-only package into an explicit multi-adapter runtime for OpenCode `1.17.18` public TUI APIs only: `slots.register({ slots: { sidebar_content } })`, `keymap.registerLayer`, lifecycle, events, and validated session-local state. PR3 keeps the package standalone, adds Claude through official `claude /usage`, hardens the expandable sidebar, and migrates the current Codex snapshot/cache/scheduler without introducing auth readers, provider API calls, cookies, persisted UI state, or Windows execution.

## Architecture Decisions

| Area | Decision | Rationale |
|---|---|---|
| Adapter registry | Replace `PROVIDER={CODEX}` with explicit adapter descriptors ordered `Codex`, `Claude`, then future registered adapters. Never derive support from OpenCode provider config. | Quota support is a plugin contract, not an OpenCode model/provider list. |
| Domain model | Normalize providers to `ProviderUsageSnapshot` containing status, label, windows, `percentRemaining`, optional reset, and provider status. Omit absent CLI fields; failed/unknown data is unavailable, never zero. | Supports Codex 5h/weekly and Claude 5h/weekly without fabricated fields. |
| Scheduler/cache/gates | Make cache, gates, abort controllers, and single-flight keyed per provider; `usage.refresh` fans out to all adapters and isolates failures. | Current scheduler is sequential Codex-only and can let one provider shape global state. |
| Claude process | Run plain-pipe `claude /usage` first, then dynamically load exact optional `node-pty@1.1.0` on Linux/macOS when pipe output cannot be parsed. Missing native support returns unavailable. | Preserves the minimal path while supporting real CLI TTY requirements without making package import depend on a native addon. |
| Native build policy | Permit lifecycle scripts for exact `node-pty` only, preserving frozen-lock integrity and the existing `esbuild`/`msgpackr-extract` allowances. | Linux has no shipped 1.1.0 prebuild and requires Python, a C++ compiler, and make/node-gyp; exact pinning bounds the added supply-chain authority. |
| Sidebar UI | Implement one expandable `CLI Usage` section, default expanded, using session-memory state. Collapsed shows `available/total` or exact `Data unavailable`; expanded shows provider rows, windows, bars, and accessible text. | Matches approved UI and OpenCode sidebar patterns without unsupported routes/panels. |
| Cleanup | Disposal is idempotent for probes, timers, activity subscriptions, keymap command, manual refresh, and local UI state. `slots.register` in 1.17.18 returns an id, not a disposer; do not invent unregister. Rely on host plugin lifecycle for slot ownership and make render inert after dispose. | Uses public API only while preventing resource leaks. |

## Data Flow

```text
tui(api) -> adapter registry -> scheduler.refreshAll()
  -> provider gate/cache/single-flight -> safe process -> parser -> normalized windows
  -> sidebar signal -> collapsed/expanded sidebar_content
```

## File Changes

| File | Action | Description |
|---|---|---|
| `src/domain/usage.ts` | Modify | Provider constants, adapter descriptors, normalized multi-window model, ordering, clamps. |
| `src/providers/{registry.ts,claude.ts}` | Create | Explicit registry and Claude provider over safe transport. |
| `src/providers/codex.ts` | Modify | Return normalized windows instead of current single percentage/reset. |
| `src/parsers/claude/v1.ts` | Create | Sanitized parser for official `/usage` text fixtures/goldens. |
| `src/state/cache.ts`, `src/gates/provider-gates.ts`, `src/scheduler/refresh.ts` | Modify | Provider-isolated fanout, stale discard, fake-timer-friendly cleanup. |
| `src/tui.tsx`, `src/ui/*`, `src/disposal/index.ts` | Modify | Expand/collapse state, keymap toggle/refresh, narrow rendering, idempotent disposal. |
| `tests/**` | Modify/Create | PR3 RED/GREEN tests only; no real credentials/network. |

## Interfaces / Contracts

Use TypeScript const-object unions and flat interfaces. Core contract: adapter `{ provider, label, order, refresh(signal) }`; snapshot `{ provider, status, windows, refreshedAt }`; window `{ label, percentRemaining, reset? }`. Clamp bars to `0..100`; text fallback is `NN%` plus optional reset. Narrow sidebars truncate labels before values; accessible text includes provider, window label, percent remaining, and reset when present.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | Claude parser, terminal sanitization, window normalization, bar clamp | Fixtures/goldens; no fabricated missing fields. |
| Transport | Pipe-first Claude, PTY decision, Windows unavailable | Fake process; RED proves whether PTY is required; no commands on Windows. |
| Scheduler | Provider isolation, all-provider refresh, gates, single-flight, stale discard | Fake timers and independently failing providers. |
| Component | Toggle, keyboard command, collapsed/expanded snapshots, narrow bars, accessibility | `@solidjs/testing-library`/jsdom plus public API fakes. |
| Behavior harness | Deterministic in-process plugin behavior harness | Source `src/tui.js` is loaded with fake Codex/Claude transport responses; covers registration, refresh, toggle, partial failure, and disposal without credentials, network, auth files, APIs, cookies, fake executables, or packed-package behavior. |
| Package smoke | Package export-shape/import validation | `pnpm smoke:consumer` packs into a temporary consumer and imports the package root plus `/tui`; it does not exercise plugin behavior. |
| Native PTY smoke | Optional native runtime | Clean frozen install followed by dynamic import, harmless local Node PTY spawn, and termination on Ubuntu/macOS CI; no provider credentials or network runtime. |

## Threat Matrix

| Boundary | Applicability | Design response | Planned RED tests |
|---|---|---|---|
| Documentation-like paths | N/A: no executable-file classification. | No path execution. | None. |
| Git repository selection | N/A: no VCS automation. | No git commands. | None. |
| Commit state | N/A. | No commit operations. | None. |
| Push state | N/A. | No push operations. | None. |
| PR commands | N/A. | No PR command composition. | None. |
| CLI subprocess/process integration | Applicable: `codex /status`, `claude /usage`. | `spawn(file,args,{shell:false})`, minimal `PATH`, timeout, abort, output cap, platform gate. Failure clears provider cache only. | Fake process for metacharacters, env redaction, timeout, cancellation, Windows no-exec, Claude pipe/PTY decision. |

## Migration / Rollout

Migrate current Codex `percentage/reset` cache and signal to normalized provider snapshots; stale values are discarded on first PR3 refresh. Rollback is removing the plugin from `tui.json` or reverting PR3 files. Packaging now includes exact optional `node-pty@1.1.0` and a bounded native-build policy; no release automation is included. The old escalated/correction review authority remains historical and unchanged; this packaging authorization prepares a new review target.

## Open Questions / Risks

- Linux native build/load/spawn/terminate is locally proven. macOS support is wired for CI but remains unproven until that matrix passes.
- Native compilation expands install-time supply-chain and toolchain requirements; missing/failed optional native installation must continue to degrade to unavailable.
- `slots.register` has no public unregister in 1.17.18; tests must not assume one.
- Highest risks: Claude output drift, narrow-sidebar readability, accidental credential/env leakage, and over-refactoring dense current files.
