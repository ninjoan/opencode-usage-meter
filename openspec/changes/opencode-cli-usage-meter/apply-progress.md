# Apply Progress: opencode-cli-usage-meter

## Cumulative Status

- Artifact store: hybrid. Mode: Strict TDD. Delivery: stacked-to-main with user-approved `size:exception`.
- Phase 1 tasks 1.1–1.4 and Phase 2 tasks 2.1–2.4 are complete. Phases 3 (Claude/UI/optional PTY) and 4 (release guard) remain pending.
- PR2 excludes Claude, PTY, publishing/release, credentials/auth readers, provider network requests, and all Gentle-AI paths.

## Auditable PR2 Commit Chain

- RED: `7176766` `test(codex): define usage core contracts` — test-only contracts. Focused Vitest exit 1: 10 files failed / 7 tests failed / 3 passed because PR2 modules and public lifecycle behavior were absent. Independently runnable PR1 package contracts: 2 files / 10 tests passed; bootstrap's new lifecycle expectations failed.
- GREEN: `5e6eb8f` `feat(codex): implement usage core runtime` — production implementation, package metadata, docs, and SDD evidence. The preserved full hash is `5e6eb8fcf323cd7b80189c96bd27ada830cf4b06`.

## Completed Phase 2 Tasks

- [x] 2.1 Safe transport and security: shell-free args, minimal environment, executable verification, output cap, timeout/cancel, and per-provider single flight.
- [x] 2.2 Normalized usage model/cache, deterministic provider ordering, backoff gates, and adaptive scheduler/activity events.
- [x] 2.3 Versioned Codex `/status` parser/provider and fail-soft sidebar states.
- [x] 2.4 Public OpenCode slot/runtime wiring, five concrete event unsubscriptions, idempotent disposal, and focused-command-safe tests.

## TDD Cycle Evidence

| Task | Test files | Layer | RED | GREEN | REFACTOR |
|---|---|---|---|---|---|
| 2.1 | `tests/transport/process.spec.ts`, `tests/security/*.spec.ts` | Unit/security | `7176766`: missing transport/provider modules | Focused command passed | Isolated safe transport boundary |
| 2.2 | `tests/scheduler/refresh.spec.ts` | Unit/fake timers | `7176766`: missing model/gates/scheduler/activity modules | Focused command passed; cadence/event/gate paths covered | Activity controller owns transitions |
| 2.3 | `tests/parsers/codex/v1.spec.ts`, `tests/providers/codex.spec.ts`, `tests/component/sidebar-codex.spec.tsx` | Unit/component | `7176766`: missing parser/provider/sidebar modules | Focused command passed | Explicit `PROVIDER_ORDER` keeps ordering deterministic |
| 2.4 | `tests/bootstrap/plugin-load.spec.ts`, `tests/disposal/lifecycle.spec.ts` | Runtime integration | `7176766`: prior tuple API did not provide public slot/lifecycle behavior | Focused command passed; five event unsubscribe callbacks run once | Disposal guards repeated lifecycle/abort callbacks |

## Historical TDD Reconstruction Evidence

| Evidence | Result |
|---|---|
| Preserved RED | `7176766` `test(codex): define usage core contracts` → exit 1; 10 files failed, 7 tests failed, 3 passed because PR2 modules and public lifecycle behavior were absent. |
| Initial GREEN focused test | `pnpm vitest run tests/transport/process.spec.ts tests/security/no-shell.spec.ts tests/security/no-auth-readers.spec.ts tests/security/no-http.spec.ts tests/parsers/codex/v1.spec.ts tests/providers/codex.spec.ts tests/component/sidebar-codex.spec.tsx tests/scheduler/refresh.spec.ts tests/disposal/lifecycle.spec.ts tests/bootstrap/plugin-load.spec.ts` → exit 0; 10 files, 26 tests. No extra `--` was used. |
| Initial GREEN full suite | `pnpm test` → exit 0; 12 files, 33 tests. |
| Historical runtime harness | `pnpm build && pnpm smoke:consumer` → exit 0; packed archive installed in a clean temporary consumer with scripts disabled and both public imports loaded. |
| Rollback boundary | Revert the two PR2 commits: `src/{transport,domain,state,scheduler,gates,diagnostics,parsers/codex,providers,ui,disposal}/**`, `src/tui.tsx`, PR2 tests, package lock/metadata, README, and Phase 2 SDD evidence. PR1 remains independent. |

## Validation

| Command | Result |
|---|---|
| Current focused correction validation | exit 0; 3 files, 16 tests passed |
| Current full suite | `pnpm test` → exit 0; 12 files, 37 tests passed |
| `pnpm typecheck` | exit 0 |
| Current cold-cache consumer smoke | exit 0; packed root and `/tui` imports passed. The temporary npm consumer audit reported 4 low-severity peer-tree vulnerabilities. |
| `pnpm pack:dry-run` | exit 0 |
| Project `pnpm audit --prod` | exit 0; no known production vulnerabilities. This is distinct from the temporary npm consumer audit. |
| `pnpm install --frozen-lockfile --ignore-scripts` | exit 0 |

## Size

- Current PR2 `src/` and PR2 test files: 424 lines. The original Phase 2 workload forecast is high-risk; the user explicitly accepted `size:exception` for this bounded Codex runtime slice.

## Remaining

- [ ] Phase 3: Claude/UI hardening/optional PTY.
- [ ] Phase 4: package verification and release guard.
