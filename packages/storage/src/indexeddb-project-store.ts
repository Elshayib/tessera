import type { Document, ProjectId } from "@tessera/schema";
import { DocumentSchema, emptyDocument } from "@tessera/schema";
import type { Clock, Result, TesseraError } from "@tessera/std";
import { err, newId, ok, systemClock, tesseraError } from "@tessera/std";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { decodeTesseraArchive, encodeTesseraArchive } from "./archive.js";
import { deleteDatabase, idbRequest, openDatabase } from "./idb.js";
import { createIndexedDbBlobStore } from "./indexeddb-blob-store.js";
import { cancelledResult } from "./internal.js";
import type {
  ArchiveLimits,
  BlobStore,
  OpenProject,
  ProjectStore,
  ProjectSummary,
} from "./types.js";
import { DEFAULT_ARCHIVE_LIMITS } from "./types.js";

const PROJECTS_STORE = "projects";

/**
 * Debounce before writing a listing snapshot after Yjs updates (`08` §4).
 *
 * @example
 * ```ts
 * clock.advance(SNAPSHOT_DEBOUNCE_MS);
 * ```
 *
 * @public
 */
export const SNAPSHOT_DEBOUNCE_MS = 5000;

interface ProjectRow {
  readonly id: ProjectId;
  readonly snapshot: Document;
}

interface OpenedProject {
  readonly ydoc: Y.Doc;
  readonly persistence: IndexeddbPersistence;
  readonly onUpdate: () => void;
}

/**
 * Browser {@link ProjectStore} using `y-indexeddb` (`08` §2).
 *
 * Listing uses a canonical JSON snapshot in `tessera-projects`. Live Yjs updates persist via
 * `y-indexeddb`; after {@link SNAPSHOT_DEBOUNCE_MS} the listing `updatedAt` is refreshed
 * (Q-0035 — storage cannot import `@tessera/core` to map the Y.Doc).
 *
 * @example
 * ```ts
 * const store = await createIndexedDbProjectStore();
 * const id = await store.create({ name: "Demo" });
 * ```
 *
 * @public
 */
export class IndexedDbProjectStore implements ProjectStore {
  readonly #clock: Clock;
  readonly #blobs: BlobStore;
  readonly #limits: ArchiveLimits;
  readonly #db: IDBDatabase;
  readonly #dirtyAt = new Map<string, number>();
  readonly #opened = new Map<string, OpenedProject>();

  private constructor(db: IDBDatabase, clock: Clock, blobs: BlobStore, limits: ArchiveLimits) {
    this.#db = db;
    this.#clock = clock;
    this.#blobs = blobs;
    this.#limits = limits;
  }

  static async connect(
    options: {
      readonly clock?: Clock;
      readonly database?: string;
      readonly blobs?: BlobStore;
      readonly archiveLimits?: ArchiveLimits;
    } = {},
  ): Promise<IndexedDbProjectStore> {
    const database = options.database ?? "tessera-projects";
    const db = await openDatabase(database, 1, (opened) => {
      if (!opened.objectStoreNames.contains(PROJECTS_STORE)) {
        opened.createObjectStore(PROJECTS_STORE);
      }
    });
    const blobs =
      options.blobs ?? (await createIndexedDbBlobStore({ database: `${database}-blobs` }));
    return new IndexedDbProjectStore(
      db,
      options.clock ?? systemClock,
      blobs,
      options.archiveLimits ?? DEFAULT_ARCHIVE_LIMITS,
    );
  }

