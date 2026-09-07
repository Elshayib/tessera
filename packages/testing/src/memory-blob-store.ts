import type { BlobRef } from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import { abortError, err, ok, tesseraError } from "@tessera/std";

/**
 * In-memory blob store from `docs/08-assets-and-storage.md` §2.
 *
 * Duplicated here until `@tessera/storage` exists (T-0101).
 */
interface BlobStore {
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
 * In-memory {@link BlobStore} for tests.
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
    const hash = `sha256-${await sha256Hex(bytes)}`;
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

function cancelledResult(signal: AbortSignal | undefined): Result<never, TesseraError> | undefined {
  if (signal?.aborted === true) {
    return err(abortError());
  }
  return undefined;
}

async function toBytes(data: Blob | Uint8Array): Promise<Uint8Array> {
  if (data instanceof Uint8Array) {
    return data;
  }
  return new Uint8Array(await data.arrayBuffer());
}

function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const view = new Uint8Array(digest);
  let hex = "";
  for (const byte of view) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}
