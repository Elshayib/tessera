import { validateDocument } from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import { newId, ok } from "@tessera/std";
import * as Y from "yjs";
import { deriveChangeSet, isChangeSetEmpty } from "./change-set.js";
import type { TransactionRecord } from "./command-types.js";
import type { DocumentHandle } from "./document-types.js";
import { createDocumentWriter } from "./internal/document-writer.js";
import { summarizeChangeSet } from "./summarize-change-set.js";
import { fromYDoc, rootMap } from "./yjs-mapping.js";

/**
 * Undo/redo scope (`docs/04-command-bus.md` §6).
 *
 * @public
 */
export type UndoScope =
  | { readonly kind: "author"; readonly authorId: string }
  | { readonly kind: "run"; readonly runId: string };

/**
 * Per-author / per-run undo (`docs/04-command-bus.md` §6).
 *
 * @public
 */
export interface UndoService {
  undo(scope: UndoScope): Result<TransactionRecord | null, TesseraError>;
  redo(scope: UndoScope): Result<TransactionRecord | null, TesseraError>;
  canUndo(scope: UndoScope): boolean;
  canRedo(scope: UndoScope): boolean;
  revertRun(runId: string): Result<readonly TransactionRecord[], TesseraError>;
  history(scope: UndoScope, limit?: number): readonly TransactionRecord[];
}

/**
 * Hooks the command bus uses so UndoManager exists before `ydoc.transact`.
 *
 * @public
 */
export interface UndoCapture {
  track(origin: string): void;
  stackSize(origin: string): number;
  trimStack(origin: string, size: number): void;
  record(transaction: TransactionRecord, origin: string): void;
}

/**
 * Factory result for {@link createUndoService}.
 *
 * @public
 */
export interface CreatedUndoService {
  readonly undo: UndoService;
  readonly capture: UndoCapture;
  committed(): readonly TransactionRecord[];
}

interface OriginSlot {
  readonly manager: Y.UndoManager;
  readonly records: TransactionRecord[];
  readonly redo: TransactionRecord[];
}

/**
 * Creates lazily one Yjs UndoManager per origin (`INV-CMD-04`, `INV-CMD-09`).
 *
 * @example
 * ```ts
 * const { doc } = createDocument();
 * const created = createUndoService(doc);
 * const bus = createCommandBus(doc, { undo: created.capture });
 * ```
 *
 * @public
 */
