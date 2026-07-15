# Apply Progress: opencode-cli-usage-meter

## Cumulative Status

- Artifact store: hybrid. Mode: Strict TDD. Delivery: stacked-to-main. Phase 4 is a new review target; old review lineages remain historical and were not mutated.
- Phase 1 tasks 1.1–1.4, Phase 2 tasks 2.1–2.4, Phase 3 tasks 3.1–3.8, and redefined Phase 4 tasks 4.1–4.2 are complete. All 18/18 tasks are complete only under the manual release-readiness scope below.
- Current scope excludes GitHub automated publishing, release workflow privileged identity, long-lived npm tokens, direct CI publish steps, dynamic release downloaders, local publish scripts, tags, releases, commits, pushes, PR creation, and first-release provenance claims.

## Completed Tasks Summary

- [x] Phase 1: transferred planning artifacts, pnpm package scaffolding, package/build/test commands, frozen no-script CI install.
- [x] Phase 2: safe CLI transport, Codex parser/provider, normalized usage model/cache/scheduler/gates, sidebar UI, and lifecycle disposal.
- [x] Phase 3: explicit Codex/Claude adapter registry, Claude parser/provider, multi-provider scheduler/cache/UI, in-process behavior harness, exact optional `node-pty@1.2.0-beta.12`, bounded native build policy, and Ubuntu/macOS native smoke wiring.
- [x] Phase 4: manual release guard and runbook replacing automated publication scope while preserving CI package/native verification.

## Completed Phase 4 Tasks

- [x] 4.1 RED: replaced automated release contracts with behavior-first manual release guard tests for absent release workflow/config/scripts, allowed pre-first-publish npm `E404`, existing version collision rejection, exact pack allowlist and bundled dependency rejection, clean reviewed SHA/check evidence, and nonmutation.
- [x] 4.2 GREEN/REFACTOR: removed current-scope automated publishing files and dynamic release scripts; kept CI package/native Ubuntu+macOS checks, least privilege, build-before-test, stable package checks, and documented a retained-`.tgz` manual first publish with no provenance, candidate-vs-registry comparison, ambiguous publish recovery, and post-publish tag/integrity recovery.

## Phase 4 TDD Cycle Evidence

| Task | Test files | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 4.1 | `tests/compat/release-contract.spec.ts` | Package/release contract | `pnpm exec vitest run tests/compat/release-contract.spec.ts tests/compat/package-contract.spec.ts tests/compat/pack-contents.spec.ts && pnpm release:guard` -> exit 0; 3 files / 20 tests and guard passed before changes. | New manual-release tests first: `pnpm exec vitest run tests/compat/release-contract.spec.ts` -> exit 1; 3 failed / 2 passed because release workflow/config still existed, version collision/manual evidence behavior was absent. | Same focused command -> exit 0; 1 file / 5 tests after removing automated files/scripts and refactoring the guard. | Tests cover E404 allowed vs version collision rejected, extra pack file vs bundled dependency rejected, dirty tree/wrong SHA/wrong check evidence rejected, and clean reviewed evidence accepted. | Guard now reads only package/CI/docs/archive/git evidence, asserts nonmutation, and no longer assumes automated publication. |
| 4.2 correction | `tests/compat/release-contract.spec.ts`, README/SECURITY/OpenSpec artifacts | Workflow/docs/guard | Baseline package/release safety net needed extended timeout on this machine: `pnpm exec vitest run --testTimeout 15000 tests/compat/release-contract.spec.ts tests/compat/package-contract.spec.ts tests/compat/pack-contents.spec.ts && pnpm release:guard` -> exit 0; 14 tests plus guard passed. | `pnpm exec vitest run --testTimeout 15000 tests/compat/release-contract.spec.ts` -> exit 1; 3 failed / 3 passed after adding no-provenance, retained-candidate, ambiguous recovery, and duplicate-check rerun expectations. | `pnpm exec vitest run tests/compat/release-contract.spec.ts` -> exit 0; 1 file / 6 tests passed. | Focused package/release suite -> exit 0; 3 files / 15 tests plus `pnpm release:guard` passed; duplicate check evidence now rejects stale success overriding newer failed reruns and ambiguous duplicate rows. | README/SECURITY/spec/design/tasks/apply-progress now state the accepted first-release no-provenance limitation, exact retained `.tgz` publish, registry byte comparison before tag, and query-before-retry recovery. |

