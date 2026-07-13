import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const EXPECTED = {
  packageName: "opencode-cli-usage-meter",
  sourceVersion: "0.0.0",
  repository: "ninjoan/opencode-usage-meter",
  repositoryUrl: "git+https://github.com/ninjoan/opencode-usage-meter.git",
  issuesUrl: "https://github.com/ninjoan/opencode-usage-meter/issues",
  homepage: "https://github.com/ninjoan/opencode-usage-meter#readme",
  npmUrl: "https://www.npmjs.com/package/opencode-cli-usage-meter",
  releaseCommand: "pnpm dlx semantic-release@25.0.1",
  releaseDryRunCommand: "node scripts/release-guard.mjs --dry-run",
  trustedPublishingNodeVersion: "22.14.0",
  trustedPublishingNpmVersion: "11.5.1",
  releaseConcurrencyGroup: "release-ninjoan-opencode-usage-meter-opencode-cli-usage-meter",
  tagFormat: "v${version}",
  packageFiles: ["dist", "README.md", "LICENSE", "SECURITY.md"],
  packedFiles: ["LICENSE","README.md","SECURITY.md","dist/tui.d.ts","dist/tui.js","dist/tui.js.map","package.json"],
  exports: {
    ".": {
      types: "./dist/tui.d.ts",
      import: "./dist/tui.js"
    },
    "./tui": {
      types: "./dist/tui.d.ts",
      import: "./dist/tui.js"
    }
  }
};

const root = new URL("../", import.meta.url);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readText(path) {
  return readFile(new URL(path, root), "utf8");
}

async function readJson(path) {
  return JSON.parse(await readText(path));
}

function objectField(value, fieldName) {
  const field = value?.[fieldName];
  assert(field && typeof field === "object" && !Array.isArray(field), `Missing object field: ${fieldName}`);
  return field;
}

function stringField(value, fieldName) {
  const field = value?.[fieldName];
  assert(typeof field === "string" && field.length > 0, `Missing string field: ${fieldName}`);
  return field;
}

function configuredPlugin(plugins, pluginName) {
  assert(Array.isArray(plugins), "Release plugins must be an array");

  for (const plugin of plugins) {
    if (plugin === pluginName) {
      return {};
    }

    if (Array.isArray(plugin) && plugin[0] === pluginName) {
      return plugin[1] ?? {};
    }
  }

  throw new Error(`Missing release plugin: ${pluginName}`);
}

function assertNoLongLivedTokens(workflow) {
  assert(!/\b(?:NPM_TOKEN|NODE_AUTH_TOKEN|GH_TOKEN|GITHUB_TOKEN|API_KEY|SECRET)\b/.test(workflow), "Release workflow must not name long-lived token secrets");
  assert(!/npm\s+publish/.test(workflow), "Release workflow must publish only through semantic-release");
}

function assertLeastPrivilege(workflow) {
  assert(workflow.includes("contents: read"), "Workflow must default to read-only contents permission");
  assert(workflow.includes("contents: write"), "Release job must have contents write for semantic-release tags");
  assert(workflow.includes("id-token: write"), "Release job must allow npm provenance OIDC");
  assert(!/(?:issues|pull-requests|packages|actions):\s*write/.test(workflow), "Release workflow has broader write permissions than required");
}

function assertCiLeastPrivilege(workflow) {
  assert(workflow.includes("permissions:\n  contents: read"), "CI workflow must default to read-only contents permission");
  assert(!/(?:contents|id-token|issues|pull-requests|packages|actions):\s*write/.test(workflow), "CI workflow has broader write permissions than required");
}

function assertMainOnlyReleaseTrigger(workflow) {
  assert(/on:\n\s+push:\n\s+branches:\n\s+- main/.test(workflow), "Release workflow must trigger only from main pushes");
  assert(!/pull_request|pull_request_target/.test(workflow), "Release workflow must not publish from pull requests");
}

