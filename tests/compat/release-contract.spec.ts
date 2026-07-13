import { execFile } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const EXPECTED_RELEASE_SCRIPTS = {
  release: "pnpm dlx semantic-release@25.0.1",
  dryRun: "node scripts/release-guard.mjs --dry-run",
  guard: "node scripts/release-guard.mjs"
} as const;

const EXPECTED_RELEASE_CONFIG = {
  branches: ["main"],
  tagFormat: "v${version}",
  npmPlugin: "@semantic-release/npm"
} as const;

const EXPECTED_TRUSTED_PUBLISHING_RUNTIME = {
  node: "22.14.0",
  npm: "11.5.1"
} as const;

const EXPECTED_RELEASE_CONCURRENCY = {
  group: "release-ninjoan-opencode-usage-meter-opencode-cli-usage-meter",
  cancelInProgress: false
} as const;

const EXPECTED_PACKAGE_FILES = [
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "dist/tui.d.ts",
  "dist/tui.js",
  "dist/tui.js.map",
  "package.json"
] as const;

const projectRoot = new URL("../..", import.meta.url);

async function fakeNpm(versionResult: "E404" | "1.2.3") {
  const directory = await mkdtemp(join(tmpdir(), "release-npm-"));
  const npm = join(directory, "npm");
  await writeFile(npm, `#!/bin/sh
if [ "$1" = view ]; then
  ${versionResult === "E404" ? 'echo "npm ERR! code E404" >&2; exit 1' : 'echo \'"1.2.3"\'; exit 0'}
fi
exec "/home/linuxbrew/.linuxbrew/bin/npm" "$@"
`);
  await chmod(npm, 0o755);
  return directory;
}

async function readJsonObject(path: string): Promise<Record<string, unknown>> {
  const parsed = JSON.parse(await readFile(new URL(path, projectRoot), "utf8")) as unknown;
  return expectRecord(parsed, path);
}

async function readText(path: string): Promise<string> {
  return readFile(new URL(path, projectRoot), "utf8");
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  expect(value, label).toBeTypeOf("object");
  expect(value, label).not.toBeNull();
  return value as Record<string, unknown>;
}

function expectArray(value: unknown, label: string): readonly unknown[] {
  expect(Array.isArray(value), label).toBe(true);
  return value as readonly unknown[];
}

function findConfiguredPlugin(
  plugins: readonly unknown[],
  pluginName: string
): Record<string, unknown> {
  for (const plugin of plugins) {
    if (plugin === pluginName) {
      return {};
    }

    if (!Array.isArray(plugin)) {
      continue;
    }

    const [candidateName, candidateOptions] = plugin;
    if (candidateName === pluginName) {
      return expectRecord(candidateOptions, pluginName);
    }
  }

  throw new Error(`Missing release plugin: ${pluginName}`);
}