## Phase 4 Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run tests/compat/release-contract.spec.ts` -> exit 0; 1 file / 6 tests passed. Follow-up focused package contracts: `pnpm exec vitest run tests/compat/release-contract.spec.ts tests/compat/package-contract.spec.ts tests/compat/pack-contents.spec.ts && pnpm release:guard` -> exit 0; 3 files / 15 tests plus guard passed. |
| Runtime harness command/scenario and exact result | Non-publishing package/runtime chain: `pnpm test`, `pnpm typecheck && pnpm build && pnpm pack:dry-run && npm pack --json --dry-run --ignore-scripts && pnpm release:guard && git diff --check`, `pnpm audit:prod`, `pnpm smoke:consumer`, and `pnpm smoke:pty-native` all exited 0. Candidate-retention harness generated `/tmp/opencode/usage-meter-release-candidate-check/opencode-cli-usage-meter-0.0.0.tgz`, compared it byte-for-byte with a registry-copy stand-in using `cmp -s`, compared sorted tar listings with `diff -u`, and produced SHA-512 `3839569d3eee50248b29edef146fee3a2bea330314b36e45a524dcd933f4cce0375b4df11737442c965b0c8e15032733cdeb50959094424426ee9d52db87d508`. No publish, tag, release, commit, push, or PR occurred. |
| Rollback boundary | Revert `package.json` release-script changes, `scripts/release-guard.mjs`, `tests/compat/release-contract.spec.ts`, README/SECURITY release sections, CI guard references if needed, and Phase 4 OpenSpec artifacts. Phase 1-3 runtime/provider/native behavior is outside this rollback boundary. |

## Phase 4 Validation

| Command | Result |
|---|---|
| Focused RED | `pnpm exec vitest run --testTimeout 15000 tests/compat/release-contract.spec.ts` -> exit 1; 3 failed / 3 passed after adding correction expectations before production/doc/guard changes. |
| Focused GREEN | `pnpm exec vitest run tests/compat/release-contract.spec.ts` -> exit 0; 1 file / 6 tests passed. |
| Focused package release contracts | `pnpm exec vitest run tests/compat/release-contract.spec.ts tests/compat/package-contract.spec.ts tests/compat/pack-contents.spec.ts && pnpm release:guard` -> exit 0; 3 files / 15 tests and guard passed. |
| Full suite | `pnpm test` -> exit 0; 21 files passed, 77 passed / 1 skipped. |
| Typecheck | `pnpm typecheck` -> exit 0. |
| Build | `pnpm build` -> exit 0; `dist/tui.js` 72.53 KB, `dist/tui.js.map` 165.44 KB, `dist/tui.d.ts` 3.61 KB. |
| Consumer package smoke | `pnpm smoke:consumer` -> exit 0; temporary consumer imported package root and `/tui`. npm reported the known temporary peer-tree warnings: transitive `ini@7.0.0` engine warning, deprecated `glob@9.3.5`, and 4 low-severity temp audit findings. |
| Native PTY smoke | `pnpm smoke:pty-native` -> exit 0; native `node-pty` imported, spawned, and terminated a harmless local Node PTY. |
| Pack dry-run | `pnpm pack:dry-run` -> exit 0; package contains exactly `LICENSE`, `README.md`, `SECURITY.md`, `dist/tui.d.ts`, `dist/tui.js`, `dist/tui.js.map`, and `package.json`. |
| npm tarball inspection | `npm pack --json --dry-run --ignore-scripts` -> exit 0; 7 entries, `bundled: []`, integrity `sha512-ODlWnT7uUCSLKe3vFG/uOivqMwMUs25FpSTc2TP0zOA3W03xFzdELJZbDI4VAyczzetQlZCUQkQm7p1S24fVCA==`. |
| Production audit | `pnpm audit:prod` -> exit 0; no known vulnerabilities. |
| Frozen install | `pnpm install --frozen-lockfile` -> exit 0; already up to date. |
| Frozen no-script install | `pnpm install --frozen-lockfile --ignore-scripts` -> exit 0; already up to date. |
| Release guard | `pnpm release:guard` -> exit 0; package identity, source bootstrap policy, manual docs, CI, archive, and nonmutation checks passed. |
| Diff hygiene | `git diff --check` -> exit 0. |

## Manual Release Procedure Captured

- First release version: reviewed source is `0.1.0`.
- Release starts only from the exact merged `main` SHA after `package`, `native-pty (ubuntu-latest)`, and `native-pty (macos-latest)` checks pass for that SHA.
- Use an ephemeral clean worktree from the reviewed version-bump SHA, run build/test/guard/audit/package checks, generate and retain the exact candidate `.tgz`, authenticate locally with npm login+2FA, and run `npm publish "$CANDIDATE_TGZ" --access public` with no provenance for the first bootstrap release.
- Create a signed annotated tag only after the downloaded npm registry tarball matches the retained candidate byte-for-byte and by sorted file list; if signing is unavailable, stop the release.
- If publication succeeds but tag fails, compare the registry artifact to the retained candidate before creating the missing tag at the exact reviewed SHA. If publish times out or the response is lost, query npm/version and fetch/compare before any retry; never blindly republish. If anything mismatches or a bad version is published, deprecate that version and fix forward with a successor; do not unpublish.

## Remaining

- [ ] User-only: after this change is merged to `main`, perform the manual release procedure from the exact reviewed SHA. Do not publish, tag, release, commit, push, or open a PR from this apply run.
