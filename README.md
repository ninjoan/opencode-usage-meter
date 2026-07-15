# OpenCode CLI Usage Meter

Standalone OpenCode TUI plugin package for showing CLI usage in the sidebar.

The plugin registers one public `sidebar_content` block. It probes only `codex /status` and `claude /usage`, safely normalizes exposed quota windows, and fails closed as `Data unavailable`. Public prompt, status, and idle events adapt refresh cadence from 2 to 5, 15, and 30 minutes; resource pressure is an explicitly injectable host boundary because the public OpenCode API does not expose it.

## Checks

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm pack:dry-run
pnpm smoke:consumer
pnpm smoke:pty-native
```

## Behavior harness and package smoke

Phase 3 behavior is covered by a deterministic in-process plugin behavior harness that imports `src/tui.js` and injects fake Codex/Claude transport responses. It covers registration, refresh, toggle, partial failure, and disposal without real credentials, network, cookies, Keychain, provider APIs, packed-package execution, or fake executables.

Claude remains pipe-first, with an optional PTY fallback on Linux and macOS. The fallback dynamically loads exactly `node-pty@1.2.0-beta.12`; if the optional native module is missing or cannot load, Claude usage degrades safely to `Data unavailable`. Version 1.1.0 was rejected because its published macOS arm64 `spawn-helper` lacked executable mode. The exact beta tarball ships executable arm64 and x64 helpers, avoiding a CI-only `chmod` workaround, but prerelease dependency stability remains a supply-chain risk. Installing the fallback permits lifecycle scripts only for `node-pty` (alongside the existing `esbuild` and `msgpackr-extract` allowances). Linux cold install/import/spawn/terminate is locally proven; macOS remains pending CI runtime proof and is not claimed as successful.

`pnpm smoke:consumer` remains a separate `--ignore-scripts` package export-shape/import boundary: it packs the package into a temporary consumer and imports the package root plus `/tui`. It does not exercise plugin behavior or require the optional native fallback.

Fixtures must never contain real credentials, tokens, cookies, Keychain data, or provider auth files.

## Release guard

Manual release only. The current scope intentionally has no release workflow, no dynamic release downloader, no GitHub npm token, and no direct publish step in CI. `pnpm release:guard` is the package-only CI guard; `pnpm release:verify` is the strict manual guard for reviewed SHA evidence and collision checks.

The reviewed source `package.json` version is `0.1.0`. The first manual npm release has no provenance because local interactive npm publish cannot produce npm provenance; this is an explicit bootstrap limitation accepted only for the first package publication. `npm whoami` confirms identity only; it does not prove 2FA. Before the bootstrap, a maintainer must attest that npm account settings enforce write-required 2FA; the first publish must use the registry-controlled OTP challenge, not automation tokens, bypass tokens, stored `NODE_AUTH_TOKEN`/`NPM_TOKEN`, or any noninteractive publish. No secrets are stored. Every future version bump must be merged as a reviewed PR before publish; release-time version mutation is forbidden. Future automation is deferred until after the package exists and a separate reviewed change defines the exact mechanism.

### Manual first release

Run this only from the exact merged `main` SHA after GitHub shows the `package`, `native-pty (ubuntu-latest)`, and `native-pty (macos-latest)` checks as successful for that SHA:

```bash
: "${SHA:?set the reviewed exact 40-character main SHA}"
VERSION="${VERSION:-0.1.0}"
umask 077
STATE_HOME="${XDG_STATE_HOME:-$HOME/.local/state}"
mkdir -p -m 700 "$STATE_HOME/opencode-usage-meter/releases"
RELEASE_ROOT="$STATE_HOME/opencode-usage-meter/releases/$VERSION-$SHA"
mkdir -m 700 "$RELEASE_ROOT"
WORKTREE="$RELEASE_ROOT/worktree"
ARTIFACT_DIR="$RELEASE_ROOT/artifacts"

