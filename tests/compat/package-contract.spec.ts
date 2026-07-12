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

async function readCiWorkflow(): Promise<string> {
  const workflowUrl = new URL("../../.github/workflows/ci.yml", import.meta.url);
  return readFile(workflowUrl, "utf8");
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

  it("installs a compatible pinned Corepack without bypassing integrity checks", async () => {
    const workflow = await readCiWorkflow();

    expect(workflow).toContain(
      "npm install --global corepack@0.34.7 && corepack enable && corepack prepare pnpm@11.2.0 --activate"
    );
    expect(workflow).not.toMatch(/corepack@(latest|\^|~)|COREPACK_INTEGRITY_KEYS/);
  });

  it("validates the packed archive through its public consumer exports in CI", async () => {
    const packageJson = await readPackageJson();
    const scripts = expectRecord(packageJson.scripts, "scripts");
    const workflow = await readCiWorkflow();

    expect(scripts["smoke:consumer"]).toMatch(/^node --input-type=module -e /);
    expect(scripts["smoke:consumer"]).toMatch(/^node --input-type=module -e "/);
    expect(scripts["smoke:consumer"]).not.toMatch(/^node --input-type=module -e '/);
    expect(scripts["smoke:consumer"]).not.toContain("--offline");
    expect(scripts["smoke:consumer"]).toMatch(/['"]--ignore-scripts['"]/);
    expect(scripts["smoke:consumer"]).toMatch(/name\+['"]\/tui['"]/);
    expect(scripts["smoke:consumer"]).toContain("finally{");
    expect(scripts["smoke:consumer"]).not.toContain("tests/compat/consumer-smoke.mjs");
    expect(workflow).toContain("pnpm smoke:consumer");
    expect(workflow).not.toContain("pnpm smoke:built-package");
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
