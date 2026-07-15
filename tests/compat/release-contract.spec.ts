import { execFile } from "node:child_process";
import { access, chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const EXPECTED_PACKAGE_FILES = [
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "dist/tui.d.ts",
  "dist/tui.js",
  "dist/tui.js.map",
  "package.json"
] as const;

const REQUIRED_CHECK_EVIDENCE = [
  "package",
  "native-pty (ubuntu-latest)",
  "native-pty (macos-latest)"
] as const;
const CANONICAL_REGISTRY = "https://registry.npmjs.org";

const FAKE_BIN_MODE = {
  ALLOW_E404: "allow-e404",
  PUBLISH_TRANSITION: "publish-transition",
  VERSION_EXISTS: "version-exists",
  EXTRA_FILE: "extra-file",
  BUNDLED_DEPENDENCY: "bundled-dependency"
} as const;

type FakeBinMode = (typeof FAKE_BIN_MODE)[keyof typeof FAKE_BIN_MODE];

interface FakeGitOptions {
  originMainSha?: string;
  localTagExists?: boolean;
  remoteTagExists?: boolean;
  logPath?: string;
  advanceBeforeTagPush?: boolean;
}

const projectRoot = new URL("../..", import.meta.url);

async function readJsonObject(path: string): Promise<Record<string, unknown>> {
  const parsed = JSON.parse(await readFile(new URL(path, projectRoot), "utf8")) as unknown;
  return expectRecord(parsed, path);
}

async function readText(path: string): Promise<string> {
  return readFile(new URL(path, projectRoot), "utf8");
}

async function expectMissing(path: string): Promise<void> {
  await expect(access(new URL(path, projectRoot))).rejects.toMatchObject({ code: "ENOENT" });
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  expect(value, label).toBeTypeOf("object");
  expect(value, label).not.toBeNull();
  return value as Record<string, unknown>;
}

function checkEvidence(sha: string, producer = "github-actions\t15368"): string {
  return REQUIRED_CHECK_EVIDENCE.map((name, index) => `${name}\t${sha}\tcompleted\tsuccess\t2026-07-13T00:0${index}:00Z\t${1000 + index}\t${producer}\thttps://github.com/ninjoan/opencode-usage-meter/actions/runs/${2000 + index}`).join("\n");
}

function staleSuccessAfterNewerFailureEvidence(sha: string): string {
  return checkEvidence(sha).replace(`package\t${sha}\tcompleted\tsuccess\t2026-07-13T00:00:00Z\t1000`, `package\t${sha}\tcompleted\tfailure\t2026-07-13T00:05:00Z\t2002`) + `\npackage\t${sha}\tcompleted\tsuccess\t2026-07-13T00:01:00Z\t2001\tgithub-actions\t15368\thttps://github.com/ninjoan/opencode-usage-meter/actions/runs/2001`;
}

function ambiguousDuplicateEvidence(sha: string): string {
  return checkEvidence(sha) + `\npackage\t${sha}\tcompleted\tsuccess\t2026-07-13T00:05:00Z\t1000\tgithub-actions\t15368\thttps://github.com/ninjoan/opencode-usage-meter/actions/runs/3001`;
}

async function commandPath(name: string): Promise<string> {
  const { stdout } = await execFileAsync("sh", ["-c", `command -v ${name}`]);
  return stdout.trim();
}

async function fakeCommand(directory: string, name: string, body: string): Promise<void> {
  const path = join(directory, name);
  await writeFile(path, `#!/bin/sh\n${body}`);
  await chmod(path, 0o755);
}

async function fakeNpm(mode: FakeBinMode, logPath = ""): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "release-npm-"));
  const packedFiles = EXPECTED_PACKAGE_FILES.map((path) => `{"path":"${path}"}`).join(",");
  await fakeCommand(directory, "npm", `log=${JSON.stringify(logPath)}
if [ -n "$log" ]; then printf 'npm' >> "$log"; for arg in "$@"; do printf '\t%s' "$arg" >> "$log"; done; printf '\n' >> "$log"; fi
if [ "$1" = view ]; then
  if [ "${mode}" = "${FAKE_BIN_MODE.VERSION_EXISTS}" ] || { [ "${mode}" = "${FAKE_BIN_MODE.PUBLISH_TRANSITION}" ] && [ -f "${directory}/published" ]; }; then
    echo '{"version":"0.1.0","dist":{"integrity":"sha512-test","shasum":"266ec841a313476ea6cf2d7e453e490ae0585e54","tarball":"https://registry.npmjs.org/opencode-cli-usage-meter/-/opencode-cli-usage-meter-0.1.0.tgz"}}'
    exit 0
  fi
  echo "npm ERR! code E404" >&2
  exit 1
fi
if [ "$1" = whoami ]; then echo maintainer; exit 0; fi
if [ "$1" = version ]; then echo "npm version is forbidden" >&2; exit 1; fi
if [ "$1" = publish ]; then [ "${mode}" = "${FAKE_BIN_MODE.PUBLISH_TRANSITION}" ] && : > "${directory}/published"; exit 0; fi
if [ "$1" = pack ]; then
  destination=; previous=; for arg in "$@"; do if [ "$previous" = "--pack-destination" ]; then destination="$arg"; fi; previous="$arg"; done
  if [ -n "$destination" ]; then mkdir -p "$destination" && printf candidate > "$destination/opencode-cli-usage-meter-0.1.0.tgz"; fi
  if [ "${mode}" = "${FAKE_BIN_MODE.EXTRA_FILE}" ]; then
    printf '%s\n' '[{"files":[{"path":"LICENSE"},{"path":"README.md"},{"path":"SECURITY.md"},{"path":"dist/tui.d.ts"},{"path":"dist/tui.js"},{"path":"dist/tui.js.map"},{"path":"package.json"},{"path":"src/tui.tsx"}],"bundled":[]}]'
    exit 0
  fi
  if [ "${mode}" = "${FAKE_BIN_MODE.BUNDLED_DEPENDENCY}" ]; then
    printf '%s\n' '[{"files":[{"path":"LICENSE"},{"path":"README.md"},{"path":"SECURITY.md"},{"path":"dist/tui.d.ts"},{"path":"dist/tui.js"},{"path":"dist/tui.js.map"},{"path":"package.json"}],"bundled":["left-pad"]}]'
    exit 0
  fi
  printf '%s\n' '[{"files":[${packedFiles}],"bundled":[]}]'
  exit 0
fi
exec "$ORIGINAL_NPM" "$@"
`);
  return directory;
}

