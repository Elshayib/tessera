# 14 — Security threat model

Status: Accepted · Last updated: 2026-09-06 · Applies to every package · Phase: 0+

## 1. Assets to protect

1. **Provider API keys** (highest value; direct financial impact).
2. **User projects and blobs** (confidentiality of unreleased work, integrity of documents).
3. **The user's machine** (desktop app, MCP transports, headless job runners).
4. **Other participants in collaboration rooms.**
5. **The supply chain** (what we ship to every user).

## 2. Actors and entry points

| Actor | Entry point |
| --- | --- |
| Malicious file (glTF/GLB, image, HDR, `.tessera` archive) | Import pipeline, archive import |
| Malicious content reaching the model (asset descriptions, file names, peer names, search results, pasted text) | Agent prompts (indirect prompt injection) |
| Malicious or buggy MCP client | MCP transport |
| Malicious peer in a room | Yjs updates, awareness, blob transfer |
| Compromised dependency or build | Supply chain |
| Malicious plugin or script | Plugin API, sandbox |
| Local attacker with profile access | Browser storage, keychain |

## 3. Threats and mitigations

| Id | Threat | Mitigation | Phase |
| --- | --- | --- | --- |
| SEC-01 | Key exfiltration via XSS | Strict CSP (`default-src 'self'`; `connect-src` allowlist built from configured providers; no inline scripts; `object-src 'none'`; `frame-ancestors 'none'`); React escaping everywhere; agent output rendered through a Markdown renderer with HTML disabled; no `dangerouslySetInnerHTML` (lint rule) | 0–2 |
| SEC-02 | Key exfiltration via a malicious provider URL (`openai-compatible` base URL pointing anywhere) | Keys are sent only to the base URL configured for *that* provider entry; UI shows the origin prominently; keys for built-in providers cannot be re-pointed without creating a new entry | 2 |
| SEC-03 | Keys at rest | Optional passphrase encryption (AES-GCM, PBKDF2 600k); desktop uses OS keychain; explicit warning when unencrypted | 2, 5 |
| SEC-04 | Keys in logs, traces, documents, exports | `redact()` on all log fields; secrets never placed in documents by design; export and trace tests scan for key patterns | 0+ |
| SEC-05 | Indirect prompt injection through content | All third-party text wrapped in `<untrusted source=…>`; system prompt instructs to treat it as data; destructive tools gated by `confirmDestructive`; no generic web fetch tool; tool results compacted; asset descriptions truncated to 500 chars | 2 |
| SEC-06 | Agent destroying work | Every run is revertible as a unit; destructive tools require confirmation; budgets cap runaway loops | 2 |
| SEC-07 | Malicious glTF (huge buffers, decompression bombs, malformed indices) | Parsing in a worker with size limits (hard blob limit, ≤ 2M triangles warn, index bounds validation by gltf-transform); worker terminated on timeout (60 s); no `eval` in loaders | 1 |
| SEC-08 | Zip bomb / path traversal in `.tessera` archives | Streaming unzip with per-entry and total size limits; entry names validated (`blobs/<hash>`, `project.tessera.json`, `manifest.json` only) | 1 |
| SEC-09 | MCP transport abuse from other local processes or web pages | Loopback bind only; per-session token required on connect; origin check on WebSocket upgrade (only the app's origin or the desktop webview); tool allowlists; rate limit 20 tool calls/s | 5 |
| SEC-10 | MCP client drives destructive actions without user awareness | Same destructive gate as the built-in agent; editor shows a live "MCP client connected: X" banner with disconnect | 5 |
| SEC-11 | Malicious peer corrupts the document | Post-transaction invariant check with repair; per-author attribution and history; viewer role enforced server-side in server rooms; P2P rooms require the key | 6 |
| SEC-12 | Malicious peer sends bad blobs | Content hash verification on receipt; size limits; mime sniffing before use | 6 |
| SEC-13 | Sandbox escape from scripts | QuickJS in a dedicated worker; no host APIs beyond the message channel; CPU interrupt and memory caps; conformance tests attempt known escapes | 7 |
| SEC-14 | Supply-chain compromise | Exact lockfile; Renovate with review; `pnpm audit` gate; no postinstall scripts without review; provenance attestations on publish; GitHub Actions pinned to SHAs; least-privilege tokens; 2FA required for publishers | 0+ |
| SEC-15 | Malicious plugin | Permissions declared and enforced at registry level; network limited to declared origins; dynamic loading only sandboxed (post-1.0) | 8 |
| SEC-16 | Clickjacking / embedding | `frame-ancestors 'none'`; `X-Frame-Options: DENY` | 0 |
| SEC-17 | Local proxy misuse (desktop) | Proxy binds to loopback, requires the launch token, forwards only to allowlisted provider origins | 5 |
| SEC-18 | Update tampering (desktop) | Signed updates (Tauri updater keys stored offline); release checksums published | 5 |

## 4. Data handling and privacy

- No telemetry, analytics or crash reporting leaves the machine. Diagnostics are exported only by explicit user action.
- Prompts and transcripts stay local (IndexedDB / local files) and are excluded from collaboration sync.
- Documents contain no personal data by design; user display names in rooms are user-chosen.

## 5. Secure development practices

- Security review checklist item in every PR (`01 §11` item 8).
- Threat model updated in the same PR when a new entry point is added (new transport, new provider kind, new file format).
- Dependencies with network access are listed in `docs/templates/dependency-inventory.md` with justification.
- Coordinated disclosure per `SECURITY.md`.

## 6. Invariants

| Id | Invariant |
| --- | --- |
| INV-SEC-01 | The web app's CSP contains no `unsafe-inline`, `unsafe-eval`, or wildcard `connect-src`. |
| INV-SEC-02 | No secret string configured in the vault appears in any log line, trace export, document snapshot or export bundle (test injects a canary key and scans outputs). |
| INV-SEC-03 | Every network request made by the app targets either the app origin, a configured provider/proxy origin, a configured asset source, a configured room server/signaling server, or loopback. |
| INV-SEC-04 | Destructive operations from any agent path require confirmation unless the user disabled the gate for that run. |
