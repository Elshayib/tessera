# ADR-0004 — Command bus as the sole mutation path; structural per-author undo

Status: Accepted · Date: 2026-09-06

## Context
Four clients mutate the document (UI, built-in agent, MCP, remote peers). Each needs identical validation, attribution, undo and change tracking. Hand-written inverse operations per command are error-prone; per-command inverses also break under concurrent edits.

## Decision
- All mutations execute through `CommandBus.execute`/`transaction` (`04-command-bus.md`), validated by Zod and semantic checks, inside a single Yjs transaction with the author as origin.
- Undo is **structural**: one `Y.UndoManager` per author id with `trackedOrigins`, `captureTimeout = 0`; run groups revert via per-run managers. Commands do not implement inverses.
- Change sets are **derived** from Yjs events, not from command semantics, so every path (including remote updates) yields the same diff format.

## Alternatives
- Command pattern with `undo()` per command: rejected (duplication, concurrency bugs).
- Snapshot diffing after each transaction: rejected for performance on large documents (D1) and for missing intermediate values.
- Fork-and-merge preview for agent runs (apply to a copy, merge on accept): deferred; the `dryRun` option keeps the door open (`ADR-0016`).

## Consequences
- `INV-ARCH-01` is enforceable mechanically (yjs imports confined; script checks for direct `transact`).
- Interactive tools must batch (one transaction per drag), which also reduces sync noise.
- Post-transaction invariant checks are needed for structural undo under concurrency (repair transactions).
