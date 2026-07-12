import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("provider network boundary", () => {
  it("does not use HTTP clients or provider endpoints", async () => {
    const source = await readFile(new URL("../../src/providers/codex.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/\bfetch\b|https?:\/\/|node:https|axios/i);
  });
});