function assertReleaseConcurrency(workflow) {
  const concurrencyBlocks = workflow.match(/^concurrency:/gm) ?? [];
  const expected = `concurrency:\n  group: ${EXPECTED.releaseConcurrencyGroup}\n  cancel-in-progress: false`;

  assert(concurrencyBlocks.length === 1, "Release workflow must define exactly one workflow-level concurrency policy");
  assert(workflow.includes(expected), "Release workflow must serialize repository/package releases without canceling active publication");
  const block = workflow.match(/^concurrency:\n  group: [^\n]+\n  cancel-in-progress: [^\n]+$/m)?.[0] ?? "";
  assert(!/\$\{\{|github\.|run_id|run_number|sha|ref/.test(block), "Release concurrency group must be stable and must not use run-specific values");
}

function assertTrustedPublishingRuntime(workflow) {
  assert(workflow.includes(`node-version: "${EXPECTED.trustedPublishingNodeVersion}"`), "Release workflow must pin a Node version that supports npm trusted publishing");
  assert(workflow.includes(`npm install --global npm@${EXPECTED.trustedPublishingNpmVersion} corepack@0.34.7`), "Release workflow must install the exact npm CLI required for trusted publishing");
  assert(workflow.includes(`test "$(npm --version)" = "${EXPECTED.trustedPublishingNpmVersion}"`), "Release workflow must verify the exact npm CLI version before semantic-release");
  assert(!/^\s*node-version:\s*["']?(?:latest|lts|node|22|24)["']?\s*$/im.test(workflow), "Release workflow must not use a floating Node version");
  assert(!/npm@(?:latest|\^|~)|corepack@(?:latest|\^|~)/.test(workflow), "Release workflow must not use floating npm/corepack installers");
}

function assertReleaseOrder(workflow) {
  const guardIndex = workflow.indexOf("pnpm release:guard");
  const releaseIndex = workflow.indexOf("pnpm release\n");

  assert(guardIndex >= 0, "Release workflow must run the release guard");
  assert(releaseIndex >= 0, "Release workflow must run semantic-release");
  assert(guardIndex < releaseIndex, "Release guard must run before semantic-release");
}

function assertPublicExports(packageJson) {
  assert(packageJson.main === "./dist/tui.js", "Package main must point at the built TUI entry");
  assert(packageJson.types === "./dist/tui.d.ts", "Package types must point at the built declarations");
  assert(JSON.stringify(packageJson.exports) === JSON.stringify(EXPECTED.exports), "Package exports must expose only the public TUI entry points");
}

function assertPackageContents(packageJson) {
  assert(JSON.stringify(packageJson.files) === JSON.stringify(EXPECTED.packageFiles), "Package files must allow only built output and public documents");
}

function assertPackedArchive() {
  const command = "npm pack --json --dry-run --ignore-scripts";
  const output = execFileSync("npm", command.split(" ").slice(1), { cwd: root, encoding: "utf8" });
  const [pack] = JSON.parse(output);
  const files = pack?.files?.map(({ path }) => path).sort();

  assert(JSON.stringify(files) === JSON.stringify(EXPECTED.packedFiles), "npm pack must contain exactly the seven allowlisted files");
  assert(Array.isArray(pack?.bundled) && pack.bundled.length === 0, "npm pack must not contain bundled dependencies");
}

function assertPublishedPackageExists() {
  if (process.env.RELEASE_GUARD_REQUIRE_PUBLISHED !== "true") return;

  try {
    execFileSync("npm", ["view", EXPECTED.packageName, "version", "--json"], { cwd: root, stdio: "pipe" });
  } catch (error) {
    const stderr = String(error?.stderr ?? "");
    const reason = /E404/.test(stderr) ? " (npm E404: first publish bootstrap required)" : "";
    throw new Error(`Automated release refused because the npm package is not verifiably published${reason}`);
  }
}

function gitOutput(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

async function runDryRun() {
  const before = {
    refs: gitOutput(["show-ref", "--head"]),
    tags: gitOutput(["tag", "--list"]),
    status: gitOutput(["status", "--porcelain=v1"]),
    manifest: await readText("package.json")
  };
  const bin = process.env.RELEASE_GUARD_DRY_RUN_BIN ?? "pnpm";
  const args = process.env.RELEASE_GUARD_DRY_RUN_ARGS?.split(" ") ?? ["dlx", "semantic-release@25.0.1", "--dry-run", "--no-ci"];
  execFileSync(bin, args, { cwd: root, stdio: "inherit" });
  assert(gitOutput(["show-ref", "--head"]) === before.refs, "Dry-run mutated Git refs");
  assert(gitOutput(["tag", "--list"]) === before.tags, "Dry-run mutated Git tags");
  assert(gitOutput(["status", "--porcelain=v1"]) === before.status, "Dry-run mutated working tree status");
  assert(await readText("package.json") === before.manifest, "Dry-run mutated package.json");
  console.log("Release dry-run passed without mutation or publication");
}

const packageJson = await readJson("package.json");
const releaseConfig = await readJson(".releaserc.json");
const ciWorkflow = await readText(".github/workflows/ci.yml");
const releaseWorkflow = await readText(".github/workflows/release.yml");

const scripts = objectField(packageJson, "scripts");
const publishConfig = objectField(packageJson, "publishConfig");
const repository = objectField(packageJson, "repository");
const bugs = objectField(packageJson, "bugs");
const npmPlugin = configuredPlugin(releaseConfig.plugins, "@semantic-release/npm");

assert(packageJson.name === EXPECTED.packageName, "Package name must match the npm package identity");
assert(packageJson.version === EXPECTED.sourceVersion, "Source package version must remain semantic-release owned");
assert(packageJson.private === false, "Package must remain publishable");
assertPublicExports(packageJson);
assertPackageContents(packageJson);
assertPackedArchive();
assertPublishedPackageExists();
assert(repository.type === "git", "Repository type must be git");
assert(repository.url === EXPECTED.repositoryUrl, "Repository URL must match release repository");
assert(bugs.url === EXPECTED.issuesUrl, "Bug report URL must match release repository");
assert(packageJson.homepage === EXPECTED.homepage, "Homepage must match release README");
assert(publishConfig.access === "public", "npm access must be public");
assert(publishConfig.provenance === true, "npm provenance must be enabled in publishConfig");
assert(scripts.release === EXPECTED.releaseCommand, "Release command must pin semantic-release");
assert(scripts["release:dry-run"] === EXPECTED.releaseDryRunCommand, "Dry-run command must be non-publishing");
assert(scripts["release:guard"] === "node scripts/release-guard.mjs", "Release guard script must be executable through pnpm");
assert(stringField(scripts, "pack:dry-run") === "pnpm pack --dry-run", "Pack dry-run command must not publish");
assert(Array.isArray(releaseConfig.branches) && releaseConfig.branches.length === 1 && releaseConfig.branches[0] === "main", "Release branches must be limited to main");
assert(releaseConfig.tagFormat === EXPECTED.tagFormat, "Git tag format must match manifest version tags");
assert(npmPlugin.npmPublish === true, "semantic-release npm plugin must publish the npm package");
assert(releaseWorkflow.includes(`github.repository == '${EXPECTED.repository}'`), "Release workflow must be repository-scoped");
assert(releaseWorkflow.includes(EXPECTED.npmUrl), "Release environment URL must match npm package");
assert(releaseWorkflow.includes("NPM_CONFIG_PROVENANCE: \"true\""), "Release workflow must request npm provenance");
assert(ciWorkflow.includes("pnpm install --frozen-lockfile --ignore-scripts"), "CI package install must stay frozen with scripts disabled");
assert(ciWorkflow.includes("pnpm smoke:consumer"), "CI must validate package export-shape/import smoke");
assert(ciWorkflow.includes("pnpm pack:dry-run"), "CI must inspect the package archive without publishing");
assert(ciWorkflow.includes("pnpm release:guard"), "CI must run release metadata guard");
assert(releaseWorkflow.includes("pnpm install --frozen-lockfile"), "Release workflow must keep frozen dependency installation");
assert(releaseWorkflow.includes("pnpm smoke:pty-native"), "Release workflow must preserve native PTY smoke");
assertNoLongLivedTokens(releaseWorkflow);
assertCiLeastPrivilege(ciWorkflow);
assertLeastPrivilege(releaseWorkflow);
assertMainOnlyReleaseTrigger(releaseWorkflow);
assertReleaseConcurrency(releaseWorkflow);
assertTrustedPublishingRuntime(releaseWorkflow);
assertReleaseOrder(releaseWorkflow);

if (process.argv.includes("--dry-run")) await runDryRun();
console.log("Release guard passed");
