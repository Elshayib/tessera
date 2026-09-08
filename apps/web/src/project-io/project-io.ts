import type { DocumentHandle } from "@tessera/core";
import { fromYDoc } from "@tessera/core";
import type { Document, ProjectId } from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import { ok } from "@tessera/std";
import type { BlobStore, ProjectStore } from "@tessera/storage";
import { encodeTesseraArchive } from "@tessera/storage";

const COMPARE_PROJECT_ID = "p_aaaaaaaaaa";
const COMPARE_UPDATED_AT = "1970-01-01T00:00:00.000Z";

/**
 * Strips project id and updatedAt so save/load can be compared (`INV-DOC-08`).
 *
 * @public
 */
export function comparableDocument(document: Document): Document {
  return {
    ...document,
    meta: {
      ...document.meta,
      id: COMPARE_PROJECT_ID,
      updatedAt: COMPARE_UPDATED_AT,
    },
  };
}

/**
 * Packs the live document into a `.tessera` ZIP (`03` §10).
 *
 * @example
 * ```ts
 * const zip = await exportLiveArchive({ snapshot, blobs, createdAt });
 * ```
 *
 * @public
 */
export async function exportLiveArchive(options: {
  readonly snapshot: Document;
  readonly blobs: BlobStore;
  readonly createdAt: string;
  readonly signal?: AbortSignal;
}): Promise<Result<Blob, TesseraError>> {
  return encodeTesseraArchive(options.snapshot, options.blobs, options.createdAt, options.signal);
}

/**
 * Opens a `.tessera` ZIP through {@link ProjectStore.importArchive}.
 *
 * @public
 */
export async function importProjectArchive(
  storage: ProjectStore,
  archive: Blob,
  signal?: AbortSignal,
): Promise<Result<{ readonly projectId: ProjectId; readonly snapshot: Document }, TesseraError>> {
  const imported = await storage.importArchive(archive, signal);
  if (!imported.ok) {
    return imported;
  }
  const snapshot = await storage.snapshot(imported.value);
  if (!snapshot.ok) {
    return snapshot;
  }
  return ok({ projectId: imported.value, snapshot: snapshot.value });
}

/**
 * Writes the live snapshot by encoding an archive and importing it (Q-0071).
 *
 * @public
 */
export async function persistLiveDocument(options: {
  readonly storage: ProjectStore;
  readonly snapshot: Document;
  readonly blobs: BlobStore;
  readonly createdAt: string;
  readonly signal?: AbortSignal;
}): Promise<Result<{ readonly projectId: ProjectId; readonly snapshot: Document }, TesseraError>> {
  const exported = await exportLiveArchive(options);
  if (!exported.ok) {
    return exported;
  }
  return importProjectArchive(options.storage, exported.value, options.signal);
}

/**
 * Reloads a persisted project snapshot.
 *
 * @public
 */
export async function loadProjectSnapshot(
  storage: ProjectStore,
  projectId: ProjectId,
): Promise<Result<{ readonly snapshot: Document }, TesseraError>> {
  const snapshot = await storage.snapshot(projectId);
  if (!snapshot.ok) {
    return snapshot;
  }
  return ok({ snapshot: snapshot.value });
}

/**
 * Canonical snapshot of a live editor document.
 *
 * @public
 */
export function liveSnapshot(document: DocumentHandle): Document {
  return fromYDoc(document.ydoc);
}
