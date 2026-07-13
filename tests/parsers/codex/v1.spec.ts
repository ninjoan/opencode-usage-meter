import { describe, expect, it } from "vitest";

import { parseCodexStatus } from "../../../src/parsers/codex/v1.js";

const SANITIZED_STATUS_FIXTURES = {
  additive: "Codex status\nUsage: 42%\nResets in 1h 15m\nAdditional heading",
  boundaries: ["Usage: 0%", "Usage: 100%"],
  malformedReset: "Usage: 42%\nResets in \u001b]8;;https://example.test\u0007\u001b[31m\u0001",
  c1Controls: "Usage: 42%\nResets in 1h\u009b31m\u009dunsafe\u009c 15m\u0085ignored",
} as const;
const SANITIZED_STATUS_GOLDENS = {
  additive: { windows: [{ label: "5h", percentRemaining: 42, reset: "1h 15m" }] },
  boundaries: [{ windows: [{ label: "5h", percentRemaining: 0 }] }, { windows: [{ label: "5h", percentRemaining: 100 }] }],
  malformedReset: { windows: [{ label: "5h", percentRemaining: 42 }] },
  c1Controls: { windows: [{ label: "5h", percentRemaining: 42, reset: "1h 15mignored" }] },
} as const;

describe("Codex status parser v1", () => {
  it("normalizes stable percentage and reset fields from sanitized output", () => {
    expect(parseCodexStatus(SANITIZED_STATUS_FIXTURES.additive)).toEqual(SANITIZED_STATUS_GOLDENS.additive);
    expect(SANITIZED_STATUS_FIXTURES.boundaries.map(parseCodexStatus)).toEqual(SANITIZED_STATUS_GOLDENS.boundaries);
    expect(parseCodexStatus(SANITIZED_STATUS_FIXTURES.malformedReset)).toEqual(SANITIZED_STATUS_GOLDENS.malformedReset);
    expect(parseCodexStatus(SANITIZED_STATUS_FIXTURES.c1Controls)).toEqual(SANITIZED_STATUS_GOLDENS.c1Controls);
  });
  it("rejects output without a stable percentage instead of fabricating usage", () => {
    expect(parseCodexStatus("Status is available\nResets tomorrow")).toBeUndefined();
  });
  it("validates the full percentage token and keeps valid lines from mixed output", () => {
    for (const value of ["101%", "164%", "-1%", "64.5%"])
      expect(parseCodexStatus(`Usage: ${value}\nResets tomorrow`)).toBeUndefined();

    expect(parseCodexStatus("Usage: 164%\nWeekly limit: 72%\nResets in 2d")).toEqual({
      windows: [{ label: "Weekly", percentRemaining: 72, reset: "2d" }],
    });
  });
});
