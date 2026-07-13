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

Release automation is staged for `main` only through semantic-release and public npm provenance. The release workflow uses GitHub OIDC (`id-token: write`) plus npm trusted publishing/provenance configuration; it pins Node `22.14.0`, installs exact npm `11.5.1`, and does not name long-lived npm tokens.

Before any release, `pnpm release:guard` checks package metadata, tag format, npm provenance settings, CI/release workflow permissions, and archive/export validation commands. `pnpm release:dry-run` is available for non-publishing semantic-release validation; do not run `pnpm release`, create tags, or publish from a local workspace.

### First publish bootstrap

npm trusted publisher setup remains required. Automated release fails closed while `npm view opencode-cli-usage-meter version --json` returns `E404`. Bootstrap once with local npm login and 2FA. Set the reviewed commit explicitly; ANY status output is a STOP. The query must show all three named checks successful for that SHA:

```bash
git switch main
git pull --ff-only
SHA=$(git rev-parse HEAD)
test "$SHA" = "<reviewed-exact-main-sha>" || { echo "STOP: wrong main SHA"; exit 1; }
test -z "$(git status --porcelain=v1)" || { echo "STOP: non-empty git status"; exit 1; }
gh api "repos/ninjoan/opencode-usage-meter/commits/$SHA/check-runs" --paginate \
  --jq '.check_runs[] | [.name,.conclusion] | @tsv' | sort
test "$(gh api "repos/ninjoan/opencode-usage-meter/commits/$SHA/check-runs" --paginate \
  --jq '[.check_runs[] | select(.conclusion=="success") | .name] | unique |
  (["package","native-pty (ubuntu-latest)","native-pty (macos-latest)"] - .) | length')" = 0 \
  || { echo "STOP: required checks are not successful for $SHA"; exit 1; }
pnpm install --frozen-lockfile
pnpm typecheck && pnpm test && pnpm build && pnpm smoke:consumer && pnpm smoke:pty-native
npm whoami
npm publish --provenance --access public
```

Do not provide an npm token to GitHub. After npm confirms the package exists, configure its trusted publisher for repository `ninjoan/opencode-usage-meter` and workflow `.github/workflows/release.yml`. Only then may the main-only automated release run.

### Release recovery

If npm publication succeeds but tag or GitHub Release creation fails, do not publish that version again. Build the reviewed commit, download npm's artifact, and compare identity and bytes before touching tags:

```bash
VERSION=<published-version>; SHA=<reviewed-release-sha>
test "$(git rev-parse HEAD)" = "$SHA" && test -z "$(git status --porcelain=v1)" || exit 1
pnpm build && mkdir -p /tmp/usage-meter-recovery/{local,published}
npm pack --json --ignore-scripts --pack-destination /tmp/usage-meter-recovery/local > /tmp/local-pack.json
npm view "opencode-cli-usage-meter@$VERSION" version dist.integrity dist.shasum dist.tarball --json > /tmp/published.json
test "$(jq -r .version /tmp/published.json)" = "$VERSION" || exit 1
curl -fL "$(jq -r .dist.tarball /tmp/published.json)" -o /tmp/usage-meter-recovery/published/package.tgz
test "$(sha1sum /tmp/usage-meter-recovery/published/package.tgz | cut -d' ' -f1)" = "$(jq -r .dist.shasum /tmp/published.json)" || exit 1
INTEGRITY=$(jq -r .dist.integrity /tmp/published.json); test "sha512-$(openssl dgst -sha512 -binary /tmp/usage-meter-recovery/published/package.tgz | openssl base64 -A)" = "$INTEGRITY" || exit 1
tar -xzf /tmp/usage-meter-recovery/local/*.tgz -C /tmp/usage-meter-recovery/local
tar -xzf /tmp/usage-meter-recovery/published/package.tgz -C /tmp/usage-meter-recovery/published
EXPECTED='LICENSE README.md SECURITY.md dist/tui.d.ts dist/tui.js dist/tui.js.map package.json'
test "$(cd /tmp/usage-meter-recovery/published/package && find . -type f -printf '%P\n' | sort | xargs)" = "$EXPECTED" || exit 1
(cd /tmp/usage-meter-recovery/local/package && sha256sum $EXPECTED) > /tmp/local.sha256
(cd /tmp/usage-meter-recovery/published/package && sha256sum $EXPECTED) > /tmp/published.sha256
diff -u /tmp/local.sha256 /tmp/published.sha256 || exit 1
npm whoami && npm owner ls opencode-cli-usage-meter
git fetch origin --tags
git show "$SHA"
```

Only after every comparison succeeds may the missing `v<version>` tag be created at that exact commit and pushed. On ANY mismatch, do not reconcile tags: deprecate the version and fix forward. Preserve incorrect tags/releases and fix forward; never move a published release tag.

An npm publication is immutable. For a bad publication, deprecate the exact version and immediately prepare a corrected successor through the normal reviewed main workflow:

```bash
npm deprecate opencode-cli-usage-meter@<bad-version> "Defective release; upgrade to <successor-version>"
```

Never recommend or attempt destructive unpublish as release recovery.