async function fakeGit(status: string, sha: string, options: FakeGitOptions = {}): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "release-git-"));
  const originMainSha = options.originMainSha ?? sha;
  const advanceAt = options.advanceBeforeTagPush === true ? 5 : 999;
  await fakeCommand(directory, "git", `log=${JSON.stringify(options.logPath ?? "")}
if [ -n "$log" ]; then printf 'git' >> "$log"; for arg in "$@"; do printf '\t%s' "$arg" >> "$log"; done; printf '\n' >> "$log"; fi
if [ "$1" = fetch ] && [ "$2" = origin ] && [ "$3" = main ]; then exit 0; fi
if [ "$1" = rev-parse ] && [ "$2" = HEAD ]; then echo "${sha}"; exit 0; fi
if [ "$1" = rev-parse ] && [ "$2" = refs/remotes/origin/main ]; then count_file="${directory}/origin-count"; count=0; [ -f "$count_file" ] && count=$(cat "$count_file"); count=$((count+1)); printf '%s' "$count" > "$count_file"; if [ "$count" -ge "${advanceAt}" ]; then echo fedcba9876543210fedcba9876543210fedcba98; else echo "${originMainSha}"; fi; exit 0; fi
if [ "$1" = status ] && [ "$2" = --porcelain=v1 ]; then printf '%s' '${status}'; exit 0; fi
if [ "$1" = worktree ] && [ "$2" = add ] && [ "$3" = --detach ]; then mkdir -p "$4"; exit 0; fi
if [ "$1" = show-ref ] && [ "$2" = --verify ] && [ "$3" = --quiet ]; then if [ "${options.localTagExists === true ? "yes" : "no"}" = yes ]; then exit 0; fi; exit 1; fi
if [ "$1" = ls-remote ] && [ "$2" = --exit-code ] && [ "$3" = --tags ]; then if [ "${options.remoteTagExists === true ? "yes" : "no"}" = yes ]; then echo "${sha}\t$5"; exit 0; fi; exit 2; fi
if [ "$1" = tag ]; then exit 0; fi
if [ "$1" = push ]; then exit 0; fi
exec "$ORIGINAL_GIT" "$@"
`);
  return directory;
}

