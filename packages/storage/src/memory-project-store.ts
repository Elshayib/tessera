import type { Document, ProjectId } from "@tessera/schema";
import { emptyDocument } from "@tessera/schema";
import type { Clock, Result, TesseraError } from "@tessera/std";
import { err, newId, ok, systemClock, tesseraError } from "@tessera/std";
import * as Y from "yjs";
import { decodeTesseraArchive, encodeTesseraArchive } from "./archive.js";
import { cancelledResult } from "./internal.js";
import { MemoryBlobStore } from "./memory-blob-store.js";
import type {
  ArchiveLimits,
  BlobStore,
  OpenProject,
  ProjectStore,
  ProjectSummary,
} from "./types.js";
import { DEFAULT_ARCHIVE_LIMITS } from "./types.js";

interface ProjectRecord {
  snapshot: Document;
  readonly ydoc: Y.Doc;
}

/**
 * Options for {@link MemoryProjectStore}.
 *
 * @public
 */
export interface MemoryProjectStoreOptions {
  readonly clock?: Clock;
  readonly blobs?: BlobStore;
  readonly archiveLimits?: ArchiveLimits;
}

/**
 * In-memory {@link ProjectStore}. Snapshot JSON is the source of truth; `ydoc` is an empty
 * `Y.Doc` until the host applies `@tessera/core` `toYDoc` (storage must not import core).
 *
 * @example
 * ```ts
 * const store = new MemoryProjectStore();
 * const id = await store.create({ name: "Demo" });
 * ```
 *
 * @public
 */
export class MemoryProjectStore implements ProjectStore {
  readonly #clock: Clock;
  readonly #blobs: BlobStore;
  readonly #limits: ArchiveLimits;
  readonly #projects = new Map<string, ProjectRecord>();

  constructor(options: MemoryProjectStoreOptions = {}) {
    this.#clock = options.clock ?? systemClock;
    this.#blobs = options.blobs ?? new MemoryBlobStore();
    this.#limits = options.archiveLimits ?? DEFAULT_ARCHIVE_LIMITS;
  }

  async list(): Promise<Result<readonly ProjectSummary[], TesseraError>> {
    const summaries: ProjectSummary[] = [];
    for (const record of this.#projects.values()) {
      summaries.push(toSummary(record.snapshot));
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
          ? {
              ...base.meta,
              name: meta.name,
              createdAt: now,
              updatedAt: now,
            }
          : {
              ...base.meta,
              name: meta.name,
              description: meta.description,
              createdAt: now,
              updatedAt: now,
            },
    };
    this.#projects.set(id, { snapshot, ydoc: new Y.Doc() });
    return ok(id);
  }

  async open(id: ProjectId): Promise<Result<OpenProject, TesseraError>> {
    const record = this.#projects.get(id);
    if (record === undefined) {
      return err(tesseraError("NOT_FOUND", "project missing", { id }));
    }
    const blobs = this.#blobs;
    return ok({
      id,
      ydoc: record.ydoc,
      blobs,
      async close() {
        return;
      },
    });
  }

  async snapshot(id: ProjectId): Promise<Result<Document, TesseraError>> {
    const record = this.#projects.get(id);
    if (record === undefined) {
      return err(tesseraError("NOT_FOUND", "project missing", { id }));
    }
    return ok(record.snapshot);
  }

  async exportArchive(id: ProjectId, signal?: AbortSignal): Promise<Result<Blob, TesseraError>> {
    const cancelled = cancelledResult(signal);
    if (cancelled !== undefined) {
      return cancelled;
    }
    const record = this.#projects.get(id);
    if (record === undefined) {
      return err(tesseraError("NOT_FOUND", "project missing", { id }));
    }
    return encodeTesseraArchive(record.snapshot, this.#blobs, this.#clock.nowIso(), signal);
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
      meta: {
        ...incoming.meta,
        id,
        updatedAt: now,
      },
    };
    this.#projects.set(id, { snapshot, ydoc: new Y.Doc() });
    return ok(id);
  }

  async duplicate(id: ProjectId, name: string): Promise<Result<ProjectId, TesseraError>> {
    const record = this.#projects.get(id);
    if (record === undefined) {
      return err(tesseraError("NOT_FOUND", "project missing", { id }));
    }
    const copyId = newId("p");
    const now = this.#clock.nowIso();
    const snapshot: Document = {
      ...record.snapshot,
      meta: {
        ...record.snapshot.meta,
        id: copyId,
        name,
        createdAt: now,
        updatedAt: now,
      },
    };
    this.#projects.set(copyId, { snapshot, ydoc: new Y.Doc() });
    return ok(copyId);
  }

  async delete(id: ProjectId): Promise<Result<void, TesseraError>> {
    if (!this.#projects.delete(id)) {
      return err(tesseraError("NOT_FOUND", "project missing", { id }));
    }
    return ok(undefined);
  }
}

function toSummary(snapshot: Document): ProjectSummary {
  return {
    id: snapshot.meta.id,
    name: snapshot.meta.name,
    updatedAt: snapshot.meta.updatedAt,
    entityCount: Object.keys(snapshot.entities).length,
  };
}