git fetch origin main
test "$(git rev-parse refs/remotes/origin/main)" = "$SHA" || { echo "STOP: reviewed SHA is not current origin/main"; exit 1; }
git worktree add --detach "$WORKTREE" "$SHA"
cd "$WORKTREE"
test "$(git rev-parse HEAD)" = "$SHA" || { echo "STOP: wrong SHA"; exit 1; }
test -z "$(git status --porcelain=v1)" || { echo "STOP: dirty tree"; exit 1; }
mkdir -m 700 "$ARTIFACT_DIR"

pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm test
pnpm smoke:consumer
pnpm smoke:pty-native
pnpm pack:dry-run
pnpm audit:prod
RELEASE_GUARD_REVIEWED_SHA="$SHA" RELEASE_GUARD_INTENDED_VERSION="$VERSION" RELEASE_GUARD_FIRST_RELEASE=true pnpm release:verify
test -z "$(git status --porcelain=v1)" || { echo "STOP: dirty tree after release guard"; exit 1; }
git fetch origin main
test "$(git rev-parse refs/remotes/origin/main)" = "$SHA" || { echo "STOP: origin/main advanced before candidate preparation"; exit 1; }
if git show-ref --verify --quiet "refs/tags/v$VERSION"; then echo "STOP: local tag v$VERSION already exists"; exit 1; fi
if git ls-remote --exit-code --tags origin "refs/tags/v$VERSION" >/dev/null; then echo "STOP: remote tag v$VERSION already exists"; exit 1; fi
PACK_JSON=$(npm pack --json --ignore-scripts --pack-destination "$ARTIFACT_DIR")
CANDIDATE_TGZ="$ARTIFACT_DIR/$(printf '%s' "$PACK_JSON" | jq -r '.[0].filename')"
test -f "$CANDIDATE_TGZ" || { echo "STOP: candidate tarball missing"; exit 1; }
tar -tzf "$CANDIDATE_TGZ" | sort > "$ARTIFACT_DIR/candidate.files"
CANDIDATE_SHA512=$(node --input-type=module -e 'import{createHash}from"node:crypto";import{readFileSync}from"node:fs";process.stdout.write(createHash("sha512").update(readFileSync(process.argv[1])).digest("hex"))' "$CANDIDATE_TGZ")
jq -n --arg sha "$SHA" --arg version "$VERSION" --arg candidate "$CANDIDATE_TGZ" --arg hash "$CANDIDATE_SHA512" --arg integrity "sha512-$(openssl dgst -sha512 -binary "$CANDIDATE_TGZ" | openssl base64 -A)" '{sha:$sha,version:$version,candidate:$candidate,sha512:$hash,integrity:$integrity}' > "$RELEASE_ROOT/manifest.json"
chmod 600 "$RELEASE_ROOT/manifest.json"
node --input-type=module -e 'import{createHash}from"node:crypto";import{readFileSync}from"node:fs";const actual=createHash("sha512").update(readFileSync(process.argv[1])).digest("hex");const expected=JSON.parse(readFileSync(process.argv[2],"utf8")).sha512;if(actual!==expected)process.exit(1)' "$CANDIDATE_TGZ" "$RELEASE_ROOT/manifest.json"
test -z "$(git status --porcelain=v1)" || { echo "STOP: dirty tree after candidate preparation"; exit 1; }
npm whoami --registry https://registry.npmjs.org
git fetch origin main # revalidate before npm publish
test "$(git rev-parse refs/remotes/origin/main)" = "$SHA" || { echo "STOP: origin/main advanced before npm publish"; exit 1; }
node --input-type=module -e 'import{createHash}from"node:crypto";import{readFileSync}from"node:fs";const actual=createHash("sha512").update(readFileSync(process.argv[1])).digest("hex");const expected=JSON.parse(readFileSync(process.argv[2],"utf8")).sha512;if(actual!==expected)process.exit(1)' "$CANDIDATE_TGZ" "$RELEASE_ROOT/manifest.json"
test -z "$(git status --porcelain=v1)" || { echo "STOP: dirty tree before npm publish"; exit 1; }
npm publish "$CANDIDATE_TGZ" --access public --registry https://registry.npmjs.org
```

After npm publish succeeds, verify the registry artifact against the retained candidate before tagging:

```bash
npm view "opencode-cli-usage-meter@$VERSION" version dist.integrity dist.shasum dist.tarball --json --registry https://registry.npmjs.org > "$ARTIFACT_DIR/published.json"
test "$(jq -r .version "$ARTIFACT_DIR/published.json")" = "$VERSION" || exit 1
REGISTRY_TGZ="$ARTIFACT_DIR/registry-$VERSION.tgz"
case "$(jq -r .dist.tarball "$ARTIFACT_DIR/published.json")" in https://registry.npmjs.org/*) ;; *) echo "STOP: non-canonical registry tarball URL"; exit 1;; esac
curl -fL "$(jq -r .dist.tarball "$ARTIFACT_DIR/published.json")" -o "$REGISTRY_TGZ"
node --input-type=module -e 'import{createHash}from"node:crypto";import{readFileSync}from"node:fs";const actual=createHash("sha1").update(readFileSync(process.argv[1])).digest("hex");const expected=JSON.parse(readFileSync(process.argv[2],"utf8")).dist.shasum;if(actual!==expected)process.exit(1)' "$REGISTRY_TGZ" "$ARTIFACT_DIR/published.json"
INTEGRITY=$(jq -r .dist.integrity "$ARTIFACT_DIR/published.json")
test "sha512-$(openssl dgst -sha512 -binary "$REGISTRY_TGZ" | openssl base64 -A)" = "$INTEGRITY" || exit 1
cmp -s "$CANDIDATE_TGZ" "$REGISTRY_TGZ" || { echo "STOP: registry tarball differs from retained candidate"; exit 1; }
tar -tzf "$REGISTRY_TGZ" | sort > "$ARTIFACT_DIR/registry.files"
diff -u "$ARTIFACT_DIR/candidate.files" "$ARTIFACT_DIR/registry.files"
node --input-type=module -e 'import{createHash}from"node:crypto";import{readFileSync}from"node:fs";const actual=createHash("sha512").update(readFileSync(process.argv[1])).digest("hex");const expected=JSON.parse(readFileSync(process.argv[2],"utf8")).sha512;if(actual!==expected)process.exit(1)' "$CANDIDATE_TGZ" "$RELEASE_ROOT/manifest.json"
test -z "$(git status --porcelain=v1)" || { echo "STOP: dirty tree before tag"; exit 1; }
git fetch origin main
test "$(git rev-parse refs/remotes/origin/main)" = "$SHA" || { echo "STOP: origin/main advanced before tag"; exit 1; }
if git show-ref --verify --quiet "refs/tags/v$VERSION"; then echo "STOP: local tag v$VERSION already exists"; exit 1; fi
if git ls-remote --exit-code --tags origin "refs/tags/v$VERSION" >/dev/null; then echo "STOP: remote tag v$VERSION already exists"; exit 1; fi
git tag -s -a "v$VERSION" "$SHA" -m "Release v$VERSION"
git fetch origin main # revalidate before tag push
test "$(git rev-parse refs/remotes/origin/main)" = "$SHA" || { echo "STOP: origin/main advanced before tag push"; exit 1; }
git push --atomic --porcelain \
  --force-with-lease=refs/heads/main:$SHA \
  --force-with-lease=refs/tags/v$VERSION: \
  origin "$SHA:refs/heads/main" "refs/tags/v$VERSION:refs/tags/v$VERSION"