async function fakeGh(sha: string, rows = checkEvidence(sha), logPath = "", workflow = "CI"): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "release-gh-"));
  await fakeCommand(directory, "gh", `log=${JSON.stringify(logPath)}
if [ -n "$log" ]; then printf 'gh' >> "$log"; for arg in "$@"; do printf '\t%s' "$arg" >> "$log"; done; printf '\n' >> "$log"; fi
if [ "$1" = auth ] && [ "$2" = status ] && [ "$3" = --hostname ] && [ "$4" = github.com ]; then exit 0; fi
if [ "$1" = api ] && [ "$2" = "repos/ninjoan/opencode-usage-meter/commits/${sha}/check-runs" ]; then printf '%b\n' ${JSON.stringify(rows)}; exit 0; fi
case "$2" in repos/ninjoan/opencode-usage-meter/actions/runs/*) printf '%s\n' '${workflow}\t.github/workflows/ci.yml\t${sha}\tninjoan/opencode-usage-meter\tcompleted\tsuccess'; exit 0;; esac
echo "unexpected gh $*" >&2; exit 1
`);
  return directory;
}

async function fakeReleaseTools(directory: string, logPath: string): Promise<void> {
  await fakeCommand(directory, "pnpm", `{ printf 'pnpm'; for arg in "$@"; do printf '\t%s' "$arg"; done; printf '\n'; } >> ${JSON.stringify(logPath)}; if [ "$1" = release:verify ]; then exec "$ORIGINAL_NODE" "$RELEASE_GUARD_SCRIPT"; fi; exit 0`);
  await fakeCommand(directory, "jq", `if [ "$1" = -n ]; then while [ "$#" -gt 0 ]; do if [ "$1" = --arg ] && [ "$2" = hash ]; then hash="$3"; fi; shift; done; printf '{"sha512":"%s"}\n' "$hash"; exit 0; fi; query="$1"; [ "$1" = -r ] && query="$2"; case "$query" in '.[0].filename') echo opencode-cli-usage-meter-0.1.0.tgz;; .dist.tarball) echo https://registry.npmjs.org/opencode-cli-usage-meter/-/opencode-cli-usage-meter-0.1.0.tgz;; .dist.integrity) echo sha512-integrity;; .dist.shasum) echo shasum;; *) echo 0.1.0;; esac`);
  await fakeCommand(directory, "curl", `{ printf 'curl'; for arg in "$@"; do printf '\t%s' "$arg"; done; printf '\n'; } >> ${JSON.stringify(logPath)}; output=; previous=; for arg in "$@"; do if [ "$previous" = -o ]; then output="$arg"; fi; previous="$arg"; done; printf candidate > "$output"`);
  await fakeCommand(directory, "tar", `printf '%s\n' package/LICENSE package/README.md package/SECURITY.md package/dist/tui.d.ts package/dist/tui.js package/dist/tui.js.map package/package.json`);
  await fakeCommand(directory, "openssl", `if [ "$1" = base64 ]; then cat >/dev/null; printf integrity; else printf digest; fi`);
}

