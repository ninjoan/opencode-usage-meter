import { describe, expect, it } from "vitest";

import { parseCodexStatus } from "../../../src/parsers/codex/v1.js";

const SANITIZED_STATUS_FIXTURES = {
  additive: "Codex status\nUsage: 42%\nResets in 1h 15m\nAdditional heading",
  boundaries: ["Usage: 0%", "Usage: 100%"],
  malformedReset: "Usage: 42%\nResets in \u001b]8;;https://example.test\u0007\u001b[31m\u0001",
} as const;
const SANITIZED_STATUS_GOLDENS = {
  additive: { percentage: 42, reset: "1h 15m" },
  boundaries: [{ percentage: 0 }, { percentage: 100 }],
  malformedReset: { percentage: 42 },
} as const;

describe("Codex status parser v1", () => {
  it("normalizes stable percentage and reset fields from sanitized output", () => {
    expect(parseCodexStatus(SANITIZED_STATUS_FIXTURES.additive)).toEqual(SANITIZED_STATUS_GOLDENS.additive);
    expect(SANITIZED_STATUS_FIXTURES.boundaries.map(parseCodexStatus)).toEqual(SANITIZED_STATUS_GOLDENS.boundaries);
    expect(parseCodexStatus(SANITIZED_STATUS_FIXTURES.malformedReset)).toEqual(SANITIZED_STATUS_GOLDENS.malformedReset);
  });
  it("rejects output without a stable percentage instead of fabricating usage", () => {
    expect(parseCodexStatus("Status is available\nResets tomorrow")).toBeUndefined();
  });
});
