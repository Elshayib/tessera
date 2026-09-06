# 11 — MCP server and desktop shell

Status: Draft (direction fixed; details finalized at phase 5 start) · Last updated: 2026-09-06 · Packages: `@tessera/mcp`, `apps/mcp-server`, `apps/desktop` · Phase: 5

## 1. Purpose and scope

External coding agents (Claude Code, Cursor, Codex, VS Code, others) drive the editor through the Model Context Protocol using the **same command and query surface** as the UI and the built-in agent (ADR-0010). The desktop shell packages the web app with local files, a keychain-backed vault, a loopback proxy for providers without CORS, local model discovery, headless Blender jobs and the MCP transport.

## 2. MCP surface

- **Tools**: one per command and query in the registries, same names (`entity.create`, `scene.describe`, …), input JSON Schema generated from Zod, descriptions identical to the built-in agent's tool descriptions. Tier filtering per client (default tiers 0–3; tier 4 opt-in).
- **Meta tools**: `tessera.status` (connected editor, document name, counts), `tessera.screenshot` (alias of `view.screenshot` returning image content), `tessera.undo_run` (reverts this MCP session's run group), `tessera.set_policy` (confirmDestructive etc., within limits configured in the editor).
- **Resources**: `tessera://scene/outline` (text, `scene.describe` outline), `tessera://scene/entity/{idOrPath}` (JSON), `tessera://assets` (JSON list), `tessera://history` (recent transactions), `tessera://screenshot/latest` (image).
- **Prompts**: `compose-scene` (guides a client agent through the working method in `06 §6`), `review-scene` (asks for a critique using screenshots).
- **Versioning**: `serverInfo.version` = package version; the tool surface is versioned with the document format; breaking tool changes bump the minor pre-1.0.

## 3. Topology and bridge protocol

The MCP server logic lives in `@tessera/mcp` and runs **inside the editor** (browser tab or desktop webview), where the document is. A process on the user's machine provides the stdio (or HTTP) transport and pipes JSON-RPC to the editor over a localhost WebSocket:

```
MCP client (Claude Code) ⇄ stdio ⇄ tessera-mcp (pipe) ⇄ ws://127.0.0.1:<port>?token=… ⇄ editor (@tessera/mcp server)
```

- **Pipe implementations**: `apps/mcp-server` (Node, `npx @tessera/mcp-server`, for web users) and a Rust shim bundled in the desktop app. Both are protocol-agnostic pipes; all MCP semantics are in the editor.
- **Handshake**: the editor listens (desktop: Rust side opens the WebSocket server on an ephemeral port; web: the Node pipe opens the server and the tab connects out to it — browsers cannot listen). Web flow: user runs `npx @tessera/mcp-server`, it prints a one-time code; user enters it in Settings → MCP; the tab connects and both sides share a session token. Desktop flow: automatic.
- **Multiple tabs/projects**: the pipe routes to the tab the user marks **active for MCP**; tools return `CONFLICT` with guidance when none is active.
- **Streamable HTTP** transport (localhost only, bearer token) is offered for clients that prefer it; same pipe.

## 4. Client auto-configuration (desktop, opt-in per client)

Settings → MCP lists detected clients with toggles; enabling one writes the client's configuration (Claude Code via `claude mcp add`, Cursor `~/.cursor/mcp.json`, Codex `~/.codex/config.toml`, VS Code `mcp.json`) pointing at the bundled shim, and shows the exact snippet for manual setup. Nothing is written without the user's explicit toggle. Web users get copyable snippets for `npx @tessera/mcp-server`.

## 5. Desktop shell (Tauri 2)

| Capability | Implementation |
| --- | --- |
| Projects on disk | `FsProjectStore`/`FsBlobStore` through Tauri fs APIs; project folder format (`03 §10`); recent projects; file associations for `.tessera` |
| Vault | OS keychain via Tauri plugin; same `KeyVault` interface |
| Loopback proxy | Rust HTTP server bound to `127.0.0.1` with a per-launch token; forwards to allowlisted provider origins; used automatically by `providers-llm` when `browserDirect = 'no'` |
| Local models | Ollama discovery at `http://localhost:11434`; LM Studio at `http://localhost:1234/v1`; shows models in the picker |
| Headless Blender | Path detection (settings), `blender -b --python … -- job.json` runner implementing the job contract (§6) |
| MCP transport | Rust WebSocket server + stdio shim (§3) |
| Updates | `tauri-plugin-updater` with signed releases from GitHub Releases |
| Diagnostics | Local log files, "export diagnostics" bundle; no telemetry |

The frontend is `apps/web` unchanged, with platform capabilities injected through the `EditorContext` (`storage`, `vault`, `proxy`, `mcp`).

## 6. Headless job contract (Blender and other external tools)

Jobs are JSON files executed by an external tool; results are files the desktop app imports through the normal pipeline.

```json
{ "id": "j_…", "kind": "remesh" | "decimate" | "uv-unwrap" | "bake" | "convert",
  "input": { "file": "…/in.glb", "meshName": "oak" },
  "params": { "targetFaces": 5000 },
  "output": { "dir": "…/out" } }
```
Result: `result.json` `{ ok, files: [...], warnings, stats }`. Implemented by `bridges/blender-addon/tessera_jobs.py` (phase 7). The desktop `JobQueue` adapter spawns the process, streams progress from stdout lines prefixed `TESSERA_PROGRESS <0-1>`, and honors cancellation by killing the process.

## 7. Security

- WebSocket and HTTP transports bind to loopback only; every message carries the session token; tokens rotate per launch; the editor shows connected clients and lets the user disconnect them.
- Tool allowlists per client; destructive tools require confirmation: when the client supports MCP elicitation the server asks through it, otherwise it returns `PERMISSION_DENIED` with instructions for the user to confirm in the editor.
- Inputs are validated by the same Zod schemas; outputs are compacted like agent tool results; screenshots are returned as image content with size caps.
- The MCP surface exposes no filesystem, network or key access.

## 8. Invariants

| Id | Invariant |
| --- | --- |
| INV-MCP-01 | Every MCP tool executes through the command bus with `author.kind = 'agent'` and a session `runId`; `tessera.undo_run` reverts exactly that session's transactions. |
| INV-MCP-02 | The MCP tool list equals the command/query registries filtered by tier; a test compares them. |
| INV-MCP-03 | Transports never bind to non-loopback interfaces; a test asserts the listen address. |
| INV-MCP-04 | The pipe processes contain no MCP semantics (protocol conformance tests run against the editor-side server with an in-memory transport). |

## 9. Test plan

- MCP conformance tests with the official SDK client against the in-editor server over an in-memory transport (tools/list, tools/call, resources, prompts, error mapping).
- Pipe tests: stdio ↔ WebSocket forwarding with backpressure and disconnects.
- Desktop: Tauri e2e (WebDriver) smoke on each OS in release workflows; proxy allowlist tests; vault round-trip.