export function createUndoService(handle: DocumentHandle): CreatedUndoService {
  const slots = new Map<string, OriginSlot>();
  const authorOrigins = new Map<string, string>();
  const runOrigins = new Map<string, string>();
  const committed: TransactionRecord[] = [];
  const writer = createDocumentWriter(handle.ydoc);

  const ensureSlot = (origin: string): OriginSlot => {
    const existing = slots.get(origin);
    if (existing !== undefined) {
      return existing;
    }
    const manager = new Y.UndoManager(rootMap(handle.ydoc), {
      trackedOrigins: new Set([origin]),
      captureTimeout: 0,
    });
    const slot: OriginSlot = { manager, records: [], redo: [] };
    slots.set(origin, slot);
    const parsed = parseOrigin(origin);
    if (parsed.runId !== undefined) {
      runOrigins.set(parsed.runId, origin);
    } else {
      authorOrigins.set(parsed.id, origin);
    }
    return slot;
  };

  const resolveOrigin = (scope: UndoScope): string | undefined => {
    if (scope.kind === "run") {
      return runOrigins.get(scope.runId);
    }
    return authorOrigins.get(scope.authorId);
  };

  const repair = (): void => {
    const snapshot = fromYDoc(handle.ydoc);
    const report = validateDocument(snapshot);
    if (report.ok) {
      return;
    }
    const ids = new Set(Object.keys(snapshot.entities));
    handle.ydoc.transact(() => {
      for (const entity of Object.values(snapshot.entities)) {
        if (entity.parent !== null && !ids.has(entity.parent)) {
          writer.updateEntity({ ...entity, parent: null });
        }
      }
    }, "core.undo.repair");
    handle.logger.warn("core.undo.repaired", { issueCount: report.issues.length });
  };

  const capture: UndoCapture = {
    track(origin) {
      ensureSlot(origin);
    },
    stackSize(origin) {
      const slot = slots.get(origin);
      if (slot === undefined) {
        return 0;
      }
      return slot.manager.undoStack.length;
    },
    trimStack(origin, size) {
      const slot = slots.get(origin);
      if (slot === undefined) {
        return;
      }
      while (slot.manager.undoStack.length > size) {
        slot.manager.undoStack.pop();
      }
    },
    record(transaction, origin) {
      const slot = ensureSlot(origin);
      slot.records.push(transaction);
      slot.redo.length = 0;
      committed.push(transaction);
    },
  };

  const undo: UndoService = {
    undo(scope) {
      const origin = resolveOrigin(scope);
      if (origin === undefined) {
        return ok(null);
      }
      const slot = slots.get(origin);
      if (slot === undefined || slot.records.length === 0) {
        return ok(null);
      }
      const record = slot.records.pop();
      if (record === undefined) {
        return ok(null);
      }
      slot.manager.undo();
      slot.redo.push(record);
      repair();
      return ok(record);
    },
    redo(scope) {
      const origin = resolveOrigin(scope);
      if (origin === undefined) {
        return ok(null);
      }
      const slot = slots.get(origin);
      if (slot === undefined || slot.redo.length === 0) {
        return ok(null);
      }
      const record = slot.redo.pop();
      if (record === undefined) {
        return ok(null);
      }
      slot.manager.redo();
      slot.records.push(record);
      repair();
      return ok(record);
    },
    canUndo(scope) {
      const origin = resolveOrigin(scope);
      if (origin === undefined) {
        return false;
      }
      const slot = slots.get(origin);
      return slot !== undefined && slot.records.length > 0;
    },
    canRedo(scope) {
      const origin = resolveOrigin(scope);
      if (origin === undefined) {
        return false;
      }
      const slot = slots.get(origin);
      return slot !== undefined && slot.redo.length > 0;
    },
    revertRun(runId) {
      const origin = runOrigins.get(runId);
      if (origin === undefined) {
        return ok([]);
      }
      const slot = slots.get(origin);
      if (slot === undefined) {
        return ok([]);
      }
      const before = fromYDoc(handle.ydoc);
      const reverted: TransactionRecord[] = [];
      while (slot.records.length > 0) {
        const record = slot.records.pop();
        if (record === undefined) {
          break;
        }
        slot.manager.undo();
        slot.redo.push(record);
        reverted.push(record);
      }
      repair();
      const after = fromYDoc(handle.ydoc);
      const changeSet = deriveChangeSet(before, after, "");
      const summarized = { ...changeSet, summary: summarizeChangeSet(changeSet) };
      if (!isChangeSetEmpty(summarized)) {
        committed.push({
          id: newId("t"),
          author: { kind: "system", id: "undo" },
          label: `Revert run ${runId}`,
          startedAt: handle.clock.nowIso(),
          durationMs: 0,
          commands: [],
          changeSet: summarized,
        });
      }
      return ok(reverted);
    },
    history(scope, limit) {
      const origin = resolveOrigin(scope);
      if (origin === undefined) {
        return [];
      }
      const slot = slots.get(origin);
      if (slot === undefined) {
        return [];
      }
      const newestFirst = [...slot.records].reverse();
      if (limit === undefined) {
        return newestFirst;
      }
      return newestFirst.slice(0, limit);
    },
  };

  return {
    undo,
    capture,
    committed() {
      return committed;
    },
  };
}

function parseOrigin(origin: string): { id: string; runId?: string } {
  const marker = ":run:";
  const runAt = origin.indexOf(marker);
  if (runAt === -1) {
    const colon = origin.indexOf(":");
    return { id: origin.slice(colon + 1) };
  }
  const head = origin.slice(0, runAt);
  const colon = head.indexOf(":");
  return { id: head.slice(colon + 1), runId: origin.slice(runAt + marker.length) };
}
