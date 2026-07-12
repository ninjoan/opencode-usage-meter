# OpenCode CLI Usage Meter Specification

## Purpose

Safe supported CLI quota display.

## Requirements

### Requirement: Public Expandable Sidebar

The plugin MUST use public `@opencode-ai/plugin/tui` APIs to render one persistent `sidebar_content` section titled `CLI Usage`. It MUST expand/collapse, default expanded, keep expansion in memory, write no files.

#### Scenario: Sidebar toggle
- GIVEN the OpenCode sidebar renders
- WHEN the user toggles `CLI Usage`
- THEN the section expands or collapses via public TUI behavior
- AND state remains session-local

### Requirement: Provider Availability Views

Collapsed view MUST show `1/2`-style availability when any supported provider has data, or exact `Data unavailable` when none do. Expanded view MUST list adapters: Codex, Claude, then future registered adapters. OpenCode-configured providers MUST NOT imply quota support.

#### Scenario: Mixed availability
- GIVEN Codex has data and Claude is unavailable
- WHEN the section is collapsed then expanded
- THEN collapsed copy shows `1/2`
- AND expanded rows remain provider-isolated

### Requirement: Provider Windows

Codex MUST expose 5h, weekly, and reset metadata from official `codex /status`. Claude MUST expose current/session 5h and weekly/all-model windows from official `claude /usage`. Claude per-model windows MAY render only when CLI-exposed.

#### Scenario: Window normalization
- GIVEN official CLI output exposes supported windows
- WHEN provider data is normalized
- THEN exposed windows render; absent windows are omitted, never fabricated

### Requirement: Refresh Isolation

Manual refresh, public `usage.refresh`, and adaptive auto-refresh MUST refresh all supported providers with isolation, single-flight, cleanup, and rate/error gates. Cadence SHOULD remain near 2m recent, 5m active, 15m inactive, 30m constrained/inactive.

#### Scenario: Partial refresh failure
- GIVEN Codex succeeds and Claude fails
- WHEN manual refresh or `usage.refresh` runs
- THEN Codex remains available
- AND Claude shows exact `Data unavailable`

### Requirement: Safe CLI Boundary

The plugin MUST run cancellable, timeout-bounded, shell-injection-safe probes with minimal environment and only official CLIs: `codex /status`, `claude /usage`. It MUST NOT access credentials, auth files, Keychain, cookies, tokens, provider APIs, private endpoints, or OpenCode auth state. Plain pipes MUST be first; PTY MAY be added only if RED proves required. Linux/macOS are supported; Windows MUST not execute commands.

#### Scenario: Forbidden shortcut exists
- GIVEN credentials or private endpoints exist locally
- WHEN provider usage refreshes
- THEN the plugin ignores them
- AND invokes only the official CLI

#### Scenario: Windows runtime
- GIVEN the plugin runs on Windows
- WHEN refresh is requested
- THEN all providers show `Data unavailable` and no command executes

### Requirement: Percent-Remaining Presentation

Bars and labels MUST show percent remaining, clamp 0–100, include accessible text, and MAY include reset metadata. Unknown, failed, or stale data MUST NOT render zero.

#### Scenario: Out-of-range percent
- GIVEN a parser returns -5 or 140 percent remaining
- WHEN the provider row renders
- THEN visible and accessible values are clamped to 0–100

### Requirement: Fail-Soft Data Contract

Missing CLI, unsupported platform/output, timeout, process error, parse failure, or gate denial MUST render exact `Data unavailable`. Stale values MUST be discarded.

#### Scenario: Stale value replaced
- GIVEN a provider previously displayed usage
- WHEN the next refresh fails
- THEN the old value is removed
- AND the provider shows `Data unavailable`, not zero

### Requirement: Mockable Acceptance and Lifecycle

Acceptance MUST use a deterministic in-process plugin behavior harness with fake Codex/Claude transport responses and no real credentials, network, private accounts, packed-package behavior, or fake executables. Disposal MUST clean timers, probes, registrations, commands, and session memory.

#### Scenario: Plugin behavior harness
- GIVEN fake Codex and Claude transport responses emit fixtures
- WHEN tests run in an in-process OpenCode/plugin harness importing the source TUI plugin
- THEN registration, refresh, toggle, partial failure, and disposal are verified without credentials, network, fake executables, or packed-package behavior

## Acceptance Boundaries

- PR3 covers UI, Claude, isolation, security, cleanup, and mockable acceptance.
- Gentle-AI registration is deferred; PTY is RED-gated.

## Non-Goals

- Treating OpenCode configured providers as quota-supported.
- Windows execution in v1.
- Provider APIs, credential scraping, auth-state readers, private endpoints, route collisions, arbitrary shell surfaces, persisted expansion, task planning.
