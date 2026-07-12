# Tasks: OpenCode CLI Usage Meter

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | PR1 260-340, PR2 360-470, PR3 300-410, PR4 140-220; total 1060-1440 |
| 400-line budget risk | High |
| 800-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR1 prep+package contract -> PR2 Codex core -> PR3 Claude+hardening -> PR4 release guard |
| Delivery strategy | ask-always |
| Workload decision | Approved by user: chained PRs with `stacked-to-main` |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High
800-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Transfer artifacts, switch config to pnpm, and land package contract plus docs/CI. | PR 1 | `pnpm test -- --run tests/bootstrap tests/compat/package-contract.spec.ts` | `pnpm install --frozen-lockfile --ignore-scripts && pnpm build && node -e "await import('./dist/tui.js')"` | `openspec/**`, root tooling, docs, `.github/` |
| 2 | Add Codex slice: safe transport, shared model/state, parser/provider, sidebar states. | PR 2 | `pnpm test -- --run tests/transport tests/parsers/codex tests/component/sidebar-codex.spec.tsx` | `pnpm build && node -e "await import('./dist/tui.js')"` | Codex `src/**` and tests |
| 3 | Add Claude hardening: parser/provider, stale discard, disposal, accessibility, security, optional PTY. | PR 3 | `pnpm test -- --run tests/parsers/claude tests/security tests/disposal tests/component/sidebar-claude.spec.tsx` | `pnpm build && pnpm pack --dry-run` | Claude/PTY/security/disposal files |
| 4 | Add release guard: provenance and manifest/tag/npm consistency. | PR 4 | `pnpm test -- --run tests/compat/release-contract.spec.ts` | `N/A: fixture guard until credentials exist` | Release workflow/config only |

## Phase 1: Preparation and Package Contract
- [x] 1.1 Prep: copy `proposal.md`, `design.md`, `tasks.md`, and `specs/opencode-cli-usage-meter/spec.md` into `/home/user/proyectos/opencode-usage-meter/openspec/`; switch destination commands to pnpm.
- [x] 1.2 RED: add `tests/bootstrap/plugin-load.spec.ts` and `tests/compat/{package-contract,pack-contents}.spec.ts` for `.`/`./tui` -> `dist/tui.js`, files allowlist, Node `>=22.13`, peer ranges, and no `./runtime`.
- [x] 1.3 GREEN: create `package.json` with exact engine/peer ranges, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `src/tui.tsx`, docs, and `.github/ISSUE_TEMPLATE/bug-report.md`.
- [x] 1.4 REFACTOR: wire `pnpm {typecheck,test,build,audit:prod}` and frozen/ignore-scripts CI install.

## Phase 2: Codex Core Slice
- [ ] 2.1 RED: add `tests/transport/process.spec.ts` and `tests/security/{no-shell,no-auth-readers,no-http}.spec.ts` for safe args, minimal env, timeout/cancel, and single-flight.
- [ ] 2.2 GREEN: implement `src/{transport/process.ts,domain/usage.ts,state/cache.ts,scheduler/refresh.ts,gates/provider-gates.ts,diagnostics/redaction.ts}`.
- [ ] 2.3 RED: add `tests/parsers/codex/v1.spec.ts`, `tests/providers/codex.spec.ts`, and `tests/component/sidebar-codex.spec.tsx` for `/status`, cadence, order, and exact `Data unavailable`.
- [ ] 2.4 GREEN/REFACTOR: implement `src/{parsers/codex/v1.ts,providers/codex.ts,ui/sidebar.tsx,ui/sidebar-section.tsx,disposal/index.ts}`.

## Phase 3: Claude, UI Hardening, Optional PTY
- [ ] 3.1 RED: add `tests/parsers/claude/v1.spec.ts`, `tests/providers/claude.spec.ts`, and `tests/transport/pty-decision.spec.ts` proving pipes fail before any `src/transport/pty.ts` lands.
- [ ] 3.2 GREEN: implement `src/{parsers/claude/v1.ts,providers/claude.ts}` and add `src/transport/pty.ts` only if 3.1 shows supported output needs PTY.
- [ ] 3.3 RED: add `tests/{disposal/lifecycle,component/sidebar-claude,component/sidebar-a11y,platform/windows-unavailable}.spec.tsx` for cleanup, stale discard, accessibility, and Windows unsupported behavior.
- [ ] 3.4 GREEN/REFACTOR: finalize `src/tui.tsx` and `src/ui/*` fail-soft states and cleanup.

## Phase 4: Package Verification and Release Guard
- [ ] 4.1 RED: add `tests/compat/{built-package-smoke,ci-install,release-contract}.spec.ts` for import smoke, `pnpm pack --dry-run`, frozen install, and manifest/tag/npm consistency.
- [ ] 4.2 GREEN/REFACTOR: make `pnpm {typecheck,test,build,audit:prod}` and `pnpm pack --dry-run` pass; stage semantic-release/npm provenance workflow/config as PR 4.
