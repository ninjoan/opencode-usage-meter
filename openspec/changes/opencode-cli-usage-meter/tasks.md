# Tasks: OpenCode CLI Usage Meter

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | PR3 without PTY 620-760; conditional PTY slice +110-180; PR4 release guard 140-220 |
| 400-line budget risk | High |
| 800-line budget risk | Medium without PTY / High with PTY |
| Chained PRs recommended | Yes |
| Suggested split | PR1 prep -> PR2 Codex -> PR3 Claude+multi-provider UI; conditional follow-up PR only if PTY RED proves needed; then Phase 4 release guard |
| Delivery strategy | stacked-to-main already approved; PR2 `size:exception` was PR2-only; corrective PR3 `size:exception` explicitly approved after Phase 3 contract retry |
| Chain strategy | stacked-to-main |
| Exact PR3 boundary | Units 3A-3D plus newly authorized 3E packaging policy; old correction authority remains unchanged and this prepares a new review target |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High
800-line budget risk: Medium

### Suggested Work Units

| Unit | Est. lines | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---:|---|---|---|---|---|
| 3A | 150-210 | Migrate domain/registry and Codex snapshot model to multi-provider windows. | PR3 | `pnpm test -- --run tests/providers tests/scheduler/refresh.spec.ts` | `pnpm test -- --run tests/providers/codex.spec.ts tests/scheduler/refresh.spec.ts` | `src/domain/usage.ts`, `src/providers/registry.ts`, Codex/provider model tests |
| 3B | 140-190 | Add sanitized Claude fixtures/goldens, parser, provider, and official `/usage` fake transport. | PR3 | `pnpm test -- --run tests/parsers/claude/v1.spec.ts tests/providers/claude.spec.ts` | `pnpm test -- --run tests/transport/process.spec.ts tests/providers/claude.spec.ts` | `src/parsers/claude/**`, `src/providers/claude.ts`, Claude fixtures/tests |
| 3C | 170-230 | Isolate cache/gates/scheduler/disposal; manual refresh fans out to all providers. | PR3 | `pnpm test -- --run tests/scheduler/refresh.spec.ts tests/disposal/lifecycle.spec.ts` | `pnpm test -- --run tests/disposal/lifecycle.spec.ts` | `src/{state,gates,scheduler,disposal,tui}.ts*`, related tests |
| 3D | 160-220 | Expandable/collapsible sidebar, collapsed summary, rows/bars/clamp/a11y/session toggle, Linux/macOS/Windows, behavior harness/docs. | PR3 | `pnpm test -- --run tests/component tests/platform/windows-unavailable.spec.ts tests/compat/plugin-behavior-harness.spec.ts` | `pnpm vitest run tests/compat/plugin-behavior-harness.spec.ts` | `src/ui/**`, `src/tui.tsx`, component/platform/behavior docs/tests |
| 3E | 110-180 | Bound exact optional native PTY build authority and prove load/spawn/terminate. | New review target | `pnpm vitest run tests/compat/package-contract.spec.ts tests/transport/pty-decision.spec.ts` | Clean isolated install plus `pnpm smoke:pty-native`; no provider network/credentials | package/lock/workspace policy, existing CI/docs/contracts |

## Phase 1: Preparation and Package Contract
- [x] 1.1 Prep: transfer change artifacts into `openspec/` and switch package commands to pnpm.
- [x] 1.2 RED: add `tests/bootstrap/plugin-load.spec.ts` and `tests/compat/{package-contract,pack-contents}.spec.ts`.
- [x] 1.3 GREEN: land package/build/test scaffolding in `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `src/tui.tsx`.
- [x] 1.4 REFACTOR: wire `pnpm {typecheck,test,build,audit:prod}` plus frozen `pnpm install --ignore-scripts` CI.

## Phase 2: Codex Core Slice
- [x] 2.1 RED: add `tests/transport/process.spec.ts` and `tests/security/{no-shell,no-auth-readers,no-http}.spec.ts`.
- [x] 2.2 GREEN: implement `src/{transport/process.ts,domain/usage.ts,state/cache.ts,scheduler/refresh.ts,gates/provider-gates.ts,diagnostics/redaction.ts}`.
- [x] 2.3 RED: add `tests/parsers/codex/v1.spec.ts`, `tests/providers/codex.spec.ts`, `tests/component/sidebar-codex.spec.tsx`.
- [x] 2.4 GREEN/REFACTOR: implement `src/{parsers/codex/v1.ts,providers/codex.ts,ui/sidebar.tsx,ui/sidebar-section.tsx,disposal/index.ts}`.

## Phase 3: Claude + Multi-Provider Sidebar
- [x] 3.1 RED: add `tests/providers/registry.spec.ts`, expand `tests/providers/codex.spec.ts`/`tests/scheduler/refresh.spec.ts`, and fail on provider-ordered windows, isolated gates, stale discard, and all-provider `usage.refresh`.
- [x] 3.2 GREEN: migrate `src/domain/usage.ts`, create `src/providers/registry.ts`, and update `src/providers/codex.ts`, `src/state/cache.ts`, `src/gates/provider-gates.ts`, `src/scheduler/refresh.ts`.
- [x] 3.3 RED: add sanitized `tests/parsers/claude/v1.spec.ts`, `tests/providers/claude.spec.ts`, fixture/golden files, and `tests/transport/pty-decision.spec.ts` recording fixture-scoped pipe evidence before any PTY code.
- [x] 3.4 GREEN: create `src/parsers/claude/v1.ts` and `src/providers/claude.ts`; add `src/transport/pty.ts` only if 3.3 RED proves required.
- [x] 3.5 RED: add `tests/component/{sidebar-multiprovider,sidebar-a11y,toggle}.spec.tsx`, `tests/platform/windows-unavailable.spec.ts`, and extend `tests/disposal/lifecycle.spec.ts` for collapse state, clamped bars, public toggle action, Windows no-exec, and inert disposal.
- [x] 3.6 GREEN/REFACTOR: update `src/tui.tsx`, `src/ui/{sidebar,sidebar-section}.tsx`, and `src/disposal/index.ts` for expandable rows, collapsed `1/2` summary, accessible labels, and session-only state.
- [x] 3.7 RED/GREEN: add `tests/compat/plugin-behavior-harness.spec.ts` deterministic in-process plugin behavior harness with fake Codex/Claude transport; cover registration, refresh, toggle, partial failure, and disposal without real credentials/network, fake executables, or packed-package execution.
- [x] 3.8 RED/GREEN: replace defective `node-pty@1.1.0` with exact `1.2.0-beta.12`, authorize only its native build, prove no CI `chmod` workaround, preserve the consumer `--ignore-scripts` boundary, and wire Ubuntu/macOS native PTY smoke for a new review target. Linux is locally proven; macOS remains pending CI.

## Phase 4: Package Verification and Release Guard
- [ ] 4.1 RED: add package export-shape/import, frozen install, `pnpm pack --dry-run`, and manifest/tag/npm consistency checks without claiming plugin behavior coverage from package smoke.
- [ ] 4.2 GREEN/REFACTOR: make `pnpm {typecheck,test,build,audit:prod}` and `pnpm pack --dry-run` pass; stage semantic-release/npm provenance workflow/config.
