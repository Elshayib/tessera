import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import type { RunTrace } from "../trace.js";
import { prepareRunExport } from "./export.js";
import type { ConversationSummary, TranscriptEntry, TranscriptStore } from "./store.js";
import { recentMessages } from "./store.js";

/**
 * IndexedDB name for project-local transcripts (`06` §13).
 *
 * @public
 */
export const TRANSCRIPT_DB_NAME = "tessera-transcripts" as const;

const DB_VERSION = 1;
const ENTRY_STORE = "entries";
const TRACE_STORE = "traces";
const CONV_INDEX = "conversationId";

/**
 * Browser {@link TranscriptStore}. Never synced.
 *
 * @example
 * ```ts
 * await createIndexedDbTranscriptStore();
 * ```
 *
 * @public
 */
export async function createIndexedDbTranscriptStore(
  factory?: IDBFactory,
): Promise<Result<TranscriptStore, TesseraError>> {
  const indexedDb = factory ?? (typeof indexedDB === "undefined" ? undefined : indexedDB);
  if (indexedDb === undefined) {
    return err(tesseraError("UNSUPPORTED", "IndexedDB is not available"));
  }
  const opened = await openDb(indexedDb);
  if (!opened.ok) {
    return opened;
  }
  const db = opened.value;
  return ok({
    async append(_conversationId, next) {
      void _conversationId;
      for (const entry of next) {
        const write = await putRecord(db, ENTRY_STORE, entry);
        if (!write.ok) {
          return write;
        }
      }
      return ok(undefined);
    },
    async recent(conversationId, tokenBudget) {
      const listed = await getAllEntries(db);
      if (!listed.ok) {
        return listed;
      }
      const scoped = listed.value.filter((entry) => entry.conversationId === conversationId);
      return ok(recentMessages(scoped, tokenBudget));
    },
    async listConversations(projectId) {
      const listed = await getAllEntries(db);
      if (!listed.ok) {
        return listed;
      }
      const latest = new Map<string, ConversationSummary>();
      for (const entry of listed.value) {
        if (entry.projectId !== projectId) {
          continue;
        }
        latest.set(entry.conversationId, {
          conversationId: entry.conversationId,
          projectId: entry.projectId,
          updatedAt: entry.createdAt,
        });
      }
      return ok([...latest.values()]);
    },
    async recordTrace(trace) {
      return putRecord(db, TRACE_STORE, trace);
    },
    async exportRun(runId, options) {
      const trace = await getTrace(db, runId);
      if (!trace.ok) {
        return trace;
      }
      return prepareRunExport(trace.value, options?.includeAttachments === true);
    },
  });
}

function openDb(factory: IDBFactory): Promise<Result<IDBDatabase, TesseraError>> {
  return new Promise((resolve) => {
    const request = factory.open(TRANSCRIPT_DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ENTRY_STORE)) {
        const store = db.createObjectStore(ENTRY_STORE, { keyPath: "id" });
        store.createIndex(CONV_INDEX, "conversationId", { unique: false });
      }
      if (!db.objectStoreNames.contains(TRACE_STORE)) {
        db.createObjectStore(TRACE_STORE, { keyPath: "runId" });
      }
    };
    request.onsuccess = () => {
      resolve(ok(request.result));
    };
    request.onerror = () => {
      resolve(err(tesseraError("IO_ERROR", "failed to open transcript database")));
    };
  });
}

function putRecord(
  db: IDBDatabase,
  storeName: string,
  value: TranscriptEntry | RunTrace,
): Promise<Result<void, TesseraError>> {
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, "readwrite");
    const request = tx.objectStore(storeName).put(value);
    request.onsuccess = () => {
      resolve(ok(undefined));
    };
    request.onerror = () => {
      resolve(err(tesseraError("IO_ERROR", "failed to write transcript record")));
    };
  });
}

function getAllEntries(db: IDBDatabase): Promise<Result<readonly TranscriptEntry[], TesseraError>> {
  return new Promise((resolve) => {
    const tx = db.transaction(ENTRY_STORE, "readonly");
    const request = tx.objectStore(ENTRY_STORE).getAll();
    request.onsuccess = () => {
      resolve(ok(request.result));
    };
    request.onerror = () => {
      resolve(err(tesseraError("IO_ERROR", "failed to read transcript entries")));
    };
  });
}

function getTrace(
  db: IDBDatabase,
  runId: string,
): Promise<Result<RunTrace | undefined, TesseraError>> {
  return new Promise((resolve) => {
    const tx = db.transaction(TRACE_STORE, "readonly");
    const request = tx.objectStore(TRACE_STORE).get(runId);
    request.onsuccess = () => {
      resolve(ok(request.result));
    };
    request.onerror = () => {
      resolve(err(tesseraError("IO_ERROR", "failed to read run trace")));
    };
  });
}
