# ADR-0003 — Yjs as the document store; fractional indexing for order

Status: Accepted · Date: 2026-09-06

## Context
Collaboration (phase 6) and per-author undo (phase 0) both need a document that merges concurrent edits and attributes changes by origin. Retrofitting a CRDT onto a plain-object store later would rewrite the core.

## Decision
The document is a Yjs `Y.Doc` from day one (`03 §9` mapping: nested `Y.Map`s, atomic JSON leaves for vectors and small nested objects). Sibling order uses fractional-index string keys (`fractional-indexing`) rather than list positions, so reordering is a single field write that merges cleanly. Persistence via `y-indexeddb` (browser) and update logs/snapshots (files). Undo via `Y.UndoManager` with tracked origins.

## Alternatives
- Plain JSON + immer + custom undo, add CRDT later: rejected (rewrite risk, no per-author undo semantics).
- Automerge / Loro: capable (Loro has native move and rich text), but Yjs has the broadest provider ecosystem (webrtc, websocket, indexeddb, Hocuspocus) and the most production use in editors; Loro remains a candidate if move-semantics or performance on huge documents become a problem (would require a new ADR).
- `Y.Array` for children: rejected — Yjs has no move operation; delete+insert loses identity and merges poorly.

## Consequences
- Every mutation goes through `Y.Doc.transact` with an origin, inside the command bus (`ADR-0004`).
- Field-level merge semantics; last-writer-wins for atomic leaves (documented and surfaced in a conflicts panel).
- Snapshot JSON is a projection; the Yjs update log is the source for sync.
