/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";

import { PROVIDER, type UsageSnapshot } from "../../src/domain/usage.js";
import { renderSidebarSection } from "../../src/ui/sidebar-section.js";

describe("Codex sidebar section", () => {
  it("renders loading and available percentage/reset states", () => {
    expect(renderSidebarSection(PROVIDER.CODEX, { status: "loading" })).toEqual(["Codex", "Loading…"]);
    expect(renderSidebarSection(PROVIDER.CODEX, { provider: PROVIDER.CODEX, status: "available", percentage: 42, reset: "1h", refreshedAt: 1 } satisfies UsageSnapshot)).toEqual(["Codex", "42% · Resets 1h"]);
  });
  it("renders exact unavailable copy and never retains a stale percentage", () => {
    expect(renderSidebarSection(PROVIDER.CODEX, { provider: PROVIDER.CODEX, status: "unavailable", refreshedAt: 2 } satisfies UsageSnapshot)).toEqual(["Codex", "Data unavailable"]);
  });
});
