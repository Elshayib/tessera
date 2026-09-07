import type { BlobRef } from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import { estimateQuota, persistStorage } from "./idb.js";
import { createIndexedDbBlobStore } from "./indexeddb-blob-store.js";
import { blobHash, cancelledResult, copyToArrayBuffer, sha256Hex, toBytes } from "./internal.js";
import type { BrowserBlobStore } from "./types.js";

const INDEX_FILE = "index.json";
const DATA_DIR = "data";

/**
 * OPFS {@link BlobStore} with IndexedDB fallback when OPFS is missing (`08` §2).
 *
 * @example
 * ```ts
 * const blobs = await createOpfsBlobStore();
 * ```
 *
 * @public
 */
export async function createOpfsBlobStore(
  options: { readonly fallbackDatabase?: string } = {},
): Promise<BrowserBlobStore> {
  const directory = await tryOpenOpfsRoot();
  if (directory !== undefined) {
    return new OpfsBlobStore(directory);
  }
  return createIndexedDbBlobStore({ database: options.fallbackDatabase ?? "tessera-blobs" });
}

class OpfsBlobStore implements BrowserBlobStore {
  readonly backend = "opfs" as const;
  readonly #root: FileSystemDirectoryHandle;
  #didPersist = false;

  constructor(root: FileSystemDirectoryHandle) {
    this.#root = root;
  }

  async has(hash: string): Promise<boolean> {
    const index = await this.#readIndex();
    return index[hash] !== undefined;
  }

  async read(hash: string, signal?: AbortSignal): Promise<Result<Blob, TesseraError>> {
    const cancelled = cancelledResult(signal);
    if (cancelled !== undefined) {
      return cancelled;
    }
    const index = await this.#readIndex();
    const ref = index[hash];
    if (ref === undefined) {
      return err(tesseraError("NOT_FOUND", "blob missing", { hash }));
    }
    const data = await this.#dataDir();
    try {
      const file = await data.getFileHandle(hash);
      const blob = await file.getFile();
      return ok(new Blob([await blob.arrayBuffer()], { type: ref.mime }));
    } catch {
      return err(tesseraError("NOT_FOUND", "blob missing", { hash }));
    }
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
    const index = await this.#readIndex();
    const existing = index[hash];
    if (existing !== undefined) {
      return ok(existing);
    }
    const ref: BlobRef =
      fileName === undefined
        ? { hash, size: bytes.byteLength, mime }
        : { hash, size: bytes.byteLength, mime, fileName };
    const dataDir = await this.#dataDir();
    const handle = await dataDir.getFileHandle(hash, { create: true });
    const writable = await handle.createWritable();
    await writable.write(bytes);
    await writable.close();
    index[hash] = ref;
    await this.#writeIndex(index);
    return ok(ref);
  }

  async delete(hash: string): Promise<Result<void, TesseraError>> {
    const index = await this.#readIndex();
    if (index[hash] === undefined) {
      return err(tesseraError("NOT_FOUND", "blob missing", { hash }));
    }
    const rest: Record<string, BlobRef> = {};
    for (const [key, value] of Object.entries(index)) {
      if (key !== hash) {
        rest[key] = value;
      }
    }
    await this.#writeIndex(rest);
    try {
      const data = await this.#dataDir();
      await data.removeEntry(hash);
    } catch {
      return err(tesseraError("NOT_FOUND", "blob missing", { hash }));
    }
    return ok(undefined);
  }

  async list(): Promise<Result<readonly BlobRef[], TesseraError>> {
    const index = await this.#readIndex();
    return ok(Object.values(index));
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

  async #dataDir(): Promise<FileSystemDirectoryHandle> {
    return this.#root.getDirectoryHandle(DATA_DIR, { create: true });
  }

  async #readIndex(): Promise<Record<string, BlobRef>> {
    try {
      const file = await this.#root.getFileHandle(INDEX_FILE);
      const text = await (await file.getFile()).text();
      const parsed: unknown = JSON.parse(text);
      if (!isRecord(parsed)) {
        return {};
      }
      const index: Record<string, BlobRef> = {};
      for (const [hash, entry] of Object.entries(parsed)) {
        const ref = parseBlobRef(entry);
        if (ref !== undefined) {
          index[hash] = ref;
        }
      }
      return index;
    } catch {
      return {};
    }
  }

  async #writeIndex(index: Record<string, BlobRef>): Promise<void> {
    const handle = await this.#root.getFileHandle(INDEX_FILE, { create: true });
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(index));
    await writable.close();
  }

  async #persistOnce(): Promise<void> {
    if (this.#didPersist) {
      return;
    }
    this.#didPersist = true;
    await persistStorage();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBlobRef(value: unknown): BlobRef | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const hash = value["hash"];
  const size = value["size"];
  const mime = value["mime"];
  const fileName = value["fileName"];
  if (typeof hash !== "string" || typeof size !== "number" || typeof mime !== "string") {
    return undefined;
  }
  if (typeof fileName === "string") {
    return { hash, size, mime, fileName };
  }
  return { hash, size, mime };
}

function isDirectoryHandle(value: object): value is FileSystemDirectoryHandle {
  return "getDirectoryHandle" in value && "getFileHandle" in value;
}

async function tryOpenOpfsRoot(): Promise<FileSystemDirectoryHandle | undefined> {
  const storage = globalThis.navigator?.storage;
  if (storage === undefined || !("getDirectory" in storage)) {
    return undefined;
  }
  const getDirectory = Reflect.get(storage, "getDirectory");
  if (typeof getDirectory !== "function") {
    return undefined;
  }
  try {
    const root: unknown = await Promise.resolve(Reflect.apply(getDirectory, storage, []));
    if (typeof root === "object" && root !== null && isDirectoryHandle(root)) {
      return root;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
