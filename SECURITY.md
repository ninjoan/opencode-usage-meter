# Security Policy

This package must not read provider credentials, auth files, browser cookies, Keychain entries, raw tokens, undocumented provider endpoints, or OpenCode internal auth readers.

Do not attach real credentials to issues, fixtures, logs, screenshots, or test cases. Use synthetic CLI output only.

Manual release only. No GitHub NPM_TOKEN, checked-in secret, release workflow, automated publish job, or dynamic release downloader is authorized in the current scope. The first manual npm release has no provenance because local interactive npm publish cannot produce npm provenance. `npm whoami` confirms identity only; it does not prove 2FA. Maintainers must attest write-required 2FA is enabled in npm account settings, use the registry-controlled OTP challenge, and avoid automation tokens, bypass tokens, stored secrets, or noninteractive publish for the first bootstrap. No secrets are stored. Maintainers publish the retained candidate tarball with `npm publish "$CANDIDATE_TGZ" --access public --registry https://registry.npmjs.org` only after re-fetching and proving the reviewed SHA is still current `origin/main` and using the README portable Node SHA-512 command to compare the candidate against manifest `.sha512`, then publish a signed annotated tag with the atomic leased `git push --atomic --porcelain` command. If signing is unavailable, stop the release. A racing remote tag may be accepted only if its peeled target and tag content match the reviewed SHA/release; maintainers must never overwrite or force-push a conflicting tag and must deprecate the affected npm version plus fix forward instead.

Report security concerns through a private maintainer channel before opening public issues.
