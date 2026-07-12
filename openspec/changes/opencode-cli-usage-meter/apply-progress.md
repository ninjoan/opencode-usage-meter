# Apply Progress: opencode-cli-usage-meter

## Cumulative Status

- Artifact store: hybrid. Mode: Strict TDD. Delivery: stacked-to-main. PR2 retains its historical user-approved `size:exception`; corrective PR3 now uses an explicitly approved `size:exception` beyond 800 lines.
- Phase 1 tasks 1.1–1.4, Phase 2 tasks 2.1–2.4, and Phase 3 tasks 3.1–3.7 are complete. Phase 4 (release guard) remains pending.
- The newly authorized Phase 3E permits exact optional `node-pty@1.1.0` native builds for Linux/macOS fallback. Publishing/release automation, credentials/auth readers, provider network requests, and all Gentle-AI paths remain excluded. Old escalated/correction authority is unchanged; this is preparation for a new review target.

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
| Historical package export smoke | `pnpm build && pnpm smoke:consumer` → exit 0; packed archive installed in a clean temporary consumer with scripts disabled and both public imports loaded. This validates export shape/import only, not plugin behavior. |
| Rollback boundary | Revert the two PR2 commits: `src/{transport,domain,state,scheduler,gates,diagnostics,parsers/codex,providers,ui,disposal}/**`, `src/tui.tsx`, PR2 tests, package lock/metadata, README, and Phase 2 SDD evidence. PR1 remains independent. |

## Completed Phase 3 Tasks

- [x] 3.1 RED provider registry, Codex window migration, isolated scheduler/cache/gate, stale discard, and all-provider `usage.refresh` tests.
- [x] 3.2 GREEN explicit provider registry and normalized Codex multi-window model.
- [x] 3.3 RED sanitized Claude parser/provider fixtures plus fixture-scoped pipe-vs-PTY decision test.
- [x] 3.4 GREEN Claude parser/provider over `claude /usage` fixture output through safe fake transport; no PTY file or dependency added.
- [x] 3.5 RED multi-provider sidebar, a11y/clamp, toggle, Windows no-exec, lifecycle/inert-disposal, provider-isolated unavailable rows, narrow text, and mocked acceptance tests.
- [x] 3.6 GREEN/REFACTOR expandable/collapsible public TUI sidebar, all provider windows, bars, accessible text, session-memory toggle, and disposal cleanup.
- [x] 3.7 RED/GREEN deterministic in-process plugin behavior harness with fake Codex/Claude transport for registration, refresh, toggle, partial failure, and disposal; no real credentials/network, fake executables, or packed-package execution.

## PR3 TDD Cycle Evidence

