import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import { openTranscriptDatabase, USAGE_STORE } from "./transcript/idb.js";
import { createUsageLedger, type UsageLedger, type UsageRecord } from "./usage-ledger.js";

interface UsageRow extends UsageRecord {
  readonly id: string;
}

/**
 * IndexedDB-backed {@link UsageLedger} on `tessera-transcripts` (`07` §7).
 *
 * `record` enqueues a write; await {@link IndexedDbUsageLedger.flushed} before reopening.
 *
 * @example
 * ```ts
 * const created = await createIndexedDbUsageLedger();
 * if (created.ok) {
 *   created.value.record({
 *     runId: "r_a",
 *     conversationId: "c_1",
 *     projectId: "p",
 *     providerId: "openai",
 *     inputTokens: 1,
 *     outputTokens: 0,
 *     costUsd: 0,
 *   });
 * }
 * ```
 *
 * @public
 */
export interface IndexedDbUsageLedger extends UsageLedger {
  readonly flushed: () => Promise<void>;
}

/**
 * Opens the usage object store and hydrates an in-memory {@link UsageLedger}.
 *
 * @public
 */
export async function createIndexedDbUsageLedger(
  factory?: IDBFactory,
): Promise<Result<IndexedDbUsageLedger, TesseraError>> {
  const indexedDb = factory ?? (typeof indexedDB === "undefined" ? undefined : indexedDB);
  if (indexedDb === undefined) {
    return err(tesseraError("UNSUPPORTED", "IndexedDB is not available"));
  }
  const opened = await openTranscriptDatabase(indexedDb);
  if (!opened.ok) {
    return opened;
  }
  const db = opened.value;
  const loaded = await getAllUsage(db);
  if (!loaded.ok) {
    return loaded;
  }
  const memory = createUsageLedger();
  for (const row of loaded.value) {
    memory.record(toRecord(row));
  }
  let writes: Promise<void> = Promise.resolve();
  return ok({
    record(entry) {
      memory.record(entry);
      writes = writes.then(async () => {
        const written = await putUsage(db, entry);
        if (!written.ok) {
          return;
        }
      });
    },
    forRun(runId) {
      return memory.forRun(runId);
    },
    forConversation(conversationId) {
      return memory.forConversation(conversationId);
    },
    forProject(projectId) {
      return memory.forProject(projectId);
    },
    monthlyByProvider() {
      return memory.monthlyByProvider();
    },
    flushed() {
      return writes;
    },
  });
}

function toRecord(row: UsageRow): UsageRecord {
  return {
    runId: row.runId,
    conversationId: row.conversationId,
    projectId: row.projectId,
    providerId: row.providerId,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    costUsd: row.costUsd,
  };
}

function putUsage(db: IDBDatabase, entry: UsageRecord): Promise<Result<void, TesseraError>> {
  const row: UsageRow = { id: crypto.randomUUID(), ...entry };
  return new Promise((resolve) => {
    const tx = db.transaction(USAGE_STORE, "readwrite");
    const request = tx.objectStore(USAGE_STORE).put(row);
    request.onsuccess = () => {
      resolve(ok(undefined));
    };
    request.onerror = () => {
      resolve(err(tesseraError("IO_ERROR", "failed to write usage record")));
    };
  });
}

function getAllUsage(db: IDBDatabase): Promise<Result<readonly UsageRow[], TesseraError>> {
  return new Promise((resolve) => {
    const tx = db.transaction(USAGE_STORE, "readonly");
    const request = tx.objectStore(USAGE_STORE).getAll();
    request.onsuccess = () => {
      resolve(ok(request.result));
    };
    request.onerror = () => {
      resolve(err(tesseraError("IO_ERROR", "failed to read usage records")));
    };
  });
}
