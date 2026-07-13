# Apply Progress: opencode-cli-usage-meter

## Cumulative Status

- Artifact store: hybrid. Mode: Strict TDD. Delivery: stacked-to-main. PR2 retains its historical user-approved `size:exception`; corrective PR3 now uses an explicitly approved `size:exception` beyond 800 lines.
- Phase 1 tasks 1.1–1.4, Phase 2 tasks 2.1–2.4, Phase 3 tasks 3.1–3.8, and Phase 4 tasks 4.1–4.2 are complete. All 18 tasks are complete.
- The newly authorized Phase 3E permits exact optional `node-pty@1.2.0-beta.12` native builds for Linux/macOS fallback. Version 1.1.0 is rejected because its published macOS arm64 `spawn-helper` lacked executable mode; no `chmod` workaround is allowed. Publishing/release automation, credentials/auth readers, provider network requests, and all Gentle-AI paths remain excluded. Old escalated/correction authority is unchanged; this is preparation for a new review target.

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
- New-scope authorization pins exact `node-pty@1.2.0-beta.12`; `allowBuilds` remains package-scoped to `node-pty`, `esbuild`, and `msgpackr-extract`. Existing build allowances and frozen-lock integrity remain unchanged.
- Contract RED: `pnpm vitest run tests/compat/package-contract.spec.ts` exited 1 with 2 failures for the caret pin and absent native smoke/CI wiring. GREEN: package contract plus PTY decision passed, 2 files / 13 tests.
- Linux cold proof: isolated workspace/store install ran node-gyp, dynamically imported node-pty, spawned a harmless local Node PTY, and terminated it. Toolchain: Python 3.14.3, GCC C++ 13.3.0, GNU Make 4.3. macOS is CI-wired but not locally proven.
- Beta correction RED: `pnpm exec vitest run tests/compat/package-contract.spec.ts` exited 1; 1 failed / 7 passed because the manifest still declared 1.1.0. GREEN: package contract plus PTY decision exited 0; 2 files / 15 tests. The contract requires the exact beta in manifest/lock and forbids `chmod` in the native script and CI workflow.
- Registry metadata and tarball inspection agree on integrity `sha512-uExTCG/4VmSJa4+TjxFwPXv8BfacmfFEBL6JpxCMDghcwqzvD0yTcGmZ1fKOK6HY33tp0CelLblqTECJizc+Yw==`; published Darwin arm64/x64 `spawn-helper` entries are both `0755`. This is inspectable packaging evidence, not macOS runtime success.
- The beta resolves the known packaging mode defect but adds prerelease supply-chain/stability risk. Exact pinning, lock integrity, package-scoped build authority, cold Linux proof, and pending macOS CI proof bound that risk.

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

## Exact Node-PTY Beta Correction Validation

| Evidence | Result |
|---|---|
| Focused GREEN | `pnpm exec vitest run tests/compat/package-contract.spec.ts tests/transport/pty-decision.spec.ts` -> exit 0; 2 files / 15 tests passed. |
| Cold Linux native proof | Fresh isolated workspace and store: frozen install selected `node-pty@1.2.0-beta.12`, build passed, and `pnpm smoke:pty-native` imported the addon, spawned a harmless local Node PTY, killed it, and observed exit. |
| Full validation | `pnpm test` -> 20 files / 70 tests; typecheck, build, packed consumer root and `/tui` imports, native PTY smoke, dry-run pack, production audit, frozen install, and `git diff --check` all exited 0. The temporary npm consumer still reported 4 low-severity peer-tree vulnerabilities; project production audit reported none. |
| macOS boundary | Tarball mode inspection proves both Darwin helpers are packaged `0755`; runtime success remains pending the existing macOS CI matrix and is not claimed here. |

## Completed Phase 4 Tasks