| Task | Test files | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 3.1 | `tests/providers/registry.spec.ts`, `tests/providers/codex.spec.ts`, `tests/scheduler/refresh.spec.ts` | Unit/fake timers | `pnpm test -- --run tests/providers/codex.spec.ts tests/scheduler/refresh.spec.ts tests/disposal/lifecycle.spec.ts tests/component/sidebar-codex.spec.tsx tests/bootstrap/plugin-load.spec.ts tests/transport/process.spec.ts` → exit 0; 12 files, 38 tests | `pnpm vitest run tests/providers/registry.spec.ts tests/providers/codex.spec.ts tests/scheduler/refresh.spec.ts` → exit 1; missing registry/labels and 7 failed behavior checks | `pnpm vitest run tests/providers tests/scheduler/refresh.spec.ts` → exit 0; 4 files, 12 tests | Provider ordering, host non-inference, stale discard, partial failure, and all-provider fanout | Compact registry/domain without changing behavior; `pnpm typecheck` exit 0 |
| 3.2 | Same as 3.1 | Unit/fake timers | Covered by 3.1 safety net | Same RED as 3.1 | Same GREEN as 3.1; registry/domain/Codex/scheduler implemented | Codex 5h+weekly windows and unavailable paths covered | Source compacted to remain under PR3 800-line budget |
| 3.3 | `tests/parsers/claude/v1.spec.ts`, `tests/providers/claude.spec.ts`, `tests/transport/pty-decision.spec.ts` | Unit/transport decision | `pnpm vitest run tests/transport/process.spec.ts` remained covered by existing suite | `pnpm vitest run tests/transport/pty-decision.spec.ts` → exit 1; 1 failed suite, 0 tests, missing `src/providers/claude.js`; combined PR3 RED exit 1; 12 files failed, 14 failed/2 passed | `pnpm vitest run tests/parsers/claude/v1.spec.ts tests/providers/claude.spec.ts` → exit 0; 2 files, 5 tests; `pnpm vitest run tests/transport/pty-decision.spec.ts` → exit 0; 1 file, 2 tests | Basic, per-model, malformed, Windows, and no-PTY dependency cases | Shared terminal sanitizer reused by Codex/Claude |
| 3.4 | Same as 3.3 | Unit/transport | Covered by 3.3 safety net | Same RED as 3.3 | Same GREEN as 3.3; no `src/transport/pty.ts` created | Fixture-backed SafeProcessTransport pipe path parses supported `/usage` output | No PTY code or package dependency added |
| 3.5 | `tests/component/sidebar-multiprovider.spec.tsx`, `tests/component/sidebar-a11y.spec.tsx`, `tests/component/toggle.spec.tsx`, `tests/platform/windows-unavailable.spec.ts`, `tests/disposal/lifecycle.spec.ts` | Component/runtime lifecycle | Baseline safety net above | Corrective RED: `pnpm vitest run tests/component/sidebar-multiprovider.spec.tsx tests/component/sidebar-a11y.spec.tsx tests/bootstrap/plugin-load.spec.ts tests/compat/plugin-behavior-harness.spec.ts tests/transport/pty-decision.spec.ts` → exit 1; expanded renderer omitted weekly/per-model windows and behavior harness coverage | Corrective GREEN: same focused command → exit 0; 5 files, 15 tests; lifecycle focused remains exit 0; 1 file, 2 tests | Mixed availability, no data, clamp high/low, all windows, narrow text, toggle default/session reset, Windows no-exec, inert disposal | Render helpers now format expanded multi-window details |
| 3.6 | Same as 3.5 plus `tests/bootstrap/plugin-load.spec.ts` | Component/runtime lifecycle | Baseline safety net above | Corrective RED above | Full suite `pnpm test` → exit 0; 20 files, 54 tests | Expanded/default, collapsed `1/2`, exact `Data unavailable`, public `usage.toggle`, public `usage.refresh` fanout, provider-isolated failures | Dense TUI/sidebar modules refactored only enough to share `formatSidebarBody` |
| 3.7 | `tests/compat/plugin-behavior-harness.spec.ts`; package export smoke remains separate | In-process behavior harness | Existing package-contract/pack-contents tests passed in safety net | Corrective RED above: docs-only assertion did not exercise behavior | Corrective GREEN: deterministic in-process TUI harness passes; `pnpm smoke:consumer` separately validates package root and `/tui` export-shape/import with exit 0 | Harness covers fake Codex/Claude transport, registration, refresh, expanded/collapsed rendering, one-provider failure, manual actions, and cleanup | Removed docs-only acceptance assertion and renamed misleading package-smoke file |

## PR3 Corrective Retry Evidence

| Blocker | RED | GREEN |
|---|---|---|
| Public expanded sidebar rendered only first summaries | `pnpm vitest run tests/component/sidebar-multiprovider.spec.tsx tests/component/sidebar-a11y.spec.tsx tests/bootstrap/plugin-load.spec.ts tests/compat/plugin-behavior-harness.spec.ts tests/transport/pty-decision.spec.ts` → exit 1; 4 files failed, 5 tests failed because weekly/per-model details and `formatSidebarBody` were absent | Same command → exit 0; 5 files, 15 tests. Expanded public renderer now includes every supplied provider window, bars, text, reset metadata, and accessibleText. |
| Behavior acceptance was README-only and later misnamed as package smoke | Corrective RED above failed because the in-process TUI harness expected behavior and cleanup, not README strings | `tests/compat/plugin-behavior-harness.spec.ts` exercises source `src/tui.js` with fake Codex/Claude transport, registration, all-provider refresh, expanded/collapsed UI, one-provider failure isolation, manual actions, and disposal without real providers, fake executables, or packed-package execution. |
| PTY evidence overclaimed real CLI behavior | Existing wording claimed pipes were sufficient generally while RED only proved the Claude module was missing | `tests/transport/pty-decision.spec.ts` wording and apply-progress now scope the decision to sanitized fixture output through SafeProcessTransport pipes; real CLI TTY behavior remains a follow-up runtime validation risk. |

## PR3 Work Unit Evidence

