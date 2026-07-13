import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { parseClaudeUsage } from "../../../src/parsers/claude/v1.js";
import { assertFixtureTextIsSafe } from "../../support/fixture-policy.js";

async function readSafeFixture(name: string): Promise<string> {
  const fixtureUrl = new URL(`../../fixtures/claude/${name}`, import.meta.url);
  const text = await readFile(fixtureUrl, "utf8");
  return assertFixtureTextIsSafe(fixtureUrl.pathname, text);
}

describe("Claude usage parser v1", () => {
  it("normalizes official session and weekly windows without fabricated fields", async () => {
    await expect(parseClaudeUsage(await readSafeFixture("usage-basic.txt"))).resolves.toEqual({
      windows: [
        { label: "Session 5h", percentRemaining: 64, reset: "2h 10m" },
        { label: "Weekly", percentRemaining: 21, reset: "Monday 09:00" }
      ]
    });
  });

  it("includes exposed per-model windows only when the CLI output contains them", async () => {
    await expect(parseClaudeUsage(await readSafeFixture("usage-models.txt"))).resolves.toEqual({
      windows: [
        { label: "Session 5h", percentRemaining: 88 },
        { label: "Weekly", percentRemaining: 52 },
        { label: "Model Opus", percentRemaining: 12 }
      ]
    });
  });

  it("rejects malformed or terminal-control-only output instead of fabricating zero", async () => {
    await expect(parseClaudeUsage("Claude usage\nNo quota table available")).resolves.toBeUndefined();
    await expect(parseClaudeUsage("\u001b[31mSession 5h: not-a-number\u001b[0m")).resolves.toBeUndefined();
  });

  it.each(["101", "164", "-1", "64.5", "value64", "64oops"])("rejects invalid percentage token %s", async (percent) => {
    await expect(parseClaudeUsage(`Session 5h: ${percent}% remaining`)).resolves.toBeUndefined();
  });

  it("accepts boundary percentages and ignores malformed mixed lines", async () => {
    await expect(parseClaudeUsage("Session 5h: 0% remaining\nWeekly: 164% remaining\nModel Opus: 100% remaining")).resolves.toEqual({
      windows: [{ label: "Session 5h", percentRemaining: 0 }, { label: "Model Opus", percentRemaining: 100 }]
    });
  });
});
