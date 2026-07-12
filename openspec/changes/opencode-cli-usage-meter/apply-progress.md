# Apply Progress: opencode-cli-usage-meter

## Scope

- Artifact store: hybrid
- Delivery: stacked-to-main, PR1 only
- Mode: Strict TDD
- Completed slice: Phase 1 preparation and package contract
- Out of scope: Codex/Claude providers, parser/runtime behavior, auth paths, provider network calls, release publishing

## Corrective Retry Summary

- Replaced the obsolete direct built-output import smoke with `smoke:consumer`, which packs the archive, installs it into a clean temporary consumer with scripts disabled and offline resolution, and imports both public entry points; CI runs it immediately after `pnpm build`.
- Corrected strict-TDD evidence to one coherent package-contract work-unit cycle. Prep/refactor tasks now use justified N/A or inherited work-unit evidence instead of invented standalone RED cycles.
- Updated OpenSpec references from unavailable `@testing-library/solid` to published `@solidjs/testing-library` and documented `jsdom` for future component specs.
- Reproduced the exact `skipLibCheck`-disabled diagnostics, removed `skipLibCheck`, and made `pnpm exec tsc --noEmit --skipLibCheck false` pass without suppressing project errors.

## Completed Tasks

- [x] 1.1 Prep: verified transferred OpenSpec artifacts and pnpm command configuration. Strict-TDD RED is N/A because this is non-behavioral artifact transfer; acceptance is inherited from the package-contract work-unit validations and SDD status/artifact reads.
- [x] 1.2 RED: added bootstrap/package-contract tests and observed the coherent work-unit RED for missing package/source behavior.
- [x] 1.3 GREEN: added package/tooling/source/docs/issue template and lock/workspace files to satisfy the package-contract RED tests.
- [x] 1.4 REFACTOR: wired pnpm scripts, strict NodeNext checks, tsup build, packed-archive consumer smoke, CI frozen install, audit, and pack dry run. Strict-TDD RED is inherited from the package-contract work unit; this task is script/CI refactor evidence.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.1 | N/A artifact transfer + `gentle-ai sdd-status` | Planning/prep | N/A: non-testable transfer/config prep | N/A: no production behavior; no separate RED cycle claimed | ✅ SDD status ready/done artifacts; inherited from PR1 package-contract work-unit evidence | N/A: no branching behavior | ✅ OpenSpec references corrected and status rechecked |
| 1.2 | `tests/bootstrap/plugin-load.spec.ts`, `tests/compat/package-contract.spec.ts`, `tests/compat/pack-contents.spec.ts` | Unit/compat | N/A: new package tests | ✅ `pnpm test -- --run tests/bootstrap/plugin-load.spec.ts tests/compat/package-contract.spec.ts tests/compat/pack-contents.spec.ts` failed before GREEN: missing `../../src/tui.js`, missing `engines`, `exports`, `peerDependencies`, `files`; 3 files failed, 4 tests failed, plugin suite 0 collected | ✅ Same focused command passed after implementation: 3 files passed, 8 tests passed | ✅ Covered plugin id/hook, sidebar slot, fail-soft copy, dispose, fixture-safety, exports, peers, and files allowlist | ✅ Focused tests still pass after CI/smoke/typecheck corrections |
| 1.3 | Same focused package/bootstrap specs | Unit/compat | N/A: new package files | ✅ Inherited coherent work-unit RED from 1.2; tests described missing package/source behavior before implementation | ✅ Same focused command passed after `package.json`, lock/workspace, TS/tsup/Vitest config, `src/tui.tsx`, docs, and issue template | ✅ Package contract covers positive and forbidden export/file paths, including no `./runtime` | ✅ `pnpm typecheck`, `pnpm exec tsc --noEmit --skipLibCheck false`, and `pnpm build && pnpm smoke:consumer` passed |
| 1.4 | Same focused specs + validation commands | Config/CI refactor | N/A: new scripts/CI | N/A separate RED: refactor/config wiring inherits package-contract work-unit RED; no standalone behavior test was invented | ✅ `pnpm test` passed with 3 files and 12 tests; `pnpm typecheck`, `pnpm build && pnpm smoke:consumer`, `pnpm audit:prod`, `pnpm pack:dry-run`, and frozen install passed | N/A: command wiring has one intended outcome | ✅ CI now runs `pnpm build && pnpm smoke:consumer` before audit/pack |

## Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `pnpm test -- --run tests/bootstrap/plugin-load.spec.ts tests/compat/package-contract.spec.ts tests/compat/pack-contents.spec.ts` → exit 0; 3 files passed, 8 tests passed. RED before GREEN: same command exited non-zero; 3 files failed, 4 tests failed, plugin suite failed to import missing `src/tui.js`, and package contract fields were missing. |
| Runtime harness command/scenario and exact result | `pnpm build && pnpm smoke:consumer` → passed; the script packed the archive with scripts disabled, created a clean temporary consumer, installed the archive offline with install scripts disabled, and imported both `opencode-cli-usage-meter` and `opencode-cli-usage-meter/tui`. The offline install added 1 package with 0 vulnerabilities. |
| Rollback boundary | Revert PR1 package/tooling/docs/CI/test files plus Phase 1 checkbox/apply-progress/design/config updates: `.github/**`, root package/tooling/docs files, `src/tui.tsx`, `tests/**`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and OpenSpec PR1 evidence/reference edits. Later provider/runtime slices are untouched. |

## Correction Proof

| Correction | Proof |
|---|---|
| CI packed consumer smoke after build | `.github/workflows/ci.yml` validates `pnpm typecheck && pnpm test && pnpm build && pnpm smoke:consumer && pnpm audit:prod && pnpm pack:dry-run`; `pnpm build && pnpm smoke:consumer` passed against a clean temporary consumer using the packed archive and both public exports. |
| Strict-TDD evidence corrected | TDD table now records one package-contract RED→GREEN cycle for behavioral/package-contract work. Task 1.1 is N/A as non-testable prep; task 1.4 inherits the work-unit RED and records refactor/validation evidence. |
| Testing-library reference corrected | `openspec/changes/opencode-cli-usage-meter/design.md` and `openspec/config.yaml` now name `@solidjs/testing-library`; npm evidence from PR1 correction: `@testing-library/solid` returned 404, while `@solidjs/testing-library` resolved to `0.8.10`. |
| `skipLibCheck` resolved | Reproduced with `pnpm exec tsc --noEmit --skipLibCheck false`: errors were in `esbuild-plugin-solid/dist/index.d.ts` missing `@babel/core` types, `happy-dom/lib/window/BrowserWindow.d.ts` missing `node:stream/web` `UnderlyingDefaultSource`, and `tsup/dist/index.d.ts` missing `./types.cts` and `@swc/core`. Resolution: added `@types/babel__core`, replaced `happy-dom` with `jsdom`, removed the `tsup` type import from `tsup.config.ts`, removed `skipLibCheck` from `tsconfig.json`, and verified `pnpm exec tsc --noEmit --skipLibCheck false` exit 0. |

## Validation Commands

| Command | Result |
|---|---|
| `pnpm test -- --run tests/bootstrap/plugin-load.spec.ts tests/compat/package-contract.spec.ts tests/compat/pack-contents.spec.ts` | exit 0; 3 files passed, 8 tests passed |
| `pnpm test` | exit 0; 3 files passed, 12 tests passed |
| `pnpm typecheck` | exit 0; `tsc --noEmit` |
| `pnpm exec tsc --noEmit --skipLibCheck false` | exit 0; no diagnostics |
| `pnpm build && pnpm smoke:consumer` | passed; packed archive installed into a clean temporary consumer offline with scripts disabled, then root and `/tui` imports passed; install added 1 package, 0 vulnerabilities |
| `pnpm pack:dry-run` | exit 0; tarball contains `dist/tui.d.ts`, `dist/tui.js`, `dist/tui.js.map`, `LICENSE`, `package.json`, `README.md`, `SECURITY.md` |
| `pnpm audit:prod` | exit 0; no known vulnerabilities |
| `pnpm install --frozen-lockfile --ignore-scripts` | exit 0; lockfile frozen install check passed using pnpm 11.2.0 |

## Notes and Deviations

- Deviation resolved: package/test setup now consistently uses `@solidjs/testing-library`, the published Solid Testing Library package. `jsdom` is present for future component specs; current PR1 tests remain package/bootstrap focused and run under the default Node environment.
- `skipLibCheck` is no longer present. The external declaration diagnostics were resolved without suppressing project errors.
- `pnpm approve-builds esbuild msgpackr-extract` remains recorded in `pnpm-workspace.yaml`; CI still uses frozen install with `--ignore-scripts`.

## Line Count Forecast

- Forecast: PR1 expected 260-340 changed lines; approved review budget 800 changed lines.
- Current authored implementation/support lines before SDD evidence: 499 additions.
- Generated lockfile: 3467 lines (`pnpm-lock.yaml`), expected review as generated dependency snapshot rather than authored code.

## Remaining Tasks

- [ ] Phase 2: Codex Core Slice
- [ ] Phase 3: Claude, UI Hardening, Optional PTY
- [ ] Phase 4: Package Verification and Release Guard