- [x] 4.1 RED package/release readiness contracts for semantic-release public npm provenance, no long-lived token workflow, package export/archive boundaries, frozen install, dry-run pack, manifest/tag/npm consistency, and corrective trusted-publishing Node/npm runtime checks. Partial pre-run changes already contained `tests/compat/release-contract.spec.ts`, `.releaserc.json`, `.github/workflows/release.yml`, `scripts/release-guard.mjs`, package metadata/scripts, and docs; no prior RED chronology was available, so only the inspected baseline and new behavior-first REDs are claimed.
- [x] 4.2 GREEN/REFACTOR release-readiness staging: package metadata uses public provenance config, CI runs `release:guard` under read-only permissions, release workflow is main-push-only with job-scoped `contents: write` + `id-token: write`, semantic-release is pinned to `25.0.1`, release workflow pins Node `22.14.0` and installs exact npm `11.5.1`, release guard checks manifest/tag/npm/runtime/workflow/export/archive invariants, and docs/security state no local publish, tags, long-lived npm tokens, or missing external npm trusted-publisher setup.

## Phase 4 TDD Cycle Evidence

| Task | Test files | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 4.1 | `tests/compat/release-contract.spec.ts`, existing `tests/compat/package-contract.spec.ts`, `tests/compat/pack-contents.spec.ts` | Package/release contract | Existing partial baseline after cancelled run: `pnpm exec vitest run tests/compat/release-contract.spec.ts` -> exit 0; 1 file, 3 tests. `pnpm release:guard` -> exit 0; `Release guard passed`. This validates partial handoff state only; it is not claimed as historical RED. | New behavior-first RED: added least-privilege/PR-publish contract, then `pnpm exec vitest run tests/compat/release-contract.spec.ts` -> exit 1; 1 failed / 3 passed because `.github/workflows/ci.yml` lacked top-level `permissions:\n  contents: read`. | `pnpm exec vitest run tests/compat/release-contract.spec.ts` -> exit 0; 1 file, 4 tests after adding CI read-only permissions and extending `scripts/release-guard.mjs`. | Four release contract scenarios cover provenance/no long-lived token, manifest/tag/npm guard, least-privilege/no PR publish, and package smoke/archive scope; existing package/pack contracts cover exports and allowlisted package contents. | Centralized package files/exports/workflow trigger/least-privilege assertions in `scripts/release-guard.mjs`; no behavior change after GREEN (`pnpm release:guard` exit 0). |
| 4.2 | Same plus `.github/workflows/{ci,release}.yml`, `.releaserc.json`, `package.json`, README/SECURITY | Workflow/package config | Same inspected partial baseline; no additional pre-run chronology available. | Same new behavior-first RED as 4.1 for missing CI least privilege; release workflow PR-publish prohibition already passed in the partial handoff. | Full validation chain passed: `pnpm typecheck && pnpm test && pnpm build && pnpm smoke:consumer && pnpm smoke:pty-native && pnpm pack:dry-run && pnpm audit:prod && pnpm install --frozen-lockfile && pnpm install --frozen-lockfile --ignore-scripts && pnpm release:guard && git diff --check` -> exit 0. | Release dry-run triangulation: `pnpm release:dry-run` -> exit 0; semantic-release 25.0.1 reported branch `chore/release-readiness` is not configured to publish, so no version would be published. `npm pack --json --dry-run --ignore-scripts` listed exactly 7 entries: `LICENSE`, `README.md`, `SECURITY.md`, `dist/tui.d.ts`, `dist/tui.js`, `dist/tui.js.map`, `package.json`. | Reworked partial guard to enforce CI read-only permissions, main-only release trigger, no PR publish trigger, and package contents/exports in one executable guard. |

## Phase 4 Corrective Retry Evidence

| Blocker | RED | GREEN |
|---|---|---|
| Trusted publishing runtime was below npm OIDC requirements | Corrective RED: `pnpm exec vitest run tests/compat/release-contract.spec.ts` -> exit 1; 1 failed / 4 passed because release workflow pinned Node `22.13` and did not install exact npm `11.5.1`. npm docs require Node `>=22.14.0` and npm CLI `>=11.5.1` for trusted publishing. | `pnpm exec vitest run tests/compat/release-contract.spec.ts && pnpm release:guard` -> exit 0; 1 file / 5 tests plus guard passed. `.github/workflows/release.yml` now pins Node `22.14.0`, installs exact `npm@11.5.1`, verifies `npm --version`, preserves exact `corepack@0.34.7` and `pnpm@11.2.0`, and keeps semantic-release as the only publish path. |
| External npm trusted-publisher setup and pre-first-release package lookup were undocumented | Corrective RED above expected README support text and failed until docs were added. | README now states npm trusted publisher setup remains required in npm package settings and pre-first-release package lookup may return `E404` until the first publish. SECURITY notes the external setup prerequisite while continuing to forbid tokens/direct publish. |
| Line accounting overreported/underreported total | Fresh validation measured the pre-correction total as 433 lines: 30 tracked non-SDD + 353 untracked Phase4 + 50 SDD, not 431. | Final post-correction measured counts are recorded in the Size section below; the prior 383 non-SDD baseline is preserved as historical, and the corrected Node/npm/docs/test edits increased the current non-SDD total. |