```

The release requires a signed annotated tag. If signing is unavailable, stop the release. Do not create or push any tag before the registry artifact matches the local packed artifact and npm metadata.

### Future manual releases

For later versions, first merge a reviewed PR that updates `package.json` to the maintainer-selected semver version, then repeat the same exact-SHA/check/clean-worktree process. `RELEASE_GUARD_REVIEWED_SHA=<sha> RELEASE_GUARD_INTENDED_VERSION=<version> pnpm release:verify` requires reviewed source to equal that version and rejects a version or `v$VERSION` tag that already exists on npm/origin while allowing the expected pre-publication `E404` response.

### Recovery runbook

After terminal loss, set `SHA` and `VERSION`, then reload custody before any compare, tag, or deprecate action:

```bash
STATE_HOME="${XDG_STATE_HOME:-$HOME/.local/state}"
RELEASE_ROOT="$STATE_HOME/opencode-usage-meter/releases/$VERSION-$SHA"
test "$(node --input-type=module -e 'import{statSync}from"node:fs";process.stdout.write((statSync(process.argv[1]).mode&0o777).toString(8))' "$RELEASE_ROOT")" = 700 || exit 1
MANIFEST="$RELEASE_ROOT/manifest.json"
test "$(jq -r .sha "$MANIFEST")" = "$SHA" && test "$(jq -r .version "$MANIFEST")" = "$VERSION" || exit 1
CANDIDATE_TGZ=$(jq -r .candidate "$MANIFEST")
ARTIFACT_DIR=$(dirname "$CANDIDATE_TGZ")
node --input-type=module -e 'import{createHash}from"node:crypto";import{readFileSync}from"node:fs";const actual=createHash("sha512").update(readFileSync(process.argv[1])).digest("hex");const expected=JSON.parse(readFileSync(process.argv[2],"utf8")).sha512;if(actual!==expected)process.exit(1)' "$CANDIDATE_TGZ" "$RELEASE_ROOT/manifest.json"
test "sha512-$(openssl dgst -sha512 -binary "$CANDIDATE_TGZ" | openssl base64 -A)" = "$(jq -r .integrity "$MANIFEST")" || exit 1
```

If npm publish times out or the response is lost, never blindly republish. First run `node --input-type=module -e 'import{createHash}from"node:crypto";import{readFileSync}from"node:fs";const actual=createHash("sha512").update(readFileSync(process.argv[1])).digest("hex");const expected=JSON.parse(readFileSync(process.argv[2],"utf8")).sha512;if(actual!==expected)process.exit(1)' "$CANDIDATE_TGZ" "$RELEASE_ROOT/manifest.json"`, then query `npm view "opencode-cli-usage-meter@$VERSION" version dist.integrity dist.shasum dist.tarball --json --registry https://registry.npmjs.org`. If the version exists, download it and compare it byte-for-byte with the retained `$CANDIDATE_TGZ`; a match means the publish succeeded and may proceed to tagging, while any mismatch must be deprecated and fixed forward. If the version is still `E404`, re-run the same portable Node verification command and retry only `npm publish "$CANDIDATE_TGZ" --access public --registry https://registry.npmjs.org`, never a rebuilt artifact.