  async list(): Promise<Result<readonly ProjectSummary[], TesseraError>> {
    await this.#flushDueSnapshots();
    const rows = await idbRequest(this.#store("readonly").getAll());
    const summaries: ProjectSummary[] = [];
    for (const row of rows) {
      const parsed = parseRow(row);
      if (parsed !== undefined) {
        summaries.push(toSummary(parsed.snapshot));
      }
    }
    return ok(summaries);
  }

  async create(
    meta: { name: string; description?: string },
    template?: "empty" | "studio" | "outdoor",
  ): Promise<Result<ProjectId, TesseraError>> {
    if (template !== undefined && template !== "empty") {
      return err(tesseraError("UNSUPPORTED", "project template is not implemented", { template }));
    }
    const id = newId("p");
    const now = this.#clock.nowIso();
    const base = emptyDocument(id);
    const snapshot: Document = {
      ...base,
      meta:
        meta.description === undefined
          ? { ...base.meta, name: meta.name, createdAt: now, updatedAt: now }
          : {
              ...base.meta,
              name: meta.name,
              description: meta.description,
              createdAt: now,
              updatedAt: now,
            },
    };
    await idbRequest(this.#store("readwrite").put({ id, snapshot }, id));
    return ok(id);
  }

  async open(id: ProjectId): Promise<Result<OpenProject, TesseraError>> {
    await this.#flushDueSnapshots();
    const row = parseRow(await idbRequest(this.#store("readonly").get(id)));
    if (row === undefined) {
      return err(tesseraError("NOT_FOUND", "project missing", { id }));
    }
    const existing = this.#opened.get(id);
    if (existing !== undefined) {
      return ok(this.#toOpenProject(id, existing));
    }
    const ydoc = new Y.Doc();
    const persistence = new IndexeddbPersistence(`tessera-project-${id}`, ydoc);
    await persistence.whenSynced;
    const onUpdate = (): void => {
      this.#dirtyAt.set(id, this.#clock.now());
    };
    ydoc.on("update", onUpdate);
    const opened: OpenedProject = { ydoc, persistence, onUpdate };
    this.#opened.set(id, opened);
    return ok(this.#toOpenProject(id, opened));
  }

  async snapshot(id: ProjectId): Promise<Result<Document, TesseraError>> {
    await this.#flushDueSnapshots();
    const row = parseRow(await idbRequest(this.#store("readonly").get(id)));
    if (row === undefined) {
      return err(tesseraError("NOT_FOUND", "project missing", { id }));
    }
    return ok(row.snapshot);
  }

  async exportArchive(id: ProjectId, signal?: AbortSignal): Promise<Result<Blob, TesseraError>> {
    const cancelled = cancelledResult(signal);
    if (cancelled !== undefined) {
      return cancelled;
    }
    const snap = await this.snapshot(id);
    if (!snap.ok) {
      return snap;
    }
    return encodeTesseraArchive(snap.value, this.#blobs, this.#clock.nowIso(), signal);
  }

  async importArchive(
    archive: Blob,
    signal?: AbortSignal,
  ): Promise<Result<ProjectId, TesseraError>> {
    const cancelled = cancelledResult(signal);
    if (cancelled !== undefined) {
      return cancelled;
    }
    const decoded = await decodeTesseraArchive(archive, this.#limits, signal);
    if (!decoded.ok) {
      return decoded;
    }
    for (const entry of decoded.value.blobs) {
      const fileName = entry.ref.fileName;
      const written =
        fileName === undefined
          ? await this.#blobs.write(entry.bytes, entry.ref.mime)
          : await this.#blobs.write(entry.bytes, entry.ref.mime, fileName, signal);
      if (!written.ok) {
        return written;
      }
    }
    const id = newId("p");
    const now = this.#clock.nowIso();
    const incoming = decoded.value.snapshot;
    const snapshot: Document = {
      ...incoming,
      meta: { ...incoming.meta, id, updatedAt: now },
    };
    await idbRequest(this.#store("readwrite").put({ id, snapshot }, id));
    return ok(id);
  }

  async duplicate(id: ProjectId, name: string): Promise<Result<ProjectId, TesseraError>> {
    const row = parseRow(await idbRequest(this.#store("readonly").get(id)));
    if (row === undefined) {
      return err(tesseraError("NOT_FOUND", "project missing", { id }));
    }
    const copyId = newId("p");
    const now = this.#clock.nowIso();
    const snapshot: Document = {
      ...row.snapshot,
      meta: { ...row.snapshot.meta, id: copyId, name, createdAt: now, updatedAt: now },
    };
    await idbRequest(this.#store("readwrite").put({ id: copyId, snapshot }, copyId));
    return ok(copyId);
  }

  async delete(id: ProjectId): Promise<Result<void, TesseraError>> {
    const row = parseRow(await idbRequest(this.#store("readonly").get(id)));
    if (row === undefined) {
      return err(tesseraError("NOT_FOUND", "project missing", { id }));
    }
    const opened = this.#opened.get(id);
    if (opened !== undefined) {
      await this.#closeOpened(id, opened);
    }
    await idbRequest(this.#store("readwrite").delete(id));
    await deleteDatabase(`tessera-project-${id}`);
    this.#dirtyAt.delete(id);
    return ok(undefined);
  }

  #store(mode: IDBTransactionMode): IDBObjectStore {
    return this.#db.transaction(PROJECTS_STORE, mode).objectStore(PROJECTS_STORE);
  }

  #toOpenProject(id: ProjectId, opened: OpenedProject): OpenProject {
    const blobs = this.#blobs;
    return {
      id,
      ydoc: opened.ydoc,
      blobs,
      close: async () => {
        await this.#flushDueSnapshots();
        await this.#closeOpened(id, opened);
      },
    };
  }

  async #closeOpened(id: string, opened: OpenedProject): Promise<void> {
    if (this.#opened.get(id) !== opened) {
      return;
    }
    opened.ydoc.off("update", opened.onUpdate);
    await opened.persistence.destroy();
    this.#opened.delete(id);
  }

  async #flushDueSnapshots(): Promise<void> {
    const now = this.#clock.now();
    for (const [id, dirtyAt] of [...this.#dirtyAt.entries()]) {
      if (now - dirtyAt < SNAPSHOT_DEBOUNCE_MS) {
        continue;
      }
      const row = parseRow(await idbRequest(this.#store("readonly").get(id)));
      if (row === undefined) {
        this.#dirtyAt.delete(id);
        continue;
      }
      const snapshot: Document = {
        ...row.snapshot,
        meta: { ...row.snapshot.meta, updatedAt: this.#clock.nowIso() },
      };
      await idbRequest(this.#store("readwrite").put({ id, snapshot }, id));
      this.#dirtyAt.delete(id);
    }
  }
}

/**
 * Opens {@link IndexedDbProjectStore}. Default database `tessera-projects`.
 *
 * @example
 * ```ts
 * const store = await createIndexedDbProjectStore({ database: "tessera-projects" });
 * ```
 *
 * @public
 */
export async function createIndexedDbProjectStore(
  options: {
    readonly clock?: Clock;
    readonly database?: string;
    readonly blobs?: BlobStore;
    readonly archiveLimits?: ArchiveLimits;
  } = {},
): Promise<IndexedDbProjectStore> {
  return IndexedDbProjectStore.connect(options);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRow(value: unknown): ProjectRow | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const parsed = DocumentSchema.safeParse(value["snapshot"]);
  if (!parsed.success) {
    return undefined;
  }
  return { id: parsed.data.meta.id, snapshot: parsed.data };
}

function toSummary(snapshot: Document): ProjectSummary {
  return {
    id: snapshot.meta.id,
    name: snapshot.meta.name,
    updatedAt: snapshot.meta.updatedAt,
    entityCount: Object.keys(snapshot.entities).length,
  };
}
