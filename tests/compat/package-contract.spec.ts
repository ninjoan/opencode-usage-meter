import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const EXPECTED_PEER_DEPENDENCIES = {
  "@opencode-ai/plugin": ">=1.17.18 <2",
  "@opentui/core": ">=0.4.3 <0.5",
  "@opentui/solid": ">=0.4.3 <0.5",
  "solid-js": ">=1.9.12 <2"
} as const;

const EXPECTED_EXPORTS = {
  ".": {
    types: "./dist/tui.d.ts",
    import: "./dist/tui.js"
  },
  "./tui": {
    types: "./dist/tui.d.ts",
    import: "./dist/tui.js"
  }
} as const;

async function readPackageJson(): Promise<Record<string, unknown>> {
  const packageUrl = new URL("../../package.json", import.meta.url);
  return JSON.parse(await readFile(packageUrl, "utf8")) as Record<string, unknown>;
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  expect(value, label).toBeTypeOf("object");
  expect(value, label).not.toBeNull();
  return value as Record<string, unknown>;
}

describe("package export and runtime contract", () => {
  it("forbids focused tests in Vitest", async () => {
    const config = await import("../../vitest.config.js");

    expect(config.default.test?.allowOnly).toBe(false);
  });

  it("pins pnpm and the supported Node runtime", async () => {
    const packageJson = await readPackageJson();
    const engines = expectRecord(packageJson.engines, "engines");

    expect(packageJson.packageManager).toBe("pnpm@11.2.0");
    expect(engines.node).toBe(">=22.13");
  });

  it("exposes only the public TUI entry points", async () => {
    const packageJson = await readPackageJson();
    const exports = expectRecord(packageJson.exports, "exports");

    expect(packageJson.main).toBe("./dist/tui.js");
    expect(packageJson.types).toBe("./dist/tui.d.ts");
    expect(exports).toEqual(EXPECTED_EXPORTS);
    expect(exports).not.toHaveProperty("./runtime");
  });

  it("declares the OpenCode/OpenTUI/Solid compatibility floor as peers", async () => {
    const packageJson = await readPackageJson();
    const peerDependencies = expectRecord(
      packageJson.peerDependencies,
      "peerDependencies"
    );

    expect(peerDependencies).toEqual(EXPECTED_PEER_DEPENDENCIES);
  });
});
