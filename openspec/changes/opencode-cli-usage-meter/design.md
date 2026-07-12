# Design: OpenCode CLI Usage Meter

## Technical Approach

Build a standalone pnpm/TypeScript/Solid npm package that OpenCode loads only through `tui.json`. Adopt proven package/release conventions from `Joaquinvesapa/sub-agent-statusline@04083a5` while keeping this plugin modular: thin `src/tui.tsx`, domain/providers/parsers/transport/state/scheduler/gates/ui/diagnostics/disposal boundaries. Provider data comes only from official CLIs (`codex` `/status`, `claude` `/usage`) through cancellable safe processes, normalized and rendered fail-soft in `sidebar_content`.

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|---|---|---|---|
| Package manager | Pin `packageManager: "pnpm@11.2.x"`, commit `pnpm-lock.yaml`/`pnpm-workspace.yaml`; CI uses `pnpm install --frozen-lockfile --ignore-scripts`. | npm/Vite defaults, floating package manager. | Mirrors validated community hygiene and deterministic reviews. |
| Build | `tsup` ESM targeting Node 22 with `module/moduleResolution: NodeNext`; `esbuild-plugin-solid` uses `generate: "universal", moduleName: "@opentui/solid"`. `src/tui.tsx` builds to `dist/tui.js` + `dist/tui.d.ts`. | Vite app/build assumptions. | OpenCode loads Node exports; OpenTUI Solid JSX needs the esbuild plugin. |
| Public exports | `.` and `./tui` both resolve to `dist/tui.js`; omit `./runtime`. | General runtime export, source exports. | v1 public contract is only the TUI plugin; runtime APIs would imply unsupported ownership and semver surface. |
| Dependency contract | Node `>=22.13`; peers: `@opencode-ai/plugin >=1.17.18 <2`, `@opentui/core/@opentui/solid >=0.4.3 <0.5`, `solid-js >=1.9.12 <2`. | Blindly copying stale ranges. | Current npm metadata and OpenCode validation define the floor. |
| Reference behavior | Reuse package conventions only. | Monolithic TUI, persistence/log/SQLite, prompt-slot replacements, commands/runtime export, bilingual docs in v1. | Requirements demand ephemeral CLI probes and a narrow sidebar slice. |
| CI/release | First slice: PR CI with typecheck, Vitest, audit, built-package smoke, `pnpm pack --dry-run`. Later: semantic-release/npm provenance. | Immediate release automation. | Keeps first PR small; release slice asserts manifest/tag/npm consistency. |

## Data Flow

```text
OpenCode tui.json -> package export ./tui -> src/tui.tsx
  -> sidebar_content -> state/cache -> scheduler/gates
  -> provider adapter -> safe transport -> parser -> UsageSnapshot -> UI
```

Failures discard old provider values and show exact copy `Data unavailable`.

## Recommended Target Tree

```text
package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsup.config.ts vitest.config.ts
src/{tui.tsx,domain,providers,parsers,transport,state,scheduler,gates,ui,diagnostics,disposal}/
tests/{unit,integration,component,compat,security}/ README.md LICENSE SECURITY.md CONTRIBUTING.md .github/
```

## File Changes

| File | Action | Description |
|---|---|---|
| `openspec/changes/opencode-cli-usage-meter/design.md` | Modify | Revised package/build/release design. |
| `/home/user/proyectos/opencode-usage-meter/openspec/config.yaml` | Modify | Use pnpm/Vitest/tsup commands and published `@solidjs/testing-library` capability metadata. |
| Standalone package files above | Future create | Runtime package, tests, docs, CI. |
| Gentle-AI internals | Deferred | Optional future `OpenCodeCommunityPlugin` registration only through `tui.json`. |

## Interfaces / Contracts

`package.json`: `type: "module"`, `main/types` to `dist/tui`, `exports` for `.` and `./tui`, `files: ["dist", "assets", "README.md", "LICENSE", "SECURITY.md"]` as needed, `publishConfig.access=public` in release slice. Plugin default export is `{ id, tui }`; `tui(api)` registers one `sidebar_content` block and disposal cleanup. Domain types use const-object unions; no `any`; transport accepts executable plus readonly args, `shell:false`, minimal env, timeout/cancel.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | parsers, model, gates, scheduler | Vitest fixtures/goldens, fake timers. |
| Integration | fake process transport, timeouts, single-flight, cleanup | No real credentials; Linux/macOS. |
| Component | sidebar available/unavailable/loading/accessibility | `@solidjs/testing-library` with `jsdom` for component specs; do not exclude TUI wholesale. |
| Compatibility/package | built exports, OpenCode TUI shape, contents | Build first, smoke `dist/tui.js`, then `pnpm pack --dry-run`. |
| Security | forbidden auth/log/HTTP sources and shell injection | Negative import tests plus executable/arg tests. |

Commands: `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`, `pnpm build`, `pnpm pack:dry-run`, `pnpm audit:prod`.

## Threat Matrix

| Boundary | Applicability | Design response | Planned RED tests |
|---|---|---|---|
| Documentation-like paths | N/A: no executable-file classification. | No path classification. | None. |
| Git repository selection | N/A: no VCS automation in plugin. | CI may checkout repo only. | None. |
| Commit state | N/A. | No commit operations. | None. |
| Push state | N/A. | Release slice only after CI; no plugin runtime push. | None. |
| PR commands | N/A. | No PR command composition. | None. |

Additional subprocess boundary: applicable. Safe behavior: `spawn(file,args,{shell:false})`, absolute override only, safe PATH lookup, minimal env, output caps, timeouts, cleanup. Failure: `Data unavailable`. RED tests cover metacharacter input, hanging/login cleanup, no credential env injection, and forbidden auth/HTTP imports.

## Migration / Rollout

No data migration. Installation/rollback is exclusively OpenCode `tui.json` add/remove plus OpenCode reload. First slice fits the 800-line review budget if limited to packaging, Codex path, shared model/gates, sidebar states, component tests, and package smoke; both providers, PTY, and release automation need stacked PRs. Future Gentle-AI registration and semantic-release/npm provenance are deferred.

## Open Questions / Risks

- [ ] Confirm exact non-interactive Codex/Claude flags from RED fixtures.
- [ ] PTY fallback may be needed and should be a separate slice if pipes fail.
- [ ] Release automation must prevent manifest/tag/npm version inconsistency.
