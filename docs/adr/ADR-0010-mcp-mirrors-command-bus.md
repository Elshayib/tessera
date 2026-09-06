# ADR-0010 — MCP server mirrors the command bus and runs inside the editor

Status: Accepted · Date: 2026-09-06

## Context
Users on Claude Code / Cursor / Codex subscriptions want to drive Tessera without API keys. MCP is the common protocol. The document lives in the browser/webview; browsers cannot listen on sockets; MCP clients speak stdio or HTTP.

## Decision
- MCP tools are generated from the command and query registries (same names, same schemas, same tier gating). No separate MCP-only semantics.
- The MCP **server logic** runs inside the editor (`@tessera/mcp`, TypeScript, MCP SDK with a custom transport). A dumb **pipe** process (Node `apps/mcp-server` or a Rust shim in the desktop app) bridges stdio/HTTP to the editor over a token-protected loopback WebSocket.
- MCP sessions are agent runs (`author.kind = 'agent'`) with their own revertible run group.

## Alternatives
- Standalone MCP server holding its own copy of the document (headless core) and syncing to the editor via Yjs: viable and may be added later for headless workflows, but doubles the surfaces to keep consistent and complicates screenshots.
- Implementing MCP in Rust in the desktop shell: duplicates protocol logic outside TypeScript; rejected.

## Consequences
- One tool surface to test (`INV-MCP-02`).
- Web users need to run `npx @tessera/mcp-server`; desktop users get automatic setup.
