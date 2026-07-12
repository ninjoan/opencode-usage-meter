import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const EXPECTED_PACKAGE_FILES = [
  "dist",
  "README.md",
  "LICENSE",
  "SECURITY.md"
] as const;

const FORBIDDEN_PACKAGE_FILES = [
  "src",
  "tests",
  "openspec",
  ".github",
  ".env",
  "node_modules"
] as const;

async function readPackageJson(): Promise<Record<string, unknown>> {
  const packageUrl = new URL("../../package.json", import.meta.url);
  return JSON.parse(await readFile(packageUrl, "utf8")) as Record<string, unknown>;
}

describe("package contents allowlist", () => {
  it("ships only built output and user-facing package documents", async () => {
    const packageJson = await readPackageJson();

    expect(packageJson.files).toEqual(EXPECTED_PACKAGE_FILES);
    for (const forbiddenPath of FORBIDDEN_PACKAGE_FILES) {
      expect(packageJson.files).not.toContain(forbiddenPath);
    }
  });
});
