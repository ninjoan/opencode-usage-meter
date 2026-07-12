## Exploration: opencode-cli-usage-meter

### Current State
Gentle-AI is a Go CLI/TUI configurator, not an OpenCode runtime plugin host. Current OpenCode integration stays intentionally thin: the OpenCode adapter owns paths/capabilities (`internal/agents/opencode/adapter.go`), SDD installs managed local startup plugins (`internal/components/sdd/inject.go`), optional OpenCode community plugins are only registered into `~/.config/opencode/tui.json` (`internal/components/opencodeplugin/plugin.go`), and external runtime ownership is explicitly documented (`docs/codebase/integrations.md`). Update/upgrade logic already understands OpenCode plugin package registration vs later materialization in `node_modules` (`internal/update/detect.go`, `internal/update/types.go`, `internal/update/upgrade/strategy.go`). There is no PTY dependency or reusable process-stream adapter in this repo today; existing command execution is basic `exec.CommandContext`/`CombinedOutput` usage. Also, `internal/opencode/models.go` reads OpenCode auth state for provider detection, which is a hard mismatch with this change's security boundary and must not be reused.

### Affected Areas
- `docs/codebase/integrations.md` — defines the thin-integration boundary between community tools, OpenCode plugins, and native Gentle-AI behavior.
- `docs/codebase/maintainer-playbook.md` — reinforces that external runtime ownership must stay explicit.
- `internal/components/opencodeplugin/plugin.go` — `Install`, `Definition`, and `ensureTUIPlugin` are the exact registration path if Gentle-AI only adds an optional plugin package/path.
- `internal/model/types.go` — `OpenCodeCommunityPluginID` / `CommunityToolID` are the extension points for new optional integrations.
- `internal/model/selection.go` — `Selection.OpenCodePlugins` and `Selection.CommunityTools` persist installer choices.
- `internal/tui/model.go` — `startOpenCodePluginRegistration`, `startCommunityToolInstallation`, and the plugin/community-tool screens drive interactive registration.
- `internal/tui/screens/opencode_plugins.go` / `community_tools.go` — existing UI extension points for optional OpenCode plugins and cross-agent community tools.
- `internal/update/registry.go` / `detect.go` / `types.go` / `upgrade/strategy.go` — plugin packaging, registered-not-materialized detection, and upgrade behavior.
- `internal/components/sdd/inject.go` — current managed local OpenCode plugins (`model-variants.ts`, `skill-registry.ts`) show the only in-repo plugin asset pattern today.
- `internal/assets/opencode/plugins/model-variants.ts` / `skill-registry.ts` — examples of lightweight OpenCode startup plugins; useful precedent, but they are not PTY/process UIs.

### Approaches
1. **Standalone OpenCode plugin** — Separate repository/package owns CLI invocation, PTY/process adapters, parsing, normalization, and UI; Gentle-AI may later register it as an optional community plugin.
   - Pros: Best fit with current repo boundaries; keeps core collection independent; easiest to keep security boundary explicit; matches OpenCode plugin runtime/package model; avoids forcing Go + npm/plugin concerns into one repo.
   - Cons: Separate release/distribution work; Gentle-AI users need explicit registration flow if integration is desired; shared normalization with non-OpenCode surfaces needs a second adapter layer.
   - Effort: Medium

2. **Gentle-AI-managed community tool/plugin** — Keep the actual collector/plugin mostly external, but add first-class discovery/registration/update support here.
   - Pros: Good user distribution story; fits existing `opencodeplugin` and `update` patterns; still keeps native integration optional and thin.
   - Cons: Still needs a separate runtime/package somewhere; blast radius touches installer state, TUI, update registry, docs, and tests; business ownership questions remain.
   - Effort: Medium-High

3. **Native Gentle-AI feature** — Build collection/normalization and possibly UI/runtime behavior directly into this repo.
   - Pros: Single product surface; no extra repo coordination; tighter control over installer/update UX.
   - Cons: Weakest fit with current architecture; this repo is Go-first and intentionally thin around external runtimes; no PTY foundation exists; risks mixing product/runtime concerns with installer concerns; likely harder to get accepted if Alan rejects first-party ownership.
   - Effort: High

