import { access, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const EXPECTED = {
  packageName: "opencode-cli-usage-meter",
  firstReleaseVersion: "0.1.0",
  repository: "ninjoan/opencode-usage-meter",
  registry: "https://registry.npmjs.org",
  repositoryUrl: "git+https://github.com/ninjoan/opencode-usage-meter.git",
  issuesUrl: "https://github.com/ninjoan/opencode-usage-meter/issues",
  homepage: "https://github.com/ninjoan/opencode-usage-meter#readme",
  packageFiles: ["dist", "README.md", "LICENSE", "SECURITY.md"],
  packedFiles: ["LICENSE", "README.md", "SECURITY.md", "dist/tui.d.ts", "dist/tui.js", "dist/tui.js.map", "package.json"],
  requiredChecks: ["package", "native-pty (ubuntu-latest)", "native-pty (macos-latest)"],
  checkAppId: "15368",
  checkAppSlug: "github-actions",
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
const SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readText(path) {
  return readFile(new URL(path, root), "utf8");
}

async function readJson(path) {
  return JSON.parse(await readText(path));
}

async function exists(path) {
  try {
    await access(new URL(path, root));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
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

function gitOutput(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

function gitSucceeds(args) {
  try {
    execFileSync("git", args, { cwd: root, stdio: "pipe" });
    return true;
  } catch (error) {
    if ([1, 2].includes(error?.status)) return false;
    throw error;
  }
}

function fetchCheckEvidence(reviewedSha) {
  execFileSync("gh", ["auth", "status", "--hostname", "github.com"], { cwd: root, stdio: "pipe" });
  return execFileSync(
    "gh",
    [
      "api",
      `repos/${EXPECTED.repository}/commits/${reviewedSha}/check-runs`,
      "--paginate",
      "--jq",
       '.check_runs[] | [.name,.head_sha,.status,(.conclusion // ""),.completed_at,.id,.app.slug,(.app.id|tostring),.details_url] | @tsv'
    ],
    { cwd: root, encoding: "utf8" }
  );
}

function fetchRunEvidence(runId) {
  return execFileSync(
    "gh",
    ["api", `repos/${EXPECTED.repository}/actions/runs/${runId}`, "--jq", '[.name,.path,.head_sha,.repository.full_name,.status,(.conclusion // "")] | @tsv'],
    { cwd: root, encoding: "utf8" }
  ).trim();
}

async function mutationSnapshot() {
  return {
    status: gitOutput(["status", "--porcelain=v1"]),
    manifest: await readText("package.json")
  };
}

async function assertNoMutation(before) {
  assert(gitOutput(["status", "--porcelain=v1"]) === before.status, "Release guard mutated working tree status");
  assert(await readText("package.json") === before.manifest, "Release guard mutated package.json");
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
  const output = execFileSync("npm", ["pack", "--json", "--dry-run", "--ignore-scripts"], { cwd: root, encoding: "utf8" });
  const [pack] = JSON.parse(output);
  const files = pack?.files?.map(({ path }) => path).sort();

  assert(JSON.stringify(files) === JSON.stringify(EXPECTED.packedFiles), "npm pack must contain exactly the seven allowlisted files");
  assert(Array.isArray(pack?.bundled) && pack.bundled.length === 0, "npm pack must not contain bundled dependencies");
}

async function assertNoAutomatedReleaseFiles() {
  assert(!(await exists(".github/workflows/release.yml")), "Automated release workflow is outside the current manual-release scope");
  assert(!(await exists(".releaserc.json")), "Semantic Release config is outside the current manual-release scope");
}

function assertNoAutomatedReleaseScripts(packageJson) {
  const scripts = objectField(packageJson, "scripts");
  const serialized = JSON.stringify(packageJson);

  assert(scripts["release:guard"] === "node scripts/release-guard.mjs --package-only", "Release guard script must run portable package validation through pnpm");
  assert(scripts["release:verify"] === "node scripts/release-guard.mjs", "Strict release verification must run without package-only mode");
  assert(scripts.release === undefined, "Package scripts must not expose automated release publishing");
  assert(scripts["release:dry-run"] === undefined, "Package scripts must not expose Semantic Release dry-run publishing paths");
  assert(!/semantic-release|pnpm\s+dlx/.test(serialized), "Package metadata must not reference Semantic Release or pnpm dlx release paths");
  assert(stringField(scripts, "pack:dry-run") === "pnpm pack --dry-run", "Pack dry-run command must not publish");
}

function assertCiWorkflow(ciWorkflow) {
  assert(ciWorkflow.includes("permissions:\n  contents: read"), "CI workflow must default to read-only contents permission");
  assert(!/(?:contents|id-token|issues|pull-requests|packages|actions):\s*write/.test(ciWorkflow), "CI workflow has broader write permissions than required");
  assert(!/npm\s+publish|NPM_TOKEN|NODE_AUTH_TOKEN|semantic-release|pnpm\s+dlx/.test(ciWorkflow), "CI workflow must not publish or invoke automated release tooling");
  assert(ciWorkflow.includes("pnpm install --frozen-lockfile --ignore-scripts"), "CI package install must stay frozen with scripts disabled");
  assert(ciWorkflow.includes("pnpm typecheck && pnpm build && pnpm test"), "CI package validation must build before dist-dependent tests");
  assert(ciWorkflow.includes("pnpm smoke:consumer"), "CI must validate package export-shape/import smoke");
  assert(ciWorkflow.includes("pnpm smoke:pty-native"), "CI must preserve native PTY smoke");
  assert(ciWorkflow.includes("pnpm pack:dry-run"), "CI must inspect the package archive without publishing");
  assert(ciWorkflow.includes("pnpm audit:prod"), "CI must preserve production audit checks");
  assert(ciWorkflow.includes("pnpm release:guard"), "CI must run release metadata guard");
  assert(ciWorkflow.includes("os: [ubuntu-latest, macos-latest]"), "CI must keep Ubuntu and macOS native validation");
}

function assertManualReleaseDocs(readme, security) {
  const combined = `${readme}\n${security}`;

  assert(readme.includes("Manual release only"), "README must define the manual release process");
  assert(readme.includes("0.1.0"), "README must define the first release version policy");
  assert(!readme.includes("npm version --no-git-tag-version"), "README must not mutate the reviewed release version");
  assert(readme.includes("version bump must be merged as a reviewed PR before publish"), "README must require reviewed version bumps");
  assert(combined.includes("first manual npm release has no provenance"), "Manual first release docs must state the accepted no-provenance bootstrap limitation");
  assert(combined.includes("write-required 2FA"), "Manual first release docs must require maintainer attestation for npm write-required 2FA");
  assert(combined.includes("`npm whoami` confirms identity only; it does not prove 2FA"), "Manual release docs must not claim npm whoami proves 2FA");
  assert(combined.includes("registry-controlled OTP challenge"), "Manual release docs must state the interactive OTP challenge is registry-controlled");
  assert(combined.includes("No secrets are stored"), "Manual release docs must forbid stored release secrets");
  assert(combined.includes("noninteractive publish"), "Manual first release docs must reject noninteractive publish semantics");
  assert(readme.includes("npm pack --json --ignore-scripts --pack-destination \"$ARTIFACT_DIR\""), "README must retain an exact candidate tarball");
  assert(readme.includes('STATE_HOME="${XDG_STATE_HOME:-$HOME/.local/state}"') && readme.includes('mkdir -m 700 "$RELEASE_ROOT"'), "README must use an exclusively created private durable release root");
  assert(readme.includes('> "$RELEASE_ROOT/manifest.json"') && readme.includes('"$CANDIDATE_TGZ" "$RELEASE_ROOT/manifest.json"'), "README must persist and reverify release custody metadata");
  assert(readme.includes('import{createHash}from"node:crypto"') && readme.includes('JSON.parse(readFileSync(process.argv[2],"utf8")).sha512'), "README must use portable Node SHA-512 custody verification against the manifest");
  assert(!/sha1sum|sha512sum|stat -c/.test(combined), "Manual release docs must not require platform-specific checksum or stat commands");
  assert(readme.includes('createHash("sha1")') && readme.includes('JSON.parse(readFileSync(process.argv[2],"utf8")).dist.shasum'), "README must verify registry SHA-1 with portable Node crypto against npm dist.shasum");
  assert(readme.includes(`npm whoami --registry ${EXPECTED.registry}`), "README must pin npm identity checks to the canonical registry");
  assert(readme.includes(`npm publish "$CANDIDATE_TGZ" --access public --registry ${EXPECTED.registry}`), "README must publish the retained candidate tarball explicitly against the canonical registry");
  assert(readme.includes(`npm view "${EXPECTED.packageName}@$VERSION" version dist.integrity dist.shasum dist.tarball --json --registry ${EXPECTED.registry}`), "README must pin npm view checks to the canonical registry");
  assert(readme.includes("git rev-parse refs/remotes/origin/main"), "README must bind release commands to the current origin/main tip");
  assert(readme.includes("origin/main advanced before npm publish"), "README must revalidate origin/main immediately before npm publish");
  assert(readme.includes("origin/main advanced before tag push"), "README must revalidate origin/main immediately before tag push");
  assert(readme.includes("git show-ref --verify --quiet \"refs/tags/v$VERSION\""), "README must reject local release tag collisions before publish/tag");
  assert(readme.includes("git ls-remote --exit-code --tags origin \"refs/tags/v$VERSION\""), "README must reject remote release tag collisions before publish/tag");
  assert(readme.includes("cmp -s \"$CANDIDATE_TGZ\" \"$REGISTRY_TGZ\""), "README must compare registry tarball bytes against the candidate");
  assert(readme.includes("If npm publish times out or the response is lost"), "README must define ambiguous publish recovery");
  assert(readme.includes("never blindly republish"), "README must forbid blind publish retries");
  assert(!combined.includes("npm publish --provenance"), "Local manual first publish must not require impossible npm provenance");
  assert(readme.includes("signed annotated tag"), "README must create the tag only after registry artifact verification");
  assert(readme.includes("If signing is unavailable, stop the release"), "README must stop release when signed tag creation is unavailable");
  assert(readme.includes("git fetch origin \"refs/tags/v$VERSION:refs/tags/v$VERSION\""), "README must fetch a racing remote tag before recovery decisions");
  assert(readme.includes("git rev-parse \"refs/tags/v$VERSION^{}\""), "README must verify a racing remote tag target before accepting it");
  assert(readme.includes('git verify-tag "v$VERSION"') && readme.includes("unsigned or invalid tag fails recovery with no fallback"), "README must cryptographically reject unsigned or invalid racing tags");
  assert(readme.includes("git push --atomic --porcelain") && readme.includes("--force-with-lease=refs/heads/main:$SHA") && readme.includes("--force-with-lease=refs/tags/v$VERSION:"), "README must atomically bind main and tag publication with leases");
  assert(readme.includes("never overwrite or force-push a conflicting tag"), "README must forbid overwriting conflicting remote tags");
  assert(readme.includes("npm deprecate"), "README must document bad-version deprecation recovery");
  assert(!readme.includes("RELEASE_GUARD_CHECK_EVIDENCE"), "Manual release docs must not authorize caller-authored check evidence");
  assert(security.includes("Manual release only"), "Security policy must forbid automated publishing in the current scope");
  assert(security.includes("No GitHub NPM_TOKEN"), "Security policy must forbid GitHub npm tokens");
  assert(!/trusted publisher|trusted-publisher|OIDC|semantic-release/i.test(combined), "Current docs must not claim trusted publisher, OIDC, or Semantic Release automation");
}

function assertPackageMetadata(packageJson, packageOnly) {
  const publishConfig = objectField(packageJson, "publishConfig");
  const repository = objectField(packageJson, "repository");
  const bugs = objectField(packageJson, "bugs");
  const intendedVersion = packageOnly ? packageJson.version : stringField(process.env, "RELEASE_GUARD_INTENDED_VERSION");

  assert(packageJson.name === EXPECTED.packageName, "Package name must match the npm package identity");
  assert(packageJson.version === intendedVersion, "Reviewed package version must equal the intended manual release version");
  assert(packageJson.private === false, "Package must remain publishable from the manual release worktree");
  assertPublicExports(packageJson);
  assertPackageContents(packageJson);
  assert(repository.type === "git", "Repository type must be git");
  assert(repository.url === EXPECTED.repositoryUrl, "Repository URL must match release repository");
  assert(bugs.url === EXPECTED.issuesUrl, "Bug report URL must match release repository");
  assert(packageJson.homepage === EXPECTED.homepage, "Homepage must match release README");
  assert(publishConfig.access === "public", "npm access must be public");
  assert(publishConfig.provenance === undefined, "Local manual first release must not force npm provenance metadata");
}

function assertIntendedVersionDoesNotExist() {
  const intendedVersion = process.env.RELEASE_GUARD_INTENDED_VERSION;
  assert(SEMVER.test(intendedVersion), "Intended release version must be a valid semver version");
  if (process.env.RELEASE_GUARD_FIRST_RELEASE === "true") {
    assert(intendedVersion === EXPECTED.firstReleaseVersion, `First manual release version must be ${EXPECTED.firstReleaseVersion}`);
  }
  const tag = `v${intendedVersion}`;
  const tagRef = `refs/tags/${tag}`;
  assert(!gitSucceeds(["show-ref", "--verify", "--quiet", tagRef]), `Release tag ${tag} already exists locally`);
  assert(!gitSucceeds(["ls-remote", "--exit-code", "--tags", "origin", tagRef]), `Release tag ${tag} already exists on origin`);

  try {
    execFileSync("npm", ["view", `${EXPECTED.packageName}@${intendedVersion}`, "version", "--json", "--registry", EXPECTED.registry], { cwd: root, stdio: "pipe" });
  } catch (error) {
    const stderr = String(error?.stderr ?? "");
    const stdout = String(error?.stdout ?? "");
    if (/E404/.test(`${stderr}\n${stdout}`)) return;
    throw error;
  }

  throw new Error(`Release version ${EXPECTED.packageName}@${intendedVersion} already exists on npm`);
}

function parseCheckEvidence(evidence) {
  const checks = new Map();
  const ids = new Set();
  for (const line of evidence.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const fields = line.split("\t");
    assert(fields.length === 9, "Check evidence rows must include producer and workflow context");
    const [name, sha, status, conclusion, completedAt, id, appSlug, appId, detailsUrl] = fields;
    assert(name && /^[0-9a-f]{40}$/i.test(sha) && status && conclusion, "Check evidence rows must include name, current full SHA, status, and conclusion");
    assert(/^\d{4}-\d{2}-\d{2}T/.test(completedAt) && /^\d+$/.test(id), "Check evidence rows must include completed_at and numeric check-run id");
    assert(!ids.has(id), `Check evidence rows must use a unique check-run id: ${id}`);
    assert(appSlug === EXPECTED.checkAppSlug && appId === EXPECTED.checkAppId, `Check ${name} has unexpected producer ${appSlug}/${appId}`);
    const runMatch = detailsUrl.match(new RegExp(`^https://github\\.com/${EXPECTED.repository}/actions/runs/(\\d+)(?:/.*)?$`));
    assert(runMatch, `Check ${name} has missing or malformed canonical Actions details URL`);
    ids.add(id);
    const check = { sha, status, conclusion, completedAt, id, runId: runMatch[1] };
    const rows = checks.get(name) ?? [];
    rows.push(check);
    checks.set(name, rows);
  }
  return checks;
}

function latestRequiredCheck(checkName, rows) {
  assert(rows.length > 0, `Required check evidence missing for ${checkName}`);
  if (rows.length === 1) return rows[0];

  for (const row of rows) {
    assert(/^\d{4}-\d{2}-\d{2}T/.test(row.completedAt) && /^\d+$/.test(row.id), `ambiguous duplicate required check evidence for ${checkName}: reruns require completed_at and id`);
  }
  const keys = new Set();
  for (const row of rows) {
    const key = `${row.completedAt}\t${row.id}`;
    assert(!keys.has(key), `ambiguous duplicate required check evidence for ${checkName}: repeated completed_at/id`);
    keys.add(key);
  }
  return [...rows].sort((a, b) => a.completedAt.localeCompare(b.completedAt) || Number(a.id) - Number(b.id)).at(-1);
}

function assertReviewedReleaseInputs() {
  const reviewedSha = stringField(process.env, "RELEASE_GUARD_REVIEWED_SHA");
  assert(!process.env.RELEASE_GUARD_CHECK_EVIDENCE, "Release mode retrieves GitHub check runs via authenticated gh api; caller-authored check evidence is not accepted");

  assert(/^[0-9a-f]{40}$/i.test(reviewedSha), "Reviewed release SHA must be a full 40-character Git SHA");
  const head = gitOutput(["rev-parse", "HEAD"]).trim();
  assert(head === reviewedSha, `Reviewed release SHA ${reviewedSha} does not match HEAD ${head}`);
  assert(gitOutput(["status", "--porcelain=v1"]) === "", "Manual reviewed release tree must be clean");
  gitOutput(["fetch", "origin", "main"]);
  const originMain = gitOutput(["rev-parse", "refs/remotes/origin/main"]).trim();
  assert(originMain === reviewedSha, `Reviewed release SHA ${reviewedSha} does not match current origin/main ${originMain}`);

  const evidence = fetchCheckEvidence(reviewedSha);
  assert(evidence.trim().length > 0, "Manual release requires package/native check evidence for the reviewed SHA");
  const checks = parseCheckEvidence(evidence);
  for (const checkName of EXPECTED.requiredChecks) {
    const matchingRows = (checks.get(checkName) ?? []).filter((check) => check.sha === reviewedSha);
    const check = latestRequiredCheck(checkName, matchingRows);
    assert(check.status === "completed" && check.conclusion === "success", `latest completed required check ${checkName} was ${check.status}/${check.conclusion}`);
    const fields = fetchRunEvidence(check.runId).split("\t");
    assert(fields.length === 6, `Actions run ${check.runId} returned malformed evidence`);
    const [workflow, path, sha, repository, status, conclusion] = fields;
    assert(workflow === "CI" && path === ".github/workflows/ci.yml", `Actions run ${check.runId} has unexpected workflow ${workflow}/${path}`);
    assert(sha === reviewedSha, `Actions run ${check.runId} does not match reviewed SHA`);
    assert(repository === EXPECTED.repository, `Actions run ${check.runId} has unexpected repository ${repository}`);
    assert(status === "completed" && conclusion === "success", `Actions run ${check.runId} was ${status}/${conclusion}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  assert(args.length <= 1 && (args.length === 0 || args[0] === "--package-only"), "Usage: release-guard.mjs [--package-only]");
  const packageOnly = args[0] === "--package-only";
  const packageJson = await readJson("package.json");
  const ciWorkflow = await readText(".github/workflows/ci.yml");
  const readme = await readText("README.md");
  const security = await readText("SECURITY.md");

  assertPackageMetadata(packageJson, packageOnly);
  assertNoAutomatedReleaseScripts(packageJson);
  await assertNoAutomatedReleaseFiles();
  assertCiWorkflow(ciWorkflow);
  assertManualReleaseDocs(readme, security);
  assertPackedArchive();
  if (!packageOnly) {
    assertReviewedReleaseInputs();
    assertIntendedVersionDoesNotExist();
  }
}

const before = await mutationSnapshot();
await main();
await assertNoMutation(before);
console.log("Release guard passed");
