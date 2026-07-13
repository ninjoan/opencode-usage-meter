# Security Policy

This package must not read provider credentials, auth files, browser cookies, Keychain entries, raw tokens, undocumented provider endpoints, or OpenCode internal auth readers.

Do not attach real credentials to issues, fixtures, logs, screenshots, or test cases. Use synthetic CLI output only.

Automated release publishing must use trusted GitHub Actions provenance. Do not add long-lived npm tokens, checked-in secrets, or direct publish steps to workflows. The one-time package bootstrap is a manual `npm publish --provenance --access public` from reviewed `main` with local npm login and 2FA; after it succeeds, configure the exact repository/workflow trusted publisher before enabling automation.

Report security concerns through a private maintainer channel before opening public issues.
