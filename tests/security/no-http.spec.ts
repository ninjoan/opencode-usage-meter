import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("provider network boundary", () => {
  it("does not use HTTP clients or provider endpoints", async () => {
    const source = await Promise.all([
      readFile(new URL("../../src/providers/codex.ts", import.meta.url), "utf8"),
      readFile(new URL("../../src/providers/claude.ts", import.meta.url), "utf8"),
      readFile(new URL("../../src/providers/registry.ts", import.meta.url), "utf8")
    ]).then((parts) => parts.join("\n"));
    expect(source).not.toMatch(/\bfetch\b|https?:\/\/|node:https|axios/i);
  });
});
