/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";

import { PROVIDER, PROVIDER_LABEL, USAGE_STATUS, type Provider, type UsageSnapshot } from "../../src/domain/usage.js";
import { formatSidebarBody, renderProviderRow, renderUsageSidebar } from "../../src/ui/sidebar.js";

function snapshot(provider: Provider, windows: UsageSnapshot["windows"]): UsageSnapshot {
  return { provider, label: PROVIDER_LABEL[provider], status: USAGE_STATUS.AVAILABLE, windows, refreshedAt: 1 };
}

describe("multi-provider sidebar", () => {
  it("shows collapsed availability summary and expanded provider-isolated rows", () => {
    const codex = snapshot(PROVIDER.CODEX, [{ label: "5h", percentRemaining: 42, reset: "1h" }]);
    const claude = { provider: PROVIDER.CLAUDE, label: PROVIDER_LABEL[PROVIDER.CLAUDE], status: USAGE_STATUS.UNAVAILABLE, windows: [], refreshedAt: 2 } satisfies UsageSnapshot;

    expect(renderUsageSidebar([claude, codex], false)).toMatchObject({
      title: "CLI Usage",
      expanded: false,
      summary: "1/2"
    });
    expect(renderUsageSidebar([claude, codex], true).rows.map((row) => [row.label, row.summary])).toEqual([
      ["Codex", "42% · Resets 1h"],
      ["Claude", "Data unavailable"]
    ]);
  });

  it("renders exact Data unavailable when no supported provider has data", () => {
    expect(renderUsageSidebar([], false).summary).toBe("Data unavailable");
    expect(renderProviderRow({ provider: PROVIDER.CLAUDE, label: PROVIDER_LABEL[PROVIDER.CLAUDE], status: USAGE_STATUS.UNAVAILABLE, windows: [], refreshedAt: 1 }).summary).toBe("Data unavailable");
  });

  it("formats every expanded provider window with bars, reset labels, and accessible text", () => {
    const view = renderUsageSidebar([
      snapshot(PROVIDER.CODEX, [
        { label: "5h", percentRemaining: 42, reset: "1h" },
        { label: "Weekly", percentRemaining: 77, reset: "Sunday" }
      ]),
      snapshot(PROVIDER.CLAUDE, [
        { label: "Session 5h", percentRemaining: 64, reset: "2h" },
        { label: "Weekly", percentRemaining: 21 },
        { label: "Model Opus", percentRemaining: 12 }
      ])
    ], true);

    expect(formatSidebarBody(view)).toContain("Codex");
    expect(formatSidebarBody(view)).toContain("5h 42% · Resets 1h");
    expect(formatSidebarBody(view)).toContain("Weekly 77% · Resets Sunday");
    expect(formatSidebarBody(view)).toContain("Claude");
    expect(formatSidebarBody(view)).toContain("Session 5h 64% · Resets 2h");
    expect(formatSidebarBody(view)).toContain("Weekly 21%");
    expect(formatSidebarBody(view)).toContain("Model Opus 12%");
    expect(formatSidebarBody(view)).toContain("Codex Weekly 77% remaining, resets Sunday");
    expect(formatSidebarBody(renderUsageSidebar(view.rows as never, false))).toBe("2/2");
  });

  it("keeps unavailable rows provider-isolated and truncates narrow labels before values", () => {
    const view = renderUsageSidebar([
      snapshot(PROVIDER.CODEX, [{ label: "Very long weekly quota label", percentRemaining: 100 }]),
      { provider: PROVIDER.CLAUDE, label: PROVIDER_LABEL[PROVIDER.CLAUDE], status: USAGE_STATUS.UNAVAILABLE, windows: [], refreshedAt: 2 }
    ], true);

    expect(formatSidebarBody(view, 26)).toContain("Very long… 100%");
    expect(formatSidebarBody(view, 26)).toContain("Claude: Data unavailable");
    expect(formatSidebarBody(renderUsageSidebar(view.rows as never, false))).toBe("1/2");
  });
});