## Phase 4 Work Unit Evidence

| Unit | Focused test command and result | Runtime harness command/scenario and result | Rollback boundary |
|---|---|---|---|
| 4.1-4.2 release guard | `pnpm exec vitest run tests/compat/release-contract.spec.ts` -> exit 0; 1 file, 5 tests. `pnpm release:guard` -> exit 0; `Release guard passed`. | Non-publishing runtime/delivery harness: full chain above exited 0; `pnpm test` included 21 files, 76 passed / 1 skipped. `pnpm release:dry-run` exited 0 and explicitly did not publish from `chore/release-readiness`. `npm pack --json --dry-run --ignore-scripts` reported 7 allowlisted entries and no bundled files. | Revert `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `.releaserc.json`, `package.json`, `scripts/release-guard.mjs`, `tests/compat/release-contract.spec.ts`, README/SECURITY release guard docs, and Phase 4 SDD checkbox/evidence updates without touching Phase 1-3 runtime implementation. |

## Phase 4 Validation

| Command | Result |
|---|---|
| Partial handoff focused baseline | `pnpm exec vitest run tests/compat/release-contract.spec.ts` -> exit 0; 1 file, 3 tests. |
| Partial handoff guard baseline | `pnpm release:guard` -> exit 0; `Release guard passed`. |
| New RED | `pnpm exec vitest run tests/compat/release-contract.spec.ts` -> exit 1; 1 failed / 3 passed, missing CI read-only permissions. |
| Corrective runtime RED | `pnpm exec vitest run tests/compat/release-contract.spec.ts` -> exit 1; 1 failed / 4 passed, release workflow used Node `22.13` and lacked exact npm `11.5.1`. |
| Focused GREEN | `pnpm exec vitest run tests/compat/release-contract.spec.ts` -> exit 0; 1 file, 5 tests. |
| Full suite | `pnpm test` -> exit 0; 21 files, 76 passed / 1 skipped. |
| Typecheck | `pnpm typecheck` -> exit 0. |
| Build | `pnpm build` -> exit 0; `dist/tui.js` 72.53 KB, `dist/tui.js.map` 165.44 KB, `dist/tui.d.ts` 3.61 KB. |
| Consumer package smoke | `pnpm smoke:consumer` -> exit 0; temporary npm consumer imported package root and `/tui`. npm temp audit still reported 4 low-severity peer-tree vulnerabilities plus transitive `ini@7.0.0` EBADENGINE and deprecated `glob@9.3.5`; project production audit is clean. |
| Native PTY smoke | `pnpm smoke:pty-native` -> exit 0; native `node-pty` imported, spawned, and terminated a harmless local Node PTY. |
| Pack dry-run | `pnpm pack:dry-run` -> exit 0; package contains `dist/tui.d.ts`, `dist/tui.js`, `dist/tui.js.map`, `LICENSE`, `package.json`, `README.md`, `SECURITY.md`. |
| npm tarball inspection | `npm pack --json --dry-run --ignore-scripts` -> exit 0; 7 entries, no bundled files, integrity `sha512-yH24i9Lzwgvo59SaS8J784oQHCBATeT5szRBij1lzwymnElww4zj3Pg0Mev0CEYJt1zC+7FDiHhDFzE163SOwg==`. |
| Project production audit | `pnpm audit:prod` -> exit 0; no known vulnerabilities. |
| Frozen install | `pnpm install --frozen-lockfile` -> exit 0; already up to date. |
| Frozen no-script install | `pnpm install --frozen-lockfile --ignore-scripts` -> exit 0; already up to date. |
| Release dry-run | `pnpm release:dry-run` -> exit 0; semantic-release 25.0.1 loaded npm/commit-analyzer/release-notes plugins and reported the current branch is not configured to publish. |
| Secret/workflow scan | Workflow-only grep for long-lived token names, direct `npm publish`, `pull_request_target`, and broad write permissions found no matches. |
| Diff hygiene | `git diff --check` -> exit 0. |

## PR3 Post-Escalation Defect Correction

- Historical lineage remains unchanged and escalated; this uncommitted correction prepares a NEW review target only. No commit, push, publish, Phase 4 work, or review-authority mutation was performed.
- RED: `pnpm exec vitest run tests/compat/plugin-behavior-harness.spec.ts tests/transport/pty-decision.spec.ts` exited 1; 2 files failed, 2 tests failed. Rejected Claude refresh retained its stale UI snapshot, and failed pipe stderr could not signal a TTY requirement because the transport exposed no stderr callback/classification.
- GREEN: `pnpm exec vitest run tests/compat/plugin-behavior-harness.spec.ts tests/transport/pty-decision.spec.ts tests/transport/process.spec.ts tests/scheduler/refresh.spec.ts` exited 0; 4 files, 23 tests passed. Scheduler cache and TUI receive the same unavailable snapshot on rejection while valid Codex data remains. Failed pipe stderr is bounded to 8 KiB, terminal-sanitized, reduced to `requiresTerminal: true`, and never returned as raw text.
- Full proof: `src/providers/claude.ts` exists at 36 lines; `pnpm test` exited 0 with 20 files/62 tests; typecheck, build, packed consumer smoke, native PTY smoke, dry-run pack, production audit, frozen install, and `git diff --check` all exited 0.
- Transport triangulation: TTY-required stderr on a nonzero pipe exit invokes injected PTY and parses fixture output; unrelated or out-of-bound TTY text does not invoke PTY. Existing output-cap, timeout, cancellation, single-flight, shell-free argument, minimal-environment, executable-verification, and Windows tests remain green.

## Size

- Current PR2 `src/` and PR2 test files: 424 lines. The original Phase 2 workload forecast is high-risk; the user explicitly accepted `size:exception` for this bounded Codex runtime slice.
- Pre-correction Phase 4 validation measured 383 non-SDD lines and 433 total lines (30 tracked non-SDD + 353 untracked Phase4 + 50 SDD), correcting the stale 431 claim.
- The old escalated Phase 4 review target remains historical and unchanged. Its 486-line accounting describes that prior snapshot only.
- Current concurrency-corrected accounting: 69 tracked non-SDD additions/deletions (`.github/workflows/ci.yml`, `README.md`, `SECURITY.md`, `package.json`) + 543 untracked Phase 4 lines (`.github/workflows/release.yml`, `.releaserc.json`, `scripts/release-guard.mjs`, `tests/compat/release-contract.spec.ts`) + 83 SDD additions/deletions (`openspec/changes/opencode-cli-usage-meter/{tasks.md,apply-progress.md}`) = 695 total. Generated `dist/` output is excluded.

## Remaining

- [x] Phase 3: Claude/UI hardening, mock acceptance, pipe-first PTY fallback, and exact native-build packaging policy complete.
- [x] Phase 3E: exact dependency/build authority, safe degradation contract, Linux native proof, and Ubuntu/macOS CI matrix wired for the new review target.
- [x] Phase 4: package verification and release guard complete.
- [ ] Follow-up risk: obtain macOS CI runtime evidence from the new same-SHA release validation matrix; do not infer it from local Linux proof.

## Phase 4 Post-Escalation Corrections

- Authority is limited to a NEW review target. The old escalated lineage remains historical; no commit, push, PR, publish, tag, release, or review-lineage mutation occurred.
- RED: `pnpm exec vitest run tests/compat/release-contract.spec.ts` exited 1 with 2 failed / 5 passed. Missing contracts were same-SHA package/native release dependencies and actual archive/bootstrap enforcement.
- GREEN: the same focused command exited 0 with 7/7 tests; `pnpm release:guard` exited 0 locally. With `RELEASE_GUARD_REQUIRE_PUBLISHED=true`, the guard exited 1 and explicitly refused npm `E404`, proving automated first-publish fail-closed behavior.
- Release workflow: `package-validation` and Ubuntu/macOS `native-pty-validation` check out and verify `${{ github.sha }}`; `release` needs both. Validation remains read-only, main-only, same-event/same-SHA, while only `release` receives `contents: write` and `id-token: write`.
- Archive guard: executes `npm pack --json --dry-run --ignore-scripts`, requires exactly `LICENSE`, `README.md`, `SECURITY.md`, `dist/tui.d.ts`, `dist/tui.js`, `dist/tui.js.map`, and `package.json`, and rejects bundled dependencies.
- Bootstrap/recovery docs: manual reviewed-main publish uses local npm login/2FA and `npm publish --provenance --access public`; no GitHub npm token. Trusted publisher must then target exact repo/workflow. Recovery verifies ownership/version/integrity, reconciles npm-success/tag-failure without republishing, and deprecates bad immutable versions before immediate successor fix-forward; destructive unpublish is forbidden.
- Full proof: `pnpm test` exited 0 with 21 files, 78 passed / 1 skipped. Typecheck, build (72.53 KB JS, 165.44 KB map, 3.61 KB declarations), consumer smoke, native PTY smoke, pack dry-run, production audit, frozen install, frozen no-script install, local release guard, semantic-release dry-run, workflow secret scan, and `git diff --check` all passed. Dry-run reported the branch is not configured to publish and mutated neither Git nor npm.
- Actual npm archive inspection exited 0 with seven entries, `bundled: []`, and integrity `sha512-cjuaT6sDtv2yWmTK+E6i9sZglfTSGjlfhjT64zvl9fP1L3w5oejez9QUryfkKqpE8vjqFg3XfkM1jTrbUPbCwQ==`.

## Phase 4 Concurrency Corrective Retry

- Contract failure: job dependencies only serialized jobs within one workflow run; successive `main` pushes could overlap semantic-release across runs.
- RED: after adding exact workflow and executable-guard assertions first, `pnpm exec vitest run tests/compat/release-contract.spec.ts` exited 1 with 2 failed / 6 passed. The dedicated contract found no workflow-level block, and the embedded guard test failed because exactly one workflow-level policy was required. Standalone `pnpm release:guard` also exited 1 for the same reason.
- GREEN: `.github/workflows/release.yml` now defines exactly one workflow-level group, `release-ninjoan-opencode-usage-meter-opencode-cli-usage-meter`, with literal `cancel-in-progress: false`. The group is stable across runs and contains no `${{ }}`, SHA, ref, run ID, or run number expression. Focused Vitest exited 0 with 8/8 tests and standalone guard passed.
- Full proof: `pnpm test` exited 0 with 21 files, 79 passed / 1 skipped. Typecheck, build (72.53 KB JS, 165.44 KB map, 3.61 KB declarations), consumer import smoke, native PTY smoke, seven-entry pack dry-run, production audit, frozen install, frozen no-script install, release guard, semantic-release dry-run, and `git diff --check` all passed. The dry-run remained on `chore/release-readiness` and published nothing.
- Package evidence: `npm pack --json --dry-run --ignore-scripts` returned exactly seven entries, `bundled: []`, and integrity `sha512-cjuaT6sDtv2yWmTK+E6i9sZglfTSGjlfhjT64zvl9fP1L3w5oejez9QUryfkKqpE8vjqFg3XfkM1jTrbUPbCwQ==`. Project production audit found no vulnerabilities; the temporary npm consumer retained 4 low-severity peer-tree findings plus the known `ini@7.0.0` engine warning and deprecated `glob@9.3.5` warning.
- Work unit evidence: focused command and executable guard passed; runtime harness was the non-publishing semantic-release dry-run plus package/native smokes. Rollback is limited to the concurrency block in `.github/workflows/release.yml`, matching assertions in `tests/compat/release-contract.spec.ts` and `scripts/release-guard.mjs`, and this evidence/task wording.