### Recommendation
Technically, the safest path is **Approach 1 first, with Approach 2 as an optional follow-up adapter**. That preserves the requested independence, respects the current repo boundary that OpenCode plugins/community tools remain thin/reversible, and avoids reusing forbidden auth-reading code paths. A narrow first slice is: **one standalone OpenCode plugin that invokes `codex` then `/status` and `claude` then `/usage` via a cancellable process adapter (PTY only if plain pipes fail), parses a minimal stable subset into a normalized read-only model, and renders a single quota panel; Gentle-AI only documents/registers it later if product wants that.**

### Risks
- CLI output is explicitly parseable in practice but unstable; parser versioning, golden fixtures, and fail-soft UI states are mandatory.
- `codex`/`claude` status commands may behave differently under pipes vs PTY; this repo has no PTY support today, so a native implementation expands platform risk immediately.
- Security drift is a real threat because the repo already contains auth-file readers for unrelated OpenCode model detection; proposal/spec must forbid reuse.
- Packaging is split-brain if done here: GoReleaser handles the main binary, while an external OpenCode plugin likely wants npm/package-manager distribution.

### Ready for Proposal
No — before proposal, product needs to answer: (1) should the runtime live in a separate plugin repo or in Gentle-AI, (2) is Gentle-AI only allowed to register/update it or expected to own behavior, (3) what platforms/CLIs are in slice 1, and (4) what degraded UX is acceptable when parsing fails or the command requires a PTY.

## 2026-07-11 — OpenCode TUI Capability Validation

### Upstream Validated
- **Repository:** `anomalyco/opencode`
- **Version:** `@opencode-ai/plugin` `1.17.18`
- **Commit inspected:** `34e58090595d44e3e7cc37498f16753a98627456` (`dev` at research time)
- **Primary docs inspected:** `https://opencode.ai/docs/plugins`, `https://opencode.ai/docs/commands`, `https://opencode.ai/docs/custom-tools`, `https://opencode.ai/docs/tui`

### Verdict
**Conditionally supported.**

Current OpenCode **does support external TUI plugins** with a real public package export (`@opencode-ai/plugin/tui`) and a runtime that loads external TUI plugins from local files and npm packages. Those plugins can add **persistent sidebar blocks**, replace certain host slots, register **custom routes/screens**, register **slash/palette commands**, and show **dialogs/toasts**.

However, support is **bounded to the host slots and APIs OpenCode exposes**. External plugins **cannot publicly inject arbitrary new core tabs/panels/status rows anywhere in the shell**. If the requirement means “a persistent sidebar surface comparable to the built-in Context/MCP/LSP sections”, that is supported. If it means “a new first-class built-in tab/panel anywhere in the native layout”, that is unsupported without monkey-patching.

### Evidence Summary

#### 1) Native TUI core-only extension points
- Built-in Context/MCP/LSP sidebar sections are themselves TUI plugins registered into the shared `sidebar_content` slot:
  - `packages/tui/src/feature-plugins/sidebar/context.tsx` — `tui` registers `sidebar_content` with `order: 100`.
  - `packages/tui/src/feature-plugins/sidebar/mcp.tsx` — `tui` registers `sidebar_content` with `order: 200`.
  - `packages/tui/src/feature-plugins/sidebar/lsp.tsx` — `tui` registers `sidebar_content` with `order: 300`.
- Those built-ins are loaded from the same builtin plugin list used by the TUI host: `packages/tui/src/feature-plugins/builtins.ts`.
- The host layout renders only a fixed set of slot anchors, not arbitrary plugin-defined layout regions:
  - `packages/tui/src/routes/home.tsx` — `home_logo`, `home_prompt`, `home_prompt_right`, `home_bottom`, `home_footer`.
  - `packages/tui/src/routes/session/index.tsx` — `session_prompt`, `session_prompt_right`.
  - `packages/tui/src/routes/session/sidebar.tsx` — `sidebar_title`, `sidebar_content`, `sidebar_footer`.
  - `packages/tui/src/app.tsx` — `app_bottom`, `app`.