describe("release readiness contract", () => {
  it("stages semantic-release for public npm provenance without long-lived npm tokens", async () => {
    const packageJson = await readJsonObject("package.json");
    const scripts = expectRecord(packageJson.scripts, "scripts");
    const publishConfig = expectRecord(packageJson.publishConfig, "publishConfig");
    const releaseConfig = await readJsonObject(".releaserc.json");
    const releaseWorkflow = await readText(".github/workflows/release.yml");
    const plugins = expectArray(releaseConfig.plugins, "release plugins");
    const npmPluginOptions = findConfiguredPlugin(
      plugins,
      EXPECTED_RELEASE_CONFIG.npmPlugin
    );

    expect(packageJson.private).toBe(false);
    expect(publishConfig).toEqual({ access: "public", provenance: true });
    expect(scripts.release).toBe(EXPECTED_RELEASE_SCRIPTS.release);
    expect(scripts["release:dry-run"]).toBe(EXPECTED_RELEASE_SCRIPTS.dryRun);
    expect(releaseConfig.branches).toEqual(EXPECTED_RELEASE_CONFIG.branches);
    expect(releaseConfig.tagFormat).toBe(EXPECTED_RELEASE_CONFIG.tagFormat);
    expect(npmPluginOptions.npmPublish).toBe(true);

    expect(releaseWorkflow).toContain("id-token: write");
    expect(releaseWorkflow).toContain("contents: write");
    expect(releaseWorkflow).toContain("NPM_CONFIG_PROVENANCE: \"true\"");
    expect(releaseWorkflow).toContain("pnpm release");
    expect(releaseWorkflow).not.toMatch(/NPM_TOKEN|NODE_AUTH_TOKEN|packages:\s*write/);
    expect(releaseWorkflow).not.toMatch(/issues:\s*write|pull-requests:\s*write|actions:\s*write/);
  });

  it("runs a manifest/tag/npm consistency guard before CI validation and release", async () => {
    const packageJson = await readJsonObject("package.json");
    const scripts = expectRecord(packageJson.scripts, "scripts");
    const ciWorkflow = await readText(".github/workflows/ci.yml");
    const releaseWorkflow = await readText(".github/workflows/release.yml");

    expect(scripts["release:guard"]).toBe(EXPECTED_RELEASE_SCRIPTS.guard);
    expect(ciWorkflow).toContain("pnpm release:guard");
    expect(releaseWorkflow).toContain("pnpm release:guard");

    const { stdout } = await execFileAsync(
      process.execPath,
      ["scripts/release-guard.mjs"],
      { cwd: projectRoot }
    );

    expect(stdout).toContain("Release guard passed");
  });

  it("keeps CI and release workflows least-privilege and unable to publish from PRs", async () => {
    const ciWorkflow = await readText(".github/workflows/ci.yml");
    const releaseWorkflow = await readText(".github/workflows/release.yml");

    expect(ciWorkflow).toContain("permissions:\n  contents: read");
    expect(ciWorkflow).not.toMatch(/id-token:\s*write|contents:\s*write|packages:\s*write/);
    expect(releaseWorkflow).toMatch(/on:\n\s+push:\n\s+branches:\n\s+- main/);
    expect(releaseWorkflow).not.toMatch(/pull_request|pull_request_target/);
    expect(releaseWorkflow).not.toMatch(/packages:\s*write|issues:\s*write|pull-requests:\s*write|actions:\s*write/);
  });

  it("pins release runtime to npm trusted publishing OIDC requirements", async () => {
    const releaseWorkflow = await readText(".github/workflows/release.yml");
    const releaseGuard = await readText("scripts/release-guard.mjs");
    const readme = await readText("README.md");

    expect(releaseWorkflow).toContain(
      `node-version: "${EXPECTED_TRUSTED_PUBLISHING_RUNTIME.node}"`
    );
    expect(releaseWorkflow).toContain(
      `npm install --global npm@${EXPECTED_TRUSTED_PUBLISHING_RUNTIME.npm} corepack@0.34.7`
    );
    expect(releaseWorkflow).toContain("npm --version");
    expect(releaseWorkflow).not.toMatch(/^\s*node-version:\s*["']?(?:latest|lts|node|22|24)["']?\s*$/im);
    expect(releaseWorkflow).not.toMatch(/npm@(?:latest|\^|~)|corepack@(?:latest|\^|~)/);
    expect(releaseWorkflow).not.toMatch(/npm\s+publish|NPM_TOKEN|NODE_AUTH_TOKEN/);
    expect(releaseGuard).toContain(
      `trustedPublishingNodeVersion: "${EXPECTED_TRUSTED_PUBLISHING_RUNTIME.node}"`
    );
    expect(releaseGuard).toContain(
      `trustedPublishingNpmVersion: "${EXPECTED_TRUSTED_PUBLISHING_RUNTIME.npm}"`
    );
    expect(readme).toContain("npm trusted publisher setup remains required");
    expect(readme).toContain("E404");
  });

  it("keeps package smoke and archive verification scoped to exports and contents", async () => {
    const packageJson = await readJsonObject("package.json");
    const scripts = expectRecord(packageJson.scripts, "scripts");
    const ciWorkflow = await readText(".github/workflows/ci.yml");
    const releaseWorkflow = await readText(".github/workflows/release.yml");
    const readme = await readText("README.md");

    expect(scripts["pack:dry-run"]).toBe("pnpm pack --dry-run");
    expect(scripts["smoke:consumer"]).toMatch(/import\(specifier\)/);
    expect(ciWorkflow).toContain("pnpm install --frozen-lockfile --ignore-scripts");
    expect(ciWorkflow).toContain("pnpm smoke:consumer");
    expect(ciWorkflow).toContain("pnpm pack:dry-run");
    expect(releaseWorkflow).toContain("pnpm install --frozen-lockfile");
    expect(releaseWorkflow).toContain("pnpm smoke:consumer");
    expect(releaseWorkflow).toContain("pnpm pack:dry-run");
    expect(readme).toContain(
      "It does not exercise plugin behavior or require the optional native fallback."
    );
  });

  it("gates release on same-commit package and Ubuntu/macOS native validation", async () => {
    const releaseWorkflow = await readText(".github/workflows/release.yml");

    expect(releaseWorkflow).toMatch(/package-validation:\s*[\s\S]*runs-on: ubuntu-latest/);
    expect(releaseWorkflow).toMatch(/native-pty-validation:\s*[\s\S]*os: \[ubuntu-latest, macos-latest\]/);
    expect(releaseWorkflow).toContain("name: package");
    expect(releaseWorkflow).toContain("name: native-pty (${{ matrix.os }})");
    expect(releaseWorkflow).toMatch(/release:\s*[\s\S]*needs: \[package-validation, native-pty-validation\]/);
    expect(releaseWorkflow.match(/git rev-parse HEAD/g)).toHaveLength(3);
    expect(releaseWorkflow.match(/github\.sha/g)).toHaveLength(6);

    const releaseJob = releaseWorkflow.slice(releaseWorkflow.indexOf("  release:"));
    expect(releaseJob).toContain("contents: write");
    expect(releaseJob).toContain("id-token: write");
    expect(releaseWorkflow.slice(0, releaseWorkflow.indexOf("  release:"))).not.toMatch(
      /contents:\s*write|id-token:\s*write/
    );
  });

  it("serializes release workflow runs without canceling an active publication", async () => {
    const releaseWorkflow = await readText(".github/workflows/release.yml");
    const concurrencyBlock = releaseWorkflow.match(
      /^concurrency:\n  group: ([^\n]+)\n  cancel-in-progress: ([^\n]+)$/m
    );

    expect(concurrencyBlock?.[1]).toBe(EXPECTED_RELEASE_CONCURRENCY.group);
    expect(concurrencyBlock?.[2]).toBe(String(EXPECTED_RELEASE_CONCURRENCY.cancelInProgress));
    expect(concurrencyBlock?.[0]).not.toMatch(/\$\{\{|github\.|run_id|run_number|sha|ref/);
    expect(releaseWorkflow.match(/^concurrency:/gm)).toHaveLength(1);
  });

  it("validates the actual npm pack file list and refuses an unbootstrapped package", async () => {
    const releaseGuard = await readText("scripts/release-guard.mjs");
    const releaseWorkflow = await readText(".github/workflows/release.yml");

    expect(releaseGuard).toContain("npm pack --json --dry-run --ignore-scripts");
    expect(releaseGuard).toContain(JSON.stringify(EXPECTED_PACKAGE_FILES));
    expect(releaseGuard).toMatch(/bundled.*length/i);
    expect(releaseGuard).toMatch(/E404/);
    expect(releaseWorkflow).toContain("RELEASE_GUARD_REQUIRE_PUBLISHED: \"true\"");
  });

  it("behaviorally rejects npm E404 and accepts an existing package", async () => {
    for (const [npmResult, succeeds] of [["E404", false], ["1.2.3", true]] as const) {
      const directory = await fakeNpm(npmResult);
      try {
        const execution = execFileAsync(process.execPath, ["scripts/release-guard.mjs"], {
          cwd: projectRoot,
          env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, RELEASE_GUARD_REQUIRE_PUBLISHED: "true" }
        });
        if (succeeds) expect((await execution).stdout).toContain("Release guard passed");
        else await expect(execution).rejects.toMatchObject({ stderr: expect.stringContaining("npm E404: first publish bootstrap required") });
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }
  });

  it("runs the production dry-run guard without mutating release state", async () => {
    const before = await execFileAsync("git", ["show-ref", "--head"], { cwd: projectRoot });
    const status = await execFileAsync("git", ["status", "--porcelain=v1"], { cwd: projectRoot });
    const manifest = await readText("package.json");
    const { stdout } = await execFileAsync(process.execPath, ["scripts/release-guard.mjs", "--dry-run"], {
      cwd: projectRoot,
      env: { ...process.env, RELEASE_GUARD_DRY_RUN_BIN: process.execPath, RELEASE_GUARD_DRY_RUN_ARGS: "--version" }
    });
    expect(stdout).toContain("Release dry-run passed without mutation");
    expect((await execFileAsync("git", ["show-ref", "--head"], { cwd: projectRoot })).stdout).toBe(before.stdout);
    expect((await execFileAsync("git", ["status", "--porcelain=v1"], { cwd: projectRoot })).stdout).toBe(status.stdout);
    expect(await readText("package.json")).toBe(manifest);
  });
});
