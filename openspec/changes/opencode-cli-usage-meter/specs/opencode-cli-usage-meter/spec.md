# OpenCode CLI Usage Meter Specification

## Purpose

Define a standalone OpenCode TUI plugin that safely displays Codex and Claude CLI usage in the OpenCode sidebar without credential scraping, internal OpenCode patching, or Gentle-AI runtime ownership.

## Requirements

### Requirement: Public Sidebar Plugin Surface

The plugin MUST register through public `@opencode-ai/plugin/tui` APIs and MUST render persistent `sidebar_content` alongside Context, MCP, and LSP. It MUST NOT register colliding host routes, monkey-patch internals, or require Gentle-AI to own runtime behavior.

#### Scenario: Sidebar content is rendered

- GIVEN OpenCode loads the standalone plugin
- WHEN the session sidebar renders
- THEN the usage meter appears as a `sidebar_content` block beside existing sidebar sections

#### Scenario: Unsupported host mutation is requested

- GIVEN a feature requires arbitrary tabs, panels, status rows, or route replacement
- WHEN the plugin evaluates that feature
- THEN it MUST reject that behavior as out of scope

### Requirement: Provider Probe Support

The plugin MUST probe Codex via official CLI `/status` and Claude via official CLI `/usage` on Linux and macOS first. Windows MUST be reported unsupported in v1.

#### Scenario: Supported provider probe

- GIVEN Linux or macOS with an authenticated provider CLI
- WHEN refresh runs for Codex or Claude
- THEN the plugin invokes only the approved CLI command for that provider

#### Scenario: Unsupported platform

- GIVEN the plugin runs on Windows
- WHEN provider data is requested
- THEN the provider display immediately shows `Data unavailable`

### Requirement: Security Boundary

The plugin MUST NOT read auth files, Keychain, browser cookies, raw tokens, undocumented provider endpoints, or OpenCode internal auth-state readers.

#### Scenario: Token-based shortcut is available

- GIVEN a provider token or auth file exists locally
- WHEN the plugin refreshes usage
- THEN it MUST ignore that credential source and use the provider CLI only

### Requirement: Safe Probe Execution

Provider probes MUST be cancellable, timeout-bounded, single-flight per provider, provider-isolated, shell-injection safe, and run with minimal environment exposure. PTY MAY be used only when plain pipes cannot obtain supported CLI output.

#### Scenario: Probe overlaps or hangs

- GIVEN a provider probe is already running or exceeds its timeout
- WHEN another refresh starts or cancellation is requested
- THEN no overlapping probe runs and the affected provider shows `Data unavailable`

### Requirement: Normalized Usage Model

The plugin MUST normalize provider, window, usage percentage, reset metadata, status, and last refresh time with deterministic provider ordering. It MUST NOT fabricate token counts when CLIs expose only percentages.

#### Scenario: CLI returns percentage only

- GIVEN a provider output includes usage percent but no token count
- WHEN the model is normalized
- THEN the UI shows percentage/reset metadata and omits token counts

### Requirement: Refresh Policy and Failure Gates

The plugin MUST support manual refresh plus adaptive automatic refresh near 2 minutes after recent interaction, 5 minutes active, 15 minutes inactive, and 30 minutes during prolonged inactivity or resource constraints. It MUST avoid overlapping probes and honor rate-limit/error gates.

#### Scenario: Manual and adaptive refresh coexist

- GIVEN the meter is visible
- WHEN manual or scheduled refresh fires
- THEN eligible providers refresh once and blocked providers remain gated

### Requirement: Fail-Soft Display

Missing CLI, unsupported platform/output, timeout, process error, parse failure, or rate-limit gate MUST immediately display exact copy `Data unavailable`. Stale values MUST be discarded and failures MUST NOT be represented as zero.

#### Scenario: Previous value becomes stale

- GIVEN a provider previously displayed usage
- WHEN the next refresh fails
- THEN the old usage is removed and `Data unavailable` is displayed

### Requirement: Parser, Test, Accessibility, and Lifecycle Contract

Parsers MUST be versioned and tolerant of additive CLI output changes. The package MUST include fixture/golden contract tests for provider outputs, readable/accessibility-safe sidebar presentation, and cleanup of timers, probes, and registrations on plugin disposal.

#### Scenario: CLI output changes additively

- GIVEN a fixture with extra non-breaking provider text
- WHEN parser contract tests run
- THEN supported fields still parse or the provider safely shows `Data unavailable`

#### Scenario: Plugin is disposed

- GIVEN OpenCode deactivates the plugin
- WHEN disposal runs
- THEN active probes, refresh timers, and sidebar registrations are cleaned up

## Acceptance Boundaries

- Functional source of truth is this standalone package spec; Gentle-AI registration/recommendation is deferred and non-required.
- Design MUST choose the package test runner because this standalone plugin is outside the Go-only repository runner.

## Non-Goals

- Windows v1 support, provider APIs, credential scraping, undocumented endpoints, internal route collisions, arbitrary OpenCode shell surfaces, native Gentle-AI runtime ownership, and implementation task planning.
