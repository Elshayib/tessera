# Security policy

## Reporting

Report vulnerabilities privately through GitHub's "Report a vulnerability" (Security Advisories) on this repository. Do not open public issues for security problems. Expect an acknowledgement within 72 hours and a fix or mitigation plan within 14 days for high-severity issues.

## Scope and model

Tessera has no backend. The threat model in `docs/14-security-threat-model.md` covers:

- **API keys** stored in the browser (IndexedDB, optionally passphrase-encrypted) and in the desktop app's OS keychain. Keys are only ever sent to the provider endpoint the user configured.
- **Untrusted content**: asset metadata, downloaded files, web pages and model outputs are treated as untrusted input to the agent (prompt-injection surface).
- **Sandboxed scripts**: agent- or user-written behaviors run in an isolated interpreter with no DOM, network, or key access.
- **MCP server**: binds to localhost only, requires a per-session token, and exposes an allowlisted tool set.
- **Supply chain**: exact lockfile, dependency review on every PR, npm provenance on published packages.

## Supported versions

Pre-1.0: only the latest minor release receives fixes. From 1.0: the latest major and the previous major for six months.
