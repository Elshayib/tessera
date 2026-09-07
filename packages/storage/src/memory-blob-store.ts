import type { BlobRef } from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import { blobHash, cancelledResult, copyToArrayBuffer, sha256Hex, toBytes } from "./internal.js";
import type { BlobStore } from "./types.js";

/**
 * In-memory {@link BlobStore} (`08` §2). Satisfies `INV-AST-01`.
 *
 * @example
 * ```ts
 * const blobs = new MemoryBlobStore();
 * const written = await blobs.write(new Uint8Array([1, 2, 3]), "application/octet-stream");
 * ```
 *
 * @public
 */
export class MemoryBlobStore implements BlobStore {
  readonly #entries = new Map<string, { readonly ref: BlobRef; readonly bytes: ArrayBuffer }>();

  async has(hash: string): Promise<boolean> {
    return this.#entries.has(hash);
  }

  async read(hash: string, signal?: AbortSignal): Promise<Result<Blob, TesseraError>> {
    const cancelled = cancelledResult(signal);
    if (cancelled !== undefined) {
      return cancelled;
    }
    const entry = this.#entries.get(hash);
    if (entry === undefined) {
      return err(tesseraError("NOT_FOUND", "blob missing", { hash }));
    }
    return ok(new Blob([entry.bytes], { type: entry.ref.mime }));
  }

  async write(
    data: Blob | Uint8Array,
    mime: string,
    fileName?: string,
    signal?: AbortSignal,
  ): Promise<Result<BlobRef, TesseraError>> {
    const cancelled = cancelledResult(signal);
    if (cancelled !== undefined) {
      return cancelled;
    }
    const bytes = copyToArrayBuffer(await toBytes(data));
    const hash = blobHash(await sha256Hex(bytes));
    const existing = this.#entries.get(hash);
    if (existing !== undefined) {
      return ok(existing.ref);
    }
    const ref: BlobRef =
      fileName === undefined
        ? { hash, size: bytes.byteLength, mime }
        : { hash, size: bytes.byteLength, mime, fileName };
    this.#entries.set(hash, { ref, bytes });
    return ok(ref);
  }

  async delete(hash: string): Promise<Result<void, TesseraError>> {
    if (!this.#entries.delete(hash)) {
      return err(tesseraError("NOT_FOUND", "blob missing", { hash }));
    }
    return ok(undefined);
  }

  async list(): Promise<Result<readonly BlobRef[], TesseraError>> {
    return ok([...this.#entries.values()].map((entry) => entry.ref));
  }

  async usage(): Promise<Result<{ bytes: number; quotaBytes?: number }, TesseraError>> {
    let bytes = 0;
    for (const entry of this.#entries.values()) {
      bytes += entry.ref.size;
    }
    return ok({ bytes });
  }
}
