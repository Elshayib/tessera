import type { BlobRef, Document, ProjectId } from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import type * as Y from "yjs";

/**
 * Content-addressed blob persistence (`08` §2).
 *
 * @public
 */
export interface BlobStore {
  has(hash: string): Promise<boolean>;
  read(hash: string, signal?: AbortSignal): Promise<Result<Blob, TesseraError>>;
  write(
    data: Blob | Uint8Array,
    mime: string,
    fileName?: string,
    signal?: AbortSignal,
  ): Promise<Result<BlobRef, TesseraError>>;
  delete(hash: string): Promise<Result<void, TesseraError>>;
  list(): Promise<Result<readonly BlobRef[], TesseraError>>;
  usage(): Promise<Result<{ bytes: number; quotaBytes?: number }, TesseraError>>;
}

/**
 * Listing row for {@link ProjectStore.list}.
 *
 * @public
 */
export interface ProjectSummary {
  readonly id: ProjectId;
  readonly name: string;
  readonly updatedAt: string;
  readonly entityCount: number;
  readonly thumbnail?: BlobRef;
}

/**
 * An opened project with a live Yjs document (`08` §2).
 *
 * @public
 */
export interface OpenProject {
  readonly id: ProjectId;
  readonly ydoc: Y.Doc;
  readonly blobs: BlobStore;
  close(): Promise<void>;
}

/**
 * Project persistence (`08` §2).
 *
 * @public
 */
export interface ProjectStore {
  list(): Promise<Result<readonly ProjectSummary[], TesseraError>>;
  create(
    meta: { name: string; description?: string },
    template?: "empty" | "studio" | "outdoor",
  ): Promise<Result<ProjectId, TesseraError>>;
  open(id: ProjectId): Promise<Result<OpenProject, TesseraError>>;
  snapshot(id: ProjectId): Promise<Result<Document, TesseraError>>;
  exportArchive(id: ProjectId, signal?: AbortSignal): Promise<Result<Blob, TesseraError>>;
  importArchive(archive: Blob, signal?: AbortSignal): Promise<Result<ProjectId, TesseraError>>;
  duplicate(id: ProjectId, name: string): Promise<Result<ProjectId, TesseraError>>;
  delete(id: ProjectId): Promise<Result<void, TesseraError>>;
}

/**
 * Unzip size caps for `.tessera` archives (SEC-08). Snapshot budget is 50 MB (`03` §12).
 *
 * @public
 */
export interface ArchiveLimits {
  readonly maxEntryBytes: number;
  readonly maxTotalBytes: number;
}

/**
 * Default archive size limits: 50 MiB per entry and total.
 *
 * @public
 */
export const DEFAULT_ARCHIVE_LIMITS: ArchiveLimits = {
  maxEntryBytes: 50 * 1024 * 1024,
  maxTotalBytes: 50 * 1024 * 1024,
};