- `packages/plugin/src/tui.ts` hard-codes the public host slot map in `TuiHostSlotMap`; there is **no public API for arbitrary new shell tabs/panels outside these anchors**.

#### 2) Public plugin API
- `packages/plugin/package.json` exports `./tui` publicly from `@opencode-ai/plugin/tui`.
- `packages/plugin/src/tui.ts` exposes `TuiPluginApi` with public capabilities for:
  - `route.register` / `route.navigate`
  - `ui.Dialog*`, `ui.toast`, `ui.dialog`
  - `keymap.registerLayer`
  - `slots.register`
  - `state.session.*`, `state.lsp()`, `state.mcp()`
  - `plugins.install/add/activate/deactivate`
  - `lifecycle.onDispose`
- `packages/opencode/src/plugin/tui/runtime.ts` loads external TUI plugins, scopes their lifecycle, and passes the TUI API to them.
- `packages/opencode/test/cli/tui/plugin-loader-entrypoint.test.ts` proves npm packages with a `./tui` export are accepted and activated.
- `packages/opencode/test/cli/tui/plugin-loader.test.ts` proves external plugins receive dialog, keymap, KV, theme, diff/todo/LSP/MCP state, and can initialize successfully.
- `.opencode/plugins/tui-smoke.tsx` is a full upstream smoke example showing external plugins can:
  - register custom routes/screens,
  - register slash/palette commands,
  - register sidebar/home/prompt slots,
  - show dialogs and toasts.

#### 3) Custom commands/tools that only print content
- `opencode.ai/docs/commands` and `packages/web/src/content/docs/commands.mdx` define custom commands as prompt templates executed in the TUI conversation. They do **not** expose persistent layout injection.
- `opencode.ai/docs/custom-tools` and `packages/web/src/content/docs/custom-tools.mdx` define custom tools as LLM-callable functions returning tool results. They do **not** expose TUI layout APIs.
- These are safe alternatives for rendering information in the conversation stream, but they are **not equivalent** to a persistent sidebar block/panel.

#### 4) Unsupported monkey-patching
- `packages/tui/src/plugin/api.ts` stores plugin routes by name and resolves the **last registered render function** for a route. That means a plugin could technically collide with host route names, but this is not documented as a supported extension mechanism and is therefore monkey-patching.
- `packages/plugin/src/tui.ts` exposes only the fixed `TuiHostSlotMap`; anything outside those slots requires relying on internal implementation details.
- Conclusion: replacing core screens or inventing arbitrary shell insertion points is **unsupported** even if it can be forced by route/slot collision tricks.

### Concrete Answer to the Requirement
- **Supported today:** a persistent usage meter rendered as a **sidebar block** alongside Context / MCP / LSP via `sidebar_content`.
- **Supported today:** a dedicated plugin-owned screen/route opened by palette or slash command.
- **Supported today:** transient dialog / toast UX.
- **Not supported today:** arbitrary new native shell tabs/panels/status rows outside the exposed host slots.

### Ranked Safe UX Alternatives
1. **Persistent `sidebar_content` plugin block** — highest fidelity, closest match to Context/MCP/LSP, no requirement change if “panel” can mean a sidebar section.
2. **Plugin-owned route/screen opened by slash or palette command** — still in-TUI, but not always visible; requirement must change from “persistent visible meter” to “quickly accessible meter view”.
3. **Plugin dialog / overlay** — in-TUI but transient; requirement must change from persistent surface to on-demand modal UX.
4. **Custom slash command output or custom tool output** — conversation-only; requirement must change from TUI surface to command-driven textual report.
5. **External terminal UI/process** — safest if OpenCode layout constraints are unacceptable; requirement must change from “inside OpenCode TUI” to “adjacent terminal companion”.