| Unit | Focused test command and result | Runtime harness command/scenario and result | Rollback boundary |
|---|---|---|---|
| 3A | `pnpm vitest run tests/providers tests/scheduler/refresh.spec.ts` → exit 0; 4 files, 12 tests | `pnpm vitest run tests/providers/codex.spec.ts tests/scheduler/refresh.spec.ts` → exit 0; 2 files, 8 tests | `src/domain/usage.ts`, `src/providers/registry.ts`, `src/providers/codex.ts`, `src/scheduler/refresh.ts`, provider/scheduler tests |
| 3B | `pnpm vitest run tests/parsers/claude/v1.spec.ts tests/providers/claude.spec.ts` → exit 0; 2 files, 5 tests | `pnpm vitest run tests/transport/process.spec.ts tests/providers/claude.spec.ts` → exit 0; 2 files, 10 tests | `src/parsers/claude/**`, `src/providers/claude.ts`, `src/parsers/terminal.ts`, Claude fixtures/provider/parser/PTY decision tests |
| 3C | `pnpm vitest run tests/scheduler/refresh.spec.ts tests/disposal/lifecycle.spec.ts` → exit 0; 2 files, 8 tests | `pnpm vitest run tests/disposal/lifecycle.spec.ts` → exit 0; 1 file, 2 tests | `src/scheduler/refresh.ts`, `src/tui.tsx`, `src/ui/**`, disposal/lifecycle tests |
| 3D | `pnpm vitest run tests/component tests/platform/windows-unavailable.spec.ts tests/compat/plugin-behavior-harness.spec.ts` → exit 0; 5 files, 8 tests | `pnpm vitest run tests/compat/plugin-behavior-harness.spec.ts` → exit 0; source TUI plugin imported with fake Codex/Claude transport and covered registration, refresh, toggle, partial failure, and disposal | `src/ui/**`, `src/tui.tsx`, `README.md`, component/platform/compat tests |

## PR3 PTY Decision And Phase 3E Packaging

- Historical RED: `pnpm vitest run tests/transport/pty-decision.spec.ts` initially failed before production code with missing `src/providers/claude.js`; that RED did not prove real CLI TTY behavior.
- Current GREEN: the same command passed (1 file, 2 tests), proving sanitized fixture-backed `claude /usage` output parses through SafeProcessTransport's plain-pipe path.
- Subsequent bounded correction added pipe-first dynamic PTY fallback in existing `src/transport/process.ts`; missing native support degrades to unavailable.
- Runtime-isolation RED: bootstrap, behavior-harness, and PTY-focused tests exited 1 under the default 5-second timeout because injected unparseable pipe success still reached the real PTY; 3 tests failed and both harness tests timed out. GREEN: `createUsageMeterTuiPlugin` accepts an injected PTY transport/factory, injected transport takes precedence, missing PTY remains unavailable, and the production default remains wired to `createPtyProcessTransport`.
- New-scope authorization pins exact `node-pty@1.1.0` and changes only `allowBuilds.node-pty` from false to true. Existing build allowances and frozen-lock integrity remain unchanged.
- Contract RED: `pnpm vitest run tests/compat/package-contract.spec.ts` exited 1 with 2 failures for the caret pin and absent native smoke/CI wiring. GREEN: package contract plus PTY decision passed, 2 files / 13 tests.
- Linux cold proof: isolated workspace/store install ran node-gyp, dynamically imported node-pty, spawned a harmless local Node PTY, and terminated it. Toolchain: Python 3.14.3, GCC C++ 13.3.0, GNU Make 4.3. macOS is CI-wired but not locally proven.

## Historical PR2 Validation

| Command | Result |
|---|---|
| Current focused correction validation | exit 0; 3 files, 16 tests passed |
| Current full suite | `pnpm test` → exit 0; 12 files, 37 tests passed |
| `pnpm typecheck` | exit 0 |
| Current cold-cache consumer smoke | exit 0; packed root and `/tui` imports passed. The temporary npm consumer audit reported 4 low-severity peer-tree vulnerabilities. |
| `pnpm pack:dry-run` | exit 0 |
| Project `pnpm audit --prod` | exit 0; no known production vulnerabilities. This is distinct from the temporary npm consumer audit. |
| `pnpm install --frozen-lockfile --ignore-scripts` | exit 0 |

## PR3 Validation