If publication succeeds but tag creation or tag push fails, do not publish that version again. Re-run the same portable Node verification command above, download the npm artifact, compare it byte-for-byte and by file list against the retained local candidate, and create the missing signed annotated tag only if every comparison succeeds. If signing is unavailable, stop the release. Publish the missing tag with the same atomic leased `git push --atomic --porcelain` command above so a racing `main` advance or tag collision rejects the whole push. If a remote `v$VERSION` tag appears after publication, fetch it with `git fetch origin "refs/tags/v$VERSION:refs/tags/v$VERSION"`, run `git verify-tag "v$VERSION"`, then verify `test "$(git rev-parse "refs/tags/v$VERSION^{}")" = "$SHA"` and inspect `git cat-file -p "refs/tags/v$VERSION"` for the reviewed object and release message. An unsigned or invalid tag fails recovery with no fallback. Only a cryptographically verified matching remote tag is recorded as successful recovery. A conflicting remote tag must never be overwritten: never overwrite or force-push a conflicting tag; deprecate the affected npm version and fix forward with a successor. On any artifact mismatch, do not reconcile the tag; deprecate the published version and fix forward with a successor.

If a bad version is published, do not unpublish. Deprecate the exact version and prepare a corrected successor from reviewed `main`:

```bash
npm deprecate opencode-cli-usage-meter@<bad-version> "Defective release; upgrade to <successor-version>" --registry https://registry.npmjs.org
```