### Requirement Impact
- If the approved product requirement is **“inside OpenCode TUI, comparable to Context/MCP/LSP”**, it can stay intact **only if** the intended surface is a **sidebar block**.
- If the requirement is **“new tab/panel/status row anywhere in the native shell”**, the requirement is currently **too strong** for the public API and must be rewritten explicitly before spec/design.

### Permalink Evidence
- `@opencode-ai/plugin` public `./tui` export: https://github.com/anomalyco/opencode/blob/34e58090595d44e3e7cc37498f16753a98627456/packages/plugin/package.json#L11-L18
- `TuiPluginApi`, `TuiHostSlotMap`, `slots.register`, `route.register`: https://github.com/anomalyco/opencode/blob/34e58090595d44e3e7cc37498f16753a98627456/packages/plugin/src/tui.ts#L455-L626
- Home slot anchors: https://github.com/anomalyco/opencode/blob/34e58090595d44e3e7cc37498f16753a98627456/packages/tui/src/routes/home.tsx#L70-L93
- Session prompt slot anchors: https://github.com/anomalyco/opencode/blob/34e58090595d44e3e7cc37498f16753a98627456/packages/tui/src/routes/session/index.tsx#L1298-L1318
- Sidebar slot anchors: https://github.com/anomalyco/opencode/blob/34e58090595d44e3e7cc37498f16753a98627456/packages/tui/src/routes/session/sidebar.tsx#L48-L99
- App-level slot anchors: https://github.com/anomalyco/opencode/blob/34e58090595d44e3e7cc37498f16753a98627456/packages/tui/src/app.tsx#L1122-L1127
- Built-in Context sidebar plugin: https://github.com/anomalyco/opencode/blob/34e58090595d44e3e7cc37498f16753a98627456/packages/tui/src/feature-plugins/sidebar/context.tsx#L49-L58
- Built-in MCP sidebar plugin: https://github.com/anomalyco/opencode/blob/34e58090595d44e3e7cc37498f16753a98627456/packages/tui/src/feature-plugins/sidebar/mcp.tsx#L81-L89
- Built-in LSP sidebar plugin: https://github.com/anomalyco/opencode/blob/34e58090595d44e3e7cc37498f16753a98627456/packages/tui/src/feature-plugins/sidebar/lsp.tsx#L49-L57
- External TUI smoke plugin showing slots/routes/dialogs/toasts: https://github.com/anomalyco/opencode/blob/34e58090595d44e3e7cc37498f16753a98627456/.opencode/plugins/tui-smoke.tsx#L711-L1019
- External TUI plugin runtime loader: https://github.com/anomalyco/opencode/blob/34e58090595d44e3e7cc37498f16753a98627456/packages/opencode/src/plugin/tui/runtime.ts#L572-L650 and #L676-L774 and #L988-L1117
- npm `./tui` entrypoint test: https://github.com/anomalyco/opencode/blob/34e58090595d44e3e7cc37498f16753a98627456/packages/opencode/test/cli/tui/plugin-loader-entrypoint.test.ts#L13-L76
- External plugin API surface test: https://github.com/anomalyco/opencode/blob/34e58090595d44e3e7cc37498f16753a98627456/packages/opencode/test/cli/tui/plugin-loader.test.ts#L199-L283 and #L857-L918
- Commands are prompt templates, not persistent UI: https://github.com/anomalyco/opencode/blob/34e58090595d44e3e7cc37498f16753a98627456/packages/web/src/content/docs/commands.mdx#L10-L193
- Custom tools return tool results, not persistent UI: https://github.com/anomalyco/opencode/blob/34e58090595d44e3e7cc37498f16753a98627456/packages/web/src/content/docs/custom-tools.mdx#L10-L196
- Public docs page that documents general plugins but omits TUI layout API details: https://github.com/anomalyco/opencode/blob/34e58090595d44e3e7cc37498f16753a98627456/packages/web/src/content/docs/plugins.mdx#L67-L209
