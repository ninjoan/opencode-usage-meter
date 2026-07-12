import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const FORBIDDEN_AUTH_SOURCES = ["keychain", "/.codex", "cookies", "auth.json", "opencode/auth"] as const;

describe("provider credential boundary", () => {
  it("does not contain credential-reader sources", async () => {
    const source = await readFile(new URL("../../src/providers/codex.ts", import.meta.url), "utf8");
    for (const forbidden of FORBIDDEN_AUTH_SOURCES) expect(source.toLowerCase()).not.toContain(forbidden);
  });
});
