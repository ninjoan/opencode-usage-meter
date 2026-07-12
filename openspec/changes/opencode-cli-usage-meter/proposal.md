# Proposal: OpenCode CLI Usage Meter

## Intent

Give OpenCode TUI users a safe Codex/Claude quota meter as a persistent sidebar block beside Context, MCP, and LSP, without credential scraping or Gentle-AI runtime ownership.

## Validated Facts

| Fact | Evidence |
|------|----------|
| Gentle-AI remains a thin configurator. | Existing `tui.json` plugin registration, no PTY adapter, and forbidden auth-state reader in `internal/opencode/models.go`. |
| External TUI plugins are conditionally supported. | Exploration cites `anomalyco/opencode` commit `34e58090595d44e3e7cc37498f16753a98627456`, `@opencode-ai/plugin` `1.17.18`, public `@opencode-ai/plugin/tui`, `slots.register`, runtime loader, and loader tests. |
| The selected surface is supported. | Context/MCP/LSP use `sidebar_content`; product selected that slot. Arbitrary shell tabs/panels/status rows remain unsupported. |

## Scope

### Goals / In Scope
- Standalone OpenCode TUI plugin/package owning CLI execution, parsing, normalization, refresh scheduling, and `sidebar_content` rendering.
- Initial slice: Linux/macOS; Codex `/status`; Claude `/usage`; manual refresh plus adaptive 2/5/15/30m cadence by activity/resource state.
- Fail-soft UX: refresh failures show `Data unavailable`; stale values are discarded.

### Non-Goals / Out of Scope
- Windows, native Gentle-AI runtime ownership, arbitrary tabs/panels, route collisions, monkey-patching, provider APIs, auth files, Keychain, cookies, tokens, or undocumented endpoints.
- Gentle-AI changes beyond a later optional thin registration/recommendation adapter.

## Capabilities

### New Capabilities
- `opencode-cli-usage-meter`: Standalone OpenCode TUI plugin for CLI-backed sidebar usage, degraded states, refresh policy, and security boundary.

### Modified Capabilities
- None.

## Approach

Build outside Gentle-AI first. Register `sidebar_content` through public `@opencode-ai/plugin/tui`; parse minimal CLI output into a read-only model; use PTY only if pipes fail. Strict TDD applies in plugin tooling.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `standalone plugin package` | New | Runtime, tests, distribution. |
| `openspec/specs/opencode-cli-usage-meter/spec.md` | New | Behavioral source of truth. |
| `internal/components/opencodeplugin/plugin.go` | Deferred | Optional thin registration only. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| OpenCode TUI API drift | Med | Pin public API assumptions and test `sidebar_content` activation. |
| CLI output changes | Med | Golden fixtures, parser versioning, fail-soft UI. |
| Security drift | Med | Explicit forbidlist and tests for auth/token paths. |

## Rollback Plan

Unregister/remove the plugin from OpenCode config; any later Gentle-AI adapter remains optional and reversible.

## Dependencies

- OpenCode public `@opencode-ai/plugin/tui` with `sidebar_content` and external plugin loading, validated at commit `34e58090595d44e3e7cc37498f16753a98627456`.
- Installed `codex` and `claude` CLIs authenticated by their own official flows.

## Success Criteria / Acceptance Signals

- [ ] Meter renders as persistent `sidebar_content` beside Context/MCP/LSP using only public APIs.
- [ ] No unsupported tabs/panels, route collisions, monkey-patching, auth files, tokens, cookies, Keychain, or undocumented endpoints are used.
- [ ] Failures render `Data unavailable`, never zero or stale quota.
