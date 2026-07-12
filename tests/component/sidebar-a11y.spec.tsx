/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";

import { PROVIDER, PROVIDER_LABEL, USAGE_STATUS, type UsageSnapshot } from "../../src/domain/usage.js";
import { formatSidebarBody, renderProviderRow, renderUsageSidebar } from "../../src/ui/sidebar.js";

describe("sidebar accessibility and percent clamping", () => {
  it("clamps visible bars and accessible text to the 0-100 range", () => {
    const row = renderProviderRow({
      provider: PROVIDER.CODEX,
      label: PROVIDER_LABEL[PROVIDER.CODEX],
      status: USAGE_STATUS.AVAILABLE,
      windows: [
        { label: "5h", percentRemaining: 140, reset: "soon" },
        { label: "Weekly", percentRemaining: -5 }
      ],
      refreshedAt: 1
    } satisfies UsageSnapshot);

    expect(row.windows.map((window) => window.text)).toEqual(["5h 100% · Resets soon", "Weekly 0%"]);
    expect(row.windows.map((window) => window.bar)).toEqual(["██████████", "░░░░░░░░░░"]);
    expect(row.windows.map((window) => window.accessibleText)).toEqual([
      "Codex 5h 100% remaining, resets soon",
      "Codex Weekly 0% remaining"
    ]);
    expect(formatSidebarBody(renderUsageSidebar([{ provider: PROVIDER.CODEX, label: PROVIDER_LABEL[PROVIDER.CODEX], status: USAGE_STATUS.AVAILABLE, windows: [{ label: "5h", percentRemaining: 140, reset: "soon" }], refreshedAt: 1 }], true))).toContain("Codex 5h 100% remaining, resets soon");
  });
});
