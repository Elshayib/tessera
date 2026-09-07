import type { BlobRef } from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import { estimateQuota, idbRequest, openDatabase, persistStorage } from "./idb.js";
import { blobHash, cancelledResult, copyToArrayBuffer, sha256Hex, toBytes } from "./internal.js";
import type { BrowserBlobStore } from "./types.js";

const BLOBS_STORE = "blobs";

interface StoredBlob {
  readonly ref: BlobRef;
  readonly bytes: ArrayBuffer;
}

/**
 * IndexedDB {@link BrowserBlobStore} (`08` §2). Database default `tessera-blobs`.
 *
 * @example
 * ```ts
 * const blobs = await createIndexedDbBlobStore();
 * ```
 *
 * @public
 */
export class IndexedDbBlobStore implements BrowserBlobStore {
  readonly backend = "indexeddb" as const;
  readonly #db: IDBDatabase;
  #didPersist = false;

  private constructor(db: IDBDatabase) {
    this.#db = db;
  }

  static async open(options: { readonly database?: string } = {}): Promise<IndexedDbBlobStore> {
    const name = options.database ?? "tessera-blobs";
    const db = await openDatabase(name, 1, (opened) => {
      if (!opened.objectStoreNames.contains(BLOBS_STORE)) {
        opened.createObjectStore(BLOBS_STORE);
      }
    });
    return new IndexedDbBlobStore(db);
  }

  async has(hash: string): Promise<boolean> {
    const value = await idbRequest(this.#store("readonly").get(hash));
    return isStoredBlob(value);
  }

  async read(hash: string, signal?: AbortSignal): Promise<Result<Blob, TesseraError>> {
    const cancelled = cancelledResult(signal);
    if (cancelled !== undefined) {
      return cancelled;
    }
    const stored = await idbRequest(this.#store("readonly").get(hash));
    if (!isStoredBlob(stored)) {
      return err(tesseraError("NOT_FOUND", "blob missing", { hash }));
    }
    return ok(new Blob([stored.bytes], { type: stored.ref.mime }));
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
    await this.#persistOnce();
    const bytes = copyToArrayBuffer(await toBytes(data));
    const hash = blobHash(await sha256Hex(bytes));
    const existing = await idbRequest(this.#store("readonly").get(hash));
    if (isStoredBlob(existing)) {
      return ok(existing.ref);
    }
    const ref: BlobRef =
      fileName === undefined
        ? { hash, size: bytes.byteLength, mime }
        : { hash, size: bytes.byteLength, mime, fileName };
    await idbRequest(this.#store("readwrite").put({ ref, bytes }, hash));
    return ok(ref);
  }

  async delete(hash: string): Promise<Result<void, TesseraError>> {
    const existing = await idbRequest(this.#store("readonly").get(hash));
    if (!isStoredBlob(existing)) {
      return err(tesseraError("NOT_FOUND", "blob missing", { hash }));
    }
    await idbRequest(this.#store("readwrite").delete(hash));
    return ok(undefined);
  }

  async list(): Promise<Result<readonly BlobRef[], TesseraError>> {
    const rows = await idbRequest(this.#store("readonly").getAll());
    const refs: BlobRef[] = [];
    for (const row of rows) {
      if (isStoredBlob(row)) {
        refs.push(row.ref);
      }
    }
    return ok(refs);
  }

  async usage(): Promise<Result<{ bytes: number; quotaBytes?: number }, TesseraError>> {
    const listed = await this.list();
    if (!listed.ok) {
      return listed;
    }
    let bytes = 0;
    for (const ref of listed.value) {
      bytes += ref.size;
    }
    const quotaBytes = await estimateQuota();
    if (quotaBytes === undefined) {
      return ok({ bytes });
    }
    return ok({ bytes, quotaBytes });
  }

  #store(mode: IDBTransactionMode): IDBObjectStore {
    return this.#db.transaction(BLOBS_STORE, mode).objectStore(BLOBS_STORE);
  }

  async #persistOnce(): Promise<void> {
    if (this.#didPersist) {
      return;
    }
    this.#didPersist = true;
    await persistStorage();
  }
}

/**
 * Opens {@link IndexedDbBlobStore}.
 *
 * @example
 * ```ts
 * const store = await createIndexedDbBlobStore({ database: "tessera-blobs" });
 * ```
 *
 * @public
 */
export async function createIndexedDbBlobStore(
  options: { readonly database?: string } = {},
): Promise<IndexedDbBlobStore> {
  return IndexedDbBlobStore.open(options);
}

function isStoredBlob(value: unknown): value is StoredBlob {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return "ref" in value && "bytes" in value;
}
