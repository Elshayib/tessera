# 10 — Collaboration

Status: Draft (direction fixed; details finalized at phase 6 start) · Last updated: 2026-09-06 · Packages: `@tessera/collab`, `apps/collab-server` · Phase: 6

## 1. Purpose and scope

Several humans and agents edit one document at the same time, with presence, ownership signals, attribution and per-author undo, without a mandatory server. The document is already a Yjs CRDT (ADR-0003); this package adds transport, awareness, blob exchange, locks and room lifecycle.

## 2. Interfaces

```ts
export interface SyncProvider {
  readonly kind: 'webrtc' | 'websocket' | 'none';
  connect(room: RoomHandle, ydoc: Y.Doc, awareness: Awareness, signal?: AbortSignal): Promise<Result<void, TesseraError>>;
  disconnect(): Promise<void>;
  readonly status: 'disconnected' | 'connecting' | 'connected' | 'degraded';
  readonly events: Emitter<{ 'status.changed': { status: SyncProvider['status'] }; 'peers.changed': { count: number } }>;
  readonly blobs: BlobTransport;
}
export interface RoomHandle { readonly id: string /* 128-bit base32 */; readonly key?: string /* E2E key for P2P rooms; lives only in the URL fragment */; readonly serverUrl?: string; readonly token?: string }
export interface BlobTransport {
  request(hash: string, signal: AbortSignal): Promise<Result<Blob, TesseraError>>;     // ask peers or server for a missing blob
  announce(refs: readonly BlobRef[]): void;
}
export interface PresenceState {
  readonly peerId: string;
  readonly user: { readonly name: string; readonly color: string };                    // color from a fixed palette by peer id hash
  readonly selection: readonly EntityId[];
  readonly camera?: CameraPose;
  readonly status: 'idle' | 'editing' | 'agent-running';
  readonly locks: readonly EntityId[];                                                  // subtree roots claimed
  readonly agentRuns: readonly { readonly runId: string; readonly label: string; readonly startedAt: string }[];
  readonly updatedAt: number;
}
export interface LockService {
  acquire(roots: readonly EntityId[], owner: Author, ttlMs?: number): Result<void, TesseraError>;   // CONFLICT if any root is inside another peer's lock
  release(roots: readonly EntityId[]): void;
  isLocked(id: EntityId): { readonly by: PresenceState } | null;
}
```

## 3. Rooms

- **P2P room** (default, zero infrastructure): `y-webrtc` with a configurable signaling server list (public defaults + self-host instructions); the room password (`key`) encrypts traffic end-to-end; the share link is `https://<app>/p/<projectId>#room=<id>&key=<key>` — the fragment never reaches any server.
- **Server room**: `y-websocket`-compatible server (`apps/collab-server`, Hocuspocus) with persistence (SQLite), room tokens with roles, and HTTP blob storage. Self-hosted via Docker; deployable on free tiers.
- Switching a project from P2P to server rooms uploads the current state; both use the same Y.Doc.

## 4. Blob exchange

- Documents reference blobs by hash; peers fetch missing blobs on demand: P2P through data channels (chunked, 64 KB, resumable), server rooms through `PUT/GET /blobs/{hash}`.
- The renderer shows placeholders while blobs are in flight; the outliner shows a sync indicator per asset.
- Large blobs (> 64 MB) in P2P rooms prompt the user to use a server room.

## 5. Authorship and undo

- Each browser profile has a stable `peerId`; the local user `Author` id is the peer id; agent runs started by a peer carry `{ kind: 'agent', id: modelId, runId, peerId }` (peer id added to the origin string).
- Per-author undo (`04 §6`) already isolates stacks; remote transactions never enter local stacks. `revertRun` works for a run regardless of which peer hosted it (any peer can revert, attributed as `system` with `requestedBy`).
- History panel shows all transactions with author chips; filters by peer or agent.

## 6. Locks and conflicts

- Locks are advisory and awareness-based (no consensus): the UI blocks edits inside another peer's lock by default (override with a modifier); the agent runtime acquires locks on the entities in its plan and releases them at run end (`INV-COL-03`).
- Field-level concurrent edits resolve last-writer-wins via Yjs; a **Conflicts** panel lists fields edited by two authors within 5 s of each other with both values and one-click "keep mine/theirs" (which is just another command).
- Structural conflicts (e.g., one peer deletes a parent while another adds a child) are repaired by the post-transaction invariant check (`04 §4.7`): orphaned entities are re-parented to root and reported.

## 7. Permissions (server rooms)

Roles `owner`, `editor`, `viewer`; the server rejects updates from viewers (read-only connection) and enforces tokens; the UI hides editing affordances for viewers. P2P rooms have no roles — possession of the key is edit access.

## 8. Agents as collaborators

- An agent run is hosted by the peer who started it; others see its presence, plan, locks and transactions live.
- Background jobs (generation, import) are peer-local; results become transactions visible to all.
- Later (post-1.0): a room server can host agents so runs survive the initiating peer's disconnect.

## 9. Offline and reconnection

Yjs merges on reconnect; the UI shows sync state (`connected`, `N peers`, `offline — changes will sync`). Awareness expires after 30 s without heartbeat.

## 10. Server (`apps/collab-server`)

Hocuspocus with SQLite persistence and an HTTP blob store; room creation and tokens via a small admin CLI; Docker image; `docker compose` example; resource limits documented. No Tessera-hosted instance.

## 11. Security

- P2P: E2E encrypted by room key; signaling servers see only room ids.
- Server: TLS required, tokens per room and role, blob size limits, rate limits.
- Presence names are untrusted strings (escaped in UI, wrapped for the agent).

## 12. Invariants

| Id | Invariant |
| --- | --- |
| INV-COL-01 | Two peers applying disjoint transactions converge to identical canonical snapshots after sync. |
| INV-COL-02 | A local undo never reverts a remote author's transaction. |
| INV-COL-03 | The agent runtime never mutates an entity inside another peer's active lock unless the policy allows override. |
| INV-COL-04 | Room keys and tokens never appear in documents, logs or exports. |
| INV-COL-05 | Blob exchange is content-verified: received bytes are hashed and rejected on mismatch. |

## 13. Test plan

- In-process multi-doc tests (N `Y.Doc`s with an in-memory transport) for convergence, undo isolation, locks and repair.
- Playwright multi-page tests for presence, share links and blob exchange in P2P mode.
- Server integration tests with a local Hocuspocus instance.