| Command | Result |
|---|---|
| Pre-rename approval safety net | The legacy misnamed harness path passed before the move: exit 0; 1 file, 1 test. The current persisted harness path is `tests/compat/plugin-behavior-harness.spec.ts`. |
| Focused behavior harness | `pnpm vitest run tests/compat/plugin-behavior-harness.spec.ts` → exit 0; 1 file, 1 test passed. |
| Focused Phase 3 UI/platform/behavior slice | `pnpm vitest run tests/component tests/platform/windows-unavailable.spec.ts tests/compat/plugin-behavior-harness.spec.ts` → exit 0; 5 files, 8 tests passed. |
| Runtime-isolation focused GREEN | `pnpm exec vitest run tests/bootstrap/plugin-load.spec.ts tests/compat/plugin-behavior-harness.spec.ts tests/transport/pty-decision.spec.ts` → exit 0 under the default 5-second timeout; 3 files, 14 tests passed in 389ms. Unparseable fake pipe output delegated only to injected fake PTY, and the harness PTY factory was not called. |
| PTY-focused suite | `pnpm exec vitest run tests/transport/pty-decision.spec.ts` → exit 0; 1 file, 6 tests passed. |
| `pnpm test` | exit 0; 20 files, 70 tests passed for the current PR3 review-target snapshot. |
| `pnpm typecheck` | exit 0. |
| `pnpm build && pnpm smoke:consumer` | exit 0; build produced `dist/tui.js` 72.05 KB, `dist/tui.js.map` 142.53 KB, and `dist/tui.d.ts` 3.52 KB; temp npm consumer imported package root and `/tui`. npm reported `EBADENGINE` for transitive `ini@7.0.0`, deprecated `glob@9.3.5`, and 4 low-severity temp peer-tree vulnerabilities. This is package export-shape/import validation only, not plugin behavior. |
| `pnpm smoke:pty-native` | exit 0; native `node-pty` spawned and terminated only a harmless local Node process. |
| `pnpm pack:dry-run` | exit 0; package contains `dist/tui.d.ts`, `dist/tui.js`, `dist/tui.js.map`, `LICENSE`, `package.json`, `README.md`, `SECURITY.md`. |
| `pnpm audit:prod` | exit 0; no known production vulnerabilities |
| `pnpm install --frozen-lockfile` | exit 0; already up to date with pnpm 11.2.0 |

## PR3 Post-Escalation Defect Correction

- Historical lineage remains unchanged and escalated; this uncommitted correction prepares a NEW review target only. No commit, push, publish, Phase 4 work, or review-authority mutation was performed.
- RED: `pnpm exec vitest run tests/compat/plugin-behavior-harness.spec.ts tests/transport/pty-decision.spec.ts` exited 1; 2 files failed, 2 tests failed. Rejected Claude refresh retained its stale UI snapshot, and failed pipe stderr could not signal a TTY requirement because the transport exposed no stderr callback/classification.
- GREEN: `pnpm exec vitest run tests/compat/plugin-behavior-harness.spec.ts tests/transport/pty-decision.spec.ts tests/transport/process.spec.ts tests/scheduler/refresh.spec.ts` exited 0; 4 files, 23 tests passed. Scheduler cache and TUI receive the same unavailable snapshot on rejection while valid Codex data remains. Failed pipe stderr is bounded to 8 KiB, terminal-sanitized, reduced to `requiresTerminal: true`, and never returned as raw text.
- Full proof: `src/providers/claude.ts` exists at 36 lines; `pnpm test` exited 0 with 20 files/62 tests; typecheck, build, packed consumer smoke, native PTY smoke, dry-run pack, production audit, frozen install, and `git diff --check` all exited 0.
- Transport triangulation: TTY-required stderr on a nonzero pipe exit invokes injected PTY and parses fixture output; unrelated or out-of-bound TTY text does not invoke PTY. Existing output-cap, timeout, cancellation, single-flight, shell-free argument, minimal-environment, executable-verification, and Windows tests remain green.

## Size

- Current PR2 `src/` and PR2 test files: 424 lines. The original Phase 2 workload forecast is high-risk; the user explicitly accepted `size:exception` for this bounded Codex runtime slice.
- Current NEW PR3 review-target authored source/test/docs impact: 1,110 changed lines (`README.md`, `src/**`, `tests/**`: 1,034 additions, 76 deletions). This combines tracked worktree changes (505 additions, 76 deletions) with 529 lines in untracked Phase 3 files that ordinary `git diff` omits. The independently measured snapshot covers 26 tracked changed paths and 15 untracked files, 41 paths total. The approved corrective PR3 `size:exception` remains in force; `dist/` build output and SDD artifacts are excluded.

## Remaining

- [x] Phase 3: Claude/UI hardening, mock acceptance, pipe-first PTY fallback, and exact native-build packaging policy complete.
- [x] Phase 3E: exact dependency/build authority, safe degradation contract, Linux native proof, and Ubuntu/macOS CI matrix wired for the new review target.
- [ ] Follow-up risk: obtain macOS CI runtime evidence; do not infer it from local Linux proof.
- [ ] Phase 4: package verification and release guard.