describe("manual release readiness contract", () => {
  it("removes automated Semantic Release/OIDC publishing from the current scope", async () => {
    const packageJson = await readJsonObject("package.json");
    const scripts = expectRecord(packageJson.scripts, "scripts");
    const ciWorkflow = await readText(".github/workflows/ci.yml");
    const readme = await readText("README.md");
    const security = await readText("SECURITY.md");

    await expectMissing(".github/workflows/release.yml");
    await expectMissing(".releaserc.json");
    expect(scripts).not.toHaveProperty("release");
    expect(scripts).not.toHaveProperty("release:dry-run");
    expect(JSON.stringify(packageJson)).not.toMatch(/semantic-release|pnpm dlx/);

    expect(ciWorkflow).toContain("permissions:\n  contents: read");
    expect(ciWorkflow).toContain("pnpm typecheck && pnpm build && pnpm test");
    expect(ciWorkflow).toContain("pnpm smoke:consumer");
    expect(ciWorkflow).toContain("pnpm smoke:pty-native");
    expect(ciWorkflow).toContain("pnpm release:guard");
    expect(ciWorkflow).not.toMatch(/id-token:\s*write|contents:\s*write|npm\s+publish|NPM_TOKEN|NODE_AUTH_TOKEN/);

    for (const content of [readme, security]) {
      expect(content).toContain("Manual release only");
      expect(content).toContain("first manual npm release has no provenance");
      expect(content).toContain("npm publish \"$CANDIDATE_TGZ\" --access public");
      expect(content).not.toContain("npm publish --provenance");
      expect(content).not.toMatch(/trusted publisher|trusted-publisher|OIDC|semantic-release/i);
    }

    const publishConfig = expectRecord(packageJson.publishConfig, "publishConfig");
    expect(publishConfig).toEqual({ access: "public" });
    expect(readme).toContain("npm pack --json --ignore-scripts --pack-destination \"$ARTIFACT_DIR\"");
    expect(readme).toContain("cmp -s \"$CANDIDATE_TGZ\" \"$REGISTRY_TGZ\"");
    expect(readme).toContain("If npm publish times out or the response is lost");
    expect(readme).toContain("never blindly republish");
    expect(readme).toContain("git fetch origin \"refs/tags/v$VERSION:refs/tags/v$VERSION\"");
    expect(readme).toContain("git rev-parse \"refs/tags/v$VERSION^{}\"");
    expect(readme).toContain("never overwrite or force-push a conflicting tag");
  });

  it("requires release identity for package guard execution", async () => {
    const beforeStatus = await execFileAsync("git", ["status", "--porcelain=v1"], { cwd: projectRoot });
    const beforeManifest = await readText("package.json");
    await expect(execFileAsync(process.execPath, ["scripts/release-guard.mjs"], { cwd: projectRoot })).rejects.toMatchObject({ stderr: expect.stringContaining("RELEASE_GUARD_INTENDED_VERSION") });
    expect(await readText("package.json")).toBe(beforeManifest);
    expect((await execFileAsync("git", ["status", "--porcelain=v1"], { cwd: projectRoot })).stdout).toBe(beforeStatus.stdout);
  });

  it("allows pre-first-publish npm E404 but rejects an existing version collision", async () => {
    const originalGit = await commandPath("git");
    const originalNpm = await commandPath("npm");
    const reviewedSha = "0123456789abcdef0123456789abcdef01234567";
    const gitBin = await fakeGit("", reviewedSha);
    const ghBin = await fakeGh(reviewedSha);

    for (const [mode, succeeds] of [
      [FAKE_BIN_MODE.ALLOW_E404, true],
      [FAKE_BIN_MODE.VERSION_EXISTS, false]
    ] as const) {
      const directory = await fakeNpm(mode);
      try {
        const execution = execFileAsync(process.execPath, ["scripts/release-guard.mjs"], {
          cwd: projectRoot,
          env: {
            ...process.env,
            ORIGINAL_GIT: originalGit,
            ORIGINAL_NPM: originalNpm,
            PATH: `${gitBin}:${directory}:${ghBin}:${process.env.PATH}`,
            RELEASE_GUARD_REVIEWED_SHA: reviewedSha,
            RELEASE_GUARD_INTENDED_VERSION: "0.1.0"
          }
        });
        if (succeeds) expect((await execution).stdout).toContain("Release guard passed");
        else await expect(execution).rejects.toMatchObject({ stderr: expect.stringContaining("already exists on npm") });
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }
    await rm(gitBin, { recursive: true, force: true });
    await rm(ghBin, { recursive: true, force: true });
  });

  it("pins reviewed release guard checks to current origin/main, canonical npm registry, and tag preflight", async () => {
    const originalGit = await commandPath("git");
    const originalNpm = await commandPath("npm");
    const reviewedSha = "0123456789abcdef0123456789abcdef01234567";
    const commandLogDirectory = await mkdtemp(join(tmpdir(), "release-log-"));
    const logPath = join(commandLogDirectory, "commands.log");
    const cleanGit = await fakeGit("", reviewedSha, { logPath });
    const advancedGit = await fakeGit("", reviewedSha, { originMainSha: "fedcba9876543210fedcba9876543210fedcba98" });
    const localTagGit = await fakeGit("", reviewedSha, { localTagExists: true });
    const remoteTagGit = await fakeGit("", reviewedSha, { remoteTagExists: true });
    const npmBin = await fakeNpm(FAKE_BIN_MODE.ALLOW_E404, logPath);
    const ghBin = await fakeGh(reviewedSha, checkEvidence(reviewedSha), logPath);
    const baseEnv = {
      ...process.env,
      ORIGINAL_GIT: originalGit,
      ORIGINAL_NPM: originalNpm,
      RELEASE_GUARD_REVIEWED_SHA: reviewedSha,
      RELEASE_GUARD_INTENDED_VERSION: "0.1.0",
      RELEASE_GUARD_FIRST_RELEASE: "true"
    };

    try {
      expect(
        (
          await execFileAsync(process.execPath, ["scripts/release-guard.mjs"], {
            cwd: projectRoot,
            env: { ...baseEnv, PATH: `${cleanGit}:${npmBin}:${ghBin}:${process.env.PATH}` }
          })
        ).stdout
      ).toContain("Release guard passed");
      const log = await readFile(logPath, "utf8");
      expect(log).toContain("gh\tauth\tstatus\t--hostname\tgithub.com");
      expect(log).toContain(`gh\tapi\trepos/ninjoan/opencode-usage-meter/commits/${reviewedSha}/check-runs\t--paginate\t--jq`);
      expect(log).toContain(`npm\tview\topencode-cli-usage-meter@0.1.0\tversion\t--json\t--registry\t${CANONICAL_REGISTRY}`);
      expect(log).toContain("git\tfetch\torigin\tmain");
      expect(log).toContain(`git\trev-parse\trefs/remotes/origin/main`);
      expect(log).toContain("git\tshow-ref\t--verify\t--quiet\trefs/tags/v0.1.0");
      expect(log).toContain("git\tls-remote\t--exit-code\t--tags\torigin\trefs/tags/v0.1.0");

      await expect(execFileAsync(process.execPath, ["scripts/release-guard.mjs"], { cwd: projectRoot, env: { ...baseEnv, PATH: `${advancedGit}:${npmBin}:${ghBin}:${process.env.PATH}` } })).rejects.toMatchObject({ stderr: expect.stringContaining("current origin/main") });
      await expect(execFileAsync(process.execPath, ["scripts/release-guard.mjs"], { cwd: projectRoot, env: { ...baseEnv, PATH: `${localTagGit}:${npmBin}:${ghBin}:${process.env.PATH}` } })).rejects.toMatchObject({ stderr: expect.stringContaining("tag v0.1.0 already exists locally") });
      await expect(execFileAsync(process.execPath, ["scripts/release-guard.mjs"], { cwd: projectRoot, env: { ...baseEnv, PATH: `${remoteTagGit}:${npmBin}:${ghBin}:${process.env.PATH}` } })).rejects.toMatchObject({ stderr: expect.stringContaining("tag v0.1.0 already exists on origin") });
    } finally {
      for (const path of [commandLogDirectory, cleanGit, advancedGit, localTagGit, remoteTagGit, npmBin, ghBin]) await rm(path, { recursive: true, force: true });
    }
  });

  it("executes the actual README release sequence with guard calls, SHA-512 custody, and atomic tag push", async () => {
    const readme = await readText("README.md");
    const reviewedSha = "0123456789abcdef0123456789abcdef01234567";
    const directory = await mkdtemp(join(tmpdir(), "release-docs-"));
    const logPath = join(directory, "commands.log");
    const npmBin = await fakeNpm(FAKE_BIN_MODE.PUBLISH_TRANSITION, logPath);
    const raceNpmBin = await fakeNpm(FAKE_BIN_MODE.PUBLISH_TRANSITION, logPath);
    const ghBin = await fakeGh(reviewedSha, checkEvidence(reviewedSha), logPath);
    const gitBin = await fakeGit("", reviewedSha, { logPath });
    const raceGitBin = await fakeGit("", reviewedSha, { logPath, advanceBeforeTagPush: true });
    await fakeReleaseTools(directory, logPath);

    try {
      const section = readme.slice(readme.indexOf("### Manual first release"), readme.indexOf("### Future manual releases"));
      const commands = [...section.matchAll(/```bash\n([\s\S]*?)```/g)].map((match) => match[1] ?? "").join("\n");
      await execFileAsync("sh", ["-eu", "-c", commands], {
        cwd: projectRoot,
         env: { ...process.env, ORIGINAL_NODE: process.execPath, RELEASE_GUARD_SCRIPT: new URL("scripts/release-guard.mjs", projectRoot).pathname, ORIGINAL_GIT: await commandPath("git"), ORIGINAL_NPM: await commandPath("npm"), PATH: `${directory}:${gitBin}:${npmBin}:${ghBin}:${process.env.PATH}`, SHA: reviewedSha, VERSION: "0.1.0", XDG_STATE_HOME: directory }
      });
      const log = await readFile(logPath, "utf8");
      expect(commands).toContain('import{createHash}from"node:crypto"');
      expect(commands).toContain('JSON.parse(readFileSync(process.argv[2],"utf8")).sha512');
      expect(commands).toContain('createHash("sha1")');
      expect(commands).toContain('JSON.parse(readFileSync(process.argv[2],"utf8")).dist.shasum');
      expect(commands).not.toMatch(/sha1sum|sha512sum|stat -c/);
      const logLines = log.trim().split(/\r?\n/);
      const packLine = logLines.find((line) => line.startsWith("npm\tpack\t--json\t--ignore-scripts\t--pack-destination\t"));
      expect(packLine).toBeDefined();
      const artifacts = (packLine as string).split("\t").at(-1) as string;
       expect(log).toContain("pnpm\trelease:verify");
      expect(log).not.toContain("npm\tversion");
      expect(log).toContain(`npm\twhoami\t--registry\t${CANONICAL_REGISTRY}`);
      expect(log).toContain(`npm\tpublish\t${artifacts}/opencode-cli-usage-meter-0.1.0.tgz\t--access\tpublic\t--registry\t${CANONICAL_REGISTRY}`);
    expect(log).toContain(`npm\tview\topencode-cli-usage-meter@0.1.0\tversion\tdist.integrity\tdist.shasum\tdist.tarball\t--json\t--registry\t${CANONICAL_REGISTRY}`);
      expect(log).toContain("curl\t-fL\thttps://registry.npmjs.org/opencode-cli-usage-meter/-/opencode-cli-usage-meter-0.1.0.tgz");
      expect(log).toContain("git\ttag\t-s\t-a\tv0.1.0\t0123456789abcdef0123456789abcdef01234567\t-m\tRelease v0.1.0");
      expect(log).toContain(`git\tpush\t--atomic\t--porcelain\t--force-with-lease=refs/heads/main:${reviewedSha}\t--force-with-lease=refs/tags/v0.1.0:\torigin\t${reviewedSha}:refs/heads/main\trefs/tags/v0.1.0:refs/tags/v0.1.0`);
      const publishIndex = logLines.findIndex((line) => line.startsWith("npm\tpublish\t"));
      const viewIndex = logLines.findIndex((line, index) => index > publishIndex && line.startsWith("npm\tview\t"));
      const tagIndex = logLines.findIndex((line) => line.startsWith("git\ttag\t"));
      const pushIndex = logLines.findIndex((line) => line.startsWith("git\tpush\t"));
      expect(publishIndex).toBeGreaterThanOrEqual(0);
      expect(viewIndex).toBeGreaterThan(publishIndex);
      expect(tagIndex).toBeGreaterThan(viewIndex);
      expect(pushIndex).toBeGreaterThan(tagIndex);
        await expect(execFileAsync("sh", ["-eu", "-c", commands], { cwd: projectRoot, env: { ...process.env, ORIGINAL_NODE: process.execPath, RELEASE_GUARD_SCRIPT: new URL("scripts/release-guard.mjs", projectRoot).pathname, ORIGINAL_GIT: await commandPath("git"), ORIGINAL_NPM: await commandPath("npm"), PATH: `${directory}:${raceGitBin}:${raceNpmBin}:${ghBin}:${process.env.PATH}`, SHA: reviewedSha, VERSION: "0.1.0", XDG_STATE_HOME: join(directory, "race") } })).rejects.toMatchObject({ stdout: expect.stringContaining("origin/main advanced before tag") });
    } finally {
      for (const path of [directory, gitBin, raceGitBin, npmBin, raceNpmBin, ghBin]) await rm(path, { recursive: true, force: true });
    }
  });

  it("requires cryptographic verification before accepting a racing remote tag", async () => {
    const readme = await readText("README.md");
    const recovery = readme.slice(readme.indexOf("If publication succeeds but tag creation"), readme.indexOf("If a bad version is published"));
    expect(recovery).toContain('git verify-tag "v$VERSION"');
    expect(recovery.indexOf('git verify-tag "v$VERSION"')).toBeLessThan(recovery.indexOf("recorded as successful recovery"));
    expect(recovery).toContain("unsigned or invalid");
  });

  it("requires authenticated gh release evidence and rejects caller-authored check rows", async () => {
    const reviewedSha = "0123456789abcdef0123456789abcdef01234567";
    const cleanGit = await fakeGit("", reviewedSha);
    const npmBin = await fakeNpm(FAKE_BIN_MODE.ALLOW_E404);

    try {
      await expect(execFileAsync(process.execPath, ["scripts/release-guard.mjs"], { cwd: projectRoot, env: { ...process.env, PATH: `${cleanGit}:${npmBin}:${process.env.PATH}`, RELEASE_GUARD_INTENDED_VERSION: "0.1.0" } })).rejects.toMatchObject({ stderr: expect.stringContaining("RELEASE_GUARD_REVIEWED_SHA") });
      await expect(execFileAsync(process.execPath, ["scripts/release-guard.mjs"], { cwd: projectRoot, env: { ...process.env, ORIGINAL_GIT: await commandPath("git"), ORIGINAL_NPM: await commandPath("npm"), PATH: `${cleanGit}:${npmBin}:${process.env.PATH}`, RELEASE_GUARD_REVIEWED_SHA: reviewedSha, RELEASE_GUARD_CHECK_EVIDENCE: checkEvidence(reviewedSha), RELEASE_GUARD_INTENDED_VERSION: "0.1.0" } })).rejects.toMatchObject({ stderr: expect.stringContaining("caller-authored check evidence is not accepted") });
    } finally {
      await rm(cleanGit, { recursive: true, force: true });
      await rm(npmBin, { recursive: true, force: true });
    }
  });

  it("rejects actual pack lists with extra files or bundled dependencies", async () => {
    const originalNpm = await commandPath("npm");

    for (const [mode, message] of [
      [FAKE_BIN_MODE.EXTRA_FILE, "exactly the seven allowlisted files"],
      [FAKE_BIN_MODE.BUNDLED_DEPENDENCY, "must not contain bundled dependencies"]
    ] as const) {
      const directory = await fakeNpm(mode);
      try {
        await expect(
          execFileAsync(process.execPath, ["scripts/release-guard.mjs"], {
            cwd: projectRoot,
            env: {
              ...process.env,
              ORIGINAL_NPM: originalNpm,
              RELEASE_GUARD_INTENDED_VERSION: "0.1.0",
              PATH: `${directory}:${process.env.PATH}`
            }
          })
        ).rejects.toMatchObject({ stderr: expect.stringContaining(message) });
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }
  });

  it("requires clean exact-SHA and successful package/native check evidence for manual release", async () => {
    const originalGit = await commandPath("git");
    const originalNpm = await commandPath("npm");
    const reviewedSha = "0123456789abcdef0123456789abcdef01234567";

    const cleanGit = await fakeGit("", reviewedSha);
    const dirtyGit = await fakeGit(" M package.json\n", reviewedSha);
    const wrongShaGit = await fakeGit("", "fedcba9876543210fedcba9876543210fedcba98");
    const npmBin = await fakeNpm(FAKE_BIN_MODE.ALLOW_E404);
    const successGh = await fakeGh(reviewedSha);
    const wrongCheckGh = await fakeGh(
      reviewedSha,
      checkEvidence(reviewedSha).replace(`native-pty (macos-latest)\t${reviewedSha}\t`, "native-pty (macos-latest)\tfedcba9876543210fedcba9876543210fedcba98\t")
    );
    const wrongProducerGh = await fakeGh(reviewedSha, checkEvidence(reviewedSha, "untrusted-app\t999"));
    const wrongWorkflowGh = await fakeGh(reviewedSha, checkEvidence(reviewedSha), "", "Release");

    try {
      const baseEnv = {
        ...process.env,
        ORIGINAL_GIT: originalGit,
        ORIGINAL_NPM: originalNpm,
        RELEASE_GUARD_INTENDED_VERSION: "0.1.0",
        RELEASE_GUARD_REVIEWED_SHA: reviewedSha
      };

      await expect(
        execFileAsync(process.execPath, ["scripts/release-guard.mjs"], {
          cwd: projectRoot,
          env: { ...baseEnv, PATH: `${dirtyGit}:${npmBin}:${successGh}:${process.env.PATH}` }
        })
      ).rejects.toMatchObject({ stderr: expect.stringContaining("reviewed release tree must be clean") });

      await expect(
        execFileAsync(process.execPath, ["scripts/release-guard.mjs"], {
          cwd: projectRoot,
          env: { ...baseEnv, PATH: `${wrongShaGit}:${npmBin}:${successGh}:${process.env.PATH}` }
        })
      ).rejects.toMatchObject({ stderr: expect.stringContaining("does not match HEAD") });

      await expect(
        execFileAsync(process.execPath, ["scripts/release-guard.mjs"], {
          cwd: projectRoot,
          env: {
            ...baseEnv,
            PATH: `${cleanGit}:${npmBin}:${wrongCheckGh}:${process.env.PATH}`
          }
        })
      ).rejects.toMatchObject({ stderr: expect.stringContaining("native-pty (macos-latest)") });

      await expect(execFileAsync(process.execPath, ["scripts/release-guard.mjs"], { cwd: projectRoot, env: { ...baseEnv, PATH: `${cleanGit}:${npmBin}:${wrongProducerGh}:${process.env.PATH}` } })).rejects.toMatchObject({ stderr: expect.stringContaining("unexpected producer") });
      await expect(execFileAsync(process.execPath, ["scripts/release-guard.mjs"], { cwd: projectRoot, env: { ...baseEnv, PATH: `${cleanGit}:${npmBin}:${wrongWorkflowGh}:${process.env.PATH}` } })).rejects.toMatchObject({ stderr: expect.stringContaining("unexpected workflow") });

      expect(
        (
          await execFileAsync(process.execPath, ["scripts/release-guard.mjs"], {
            cwd: projectRoot,
            env: { ...baseEnv, PATH: `${cleanGit}:${npmBin}:${successGh}:${process.env.PATH}` }
          })
        ).stdout
      ).toContain("Release guard passed");
    } finally {
      await rm(cleanGit, { recursive: true, force: true });
      await rm(dirtyGit, { recursive: true, force: true });
      await rm(wrongShaGit, { recursive: true, force: true });
      await rm(npmBin, { recursive: true, force: true });
      await rm(successGh, { recursive: true, force: true });
      await rm(wrongCheckGh, { recursive: true, force: true });
      await rm(wrongProducerGh, { recursive: true, force: true });
      await rm(wrongWorkflowGh, { recursive: true, force: true });
    }
  });

  it("rejects duplicate required-check reruns instead of accepting stale success", async () => {
    const originalGit = await commandPath("git");
    const originalNpm = await commandPath("npm");
    const reviewedSha = "0123456789abcdef0123456789abcdef01234567";
    const cleanGit = await fakeGit("", reviewedSha);
    const npmBin = await fakeNpm(FAKE_BIN_MODE.ALLOW_E404);
    const staleGh = await fakeGh(reviewedSha, staleSuccessAfterNewerFailureEvidence(reviewedSha));
    const duplicateGh = await fakeGh(reviewedSha, ambiguousDuplicateEvidence(reviewedSha));
    const baseEnv = { ...process.env, ORIGINAL_GIT: originalGit, ORIGINAL_NPM: originalNpm, RELEASE_GUARD_INTENDED_VERSION: "0.1.0", RELEASE_GUARD_REVIEWED_SHA: reviewedSha };

    try {
      await expect(
        execFileAsync(process.execPath, ["scripts/release-guard.mjs"], {
          cwd: projectRoot,
          env: { ...baseEnv, PATH: `${cleanGit}:${npmBin}:${staleGh}:${process.env.PATH}` }
        })
      ).rejects.toMatchObject({ stderr: expect.stringContaining("latest completed required check package") });

      await expect(
        execFileAsync(process.execPath, ["scripts/release-guard.mjs"], {
          cwd: projectRoot,
          env: { ...baseEnv, PATH: `${cleanGit}:${npmBin}:${duplicateGh}:${process.env.PATH}` }
        })
      ).rejects.toMatchObject({ stderr: expect.stringContaining("unique check-run id") });
    } finally {
      await rm(cleanGit, { recursive: true, force: true });
      await rm(npmBin, { recursive: true, force: true });
      await rm(staleGh, { recursive: true, force: true });
      await rm(duplicateGh, { recursive: true, force: true });
    }
  });
});
