import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("process transport shell boundary", () => {
  it("uses Node spawn with shell explicitly disabled", async () => {
    const source = await readFile(new URL("../../src/transport/process.ts", import.meta.url), "utf8");
    expect(source).toContain("shell: false");
    expect(source).not.toMatch(/exec\s*\(/);
    expect(source).not.toMatch(/execFile\s*\(/);
  });
});
