import "fake-indexeddb/auto";
import { isErr, isOk } from "@tessera/std";
import { expect, test } from "vitest";
import { assertBlobStoreContract } from "./contract.js";
import { createIndexedDbBlobStore } from "./indexeddb-blob-store.js";
import { createOpfsBlobStore } from "./opfs-blob-store.js";

test("INV-AST-01 OPFS or IDB blobs", async () => {
  const idb = await createIndexedDbBlobStore({ database: "tessera-blobs-contract-idb" });
  await assertBlobStoreContract(idb);
  const opfsOrIdb = await createOpfsBlobStore({ fallbackDatabase: "tessera-blobs-contract-opfs" });
  await assertBlobStoreContract(opfsOrIdb);
  expect(opfsOrIdb.backend === "opfs" || opfsOrIdb.backend === "indexeddb").toBe(true);
  expect(opfsOrIdb.backend).toBe("indexeddb");
});

test("usage estimate and persist on first write", async () => {
  const persistCalls = { count: 0 };
  installNavigator({
    persistCalls,
    quotaBytes: 5000,
  });
  const idb = await createIndexedDbBlobStore({ database: "tessera-blobs-quota" });
  const written = await idb.write(new Uint8Array([1, 2, 3]), "application/octet-stream");
  expect(isOk(written)).toBe(true);
  expect(persistCalls.count).toBe(1);
  const usage = await idb.usage();
  expect(isOk(usage) && usage.value.bytes === 3 && usage.value.quotaBytes === 5000).toBe(true);
  const cancelled = await idb.write(
    new Uint8Array([4]),
    "application/octet-stream",
    undefined,
    AbortSignal.abort(),
  );
  expect(isErr(cancelled) && cancelled.error.code === "CANCELLED").toBe(true);
});

test("OPFS unavailable when getDirectory throws", async () => {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      storage: {
        persist: async () => false,
        estimate: async () => ({ quota: 1, usage: 0 }),
        getDirectory: async () => {
          throw new Error("opfs missing");
        },
      },
    },
  });
  const fallback = await createOpfsBlobStore({ fallbackDatabase: "tessera-blobs-opfs-throw" });
  expect(fallback.backend).toBe("indexeddb");
});

test("INV-AST-01 OPFS when getDirectory is present", async () => {
  const persistCalls = { count: 0 };
  installNavigator({
    persistCalls,
    quotaBytes: 8000,
    root: new MemoryDirectory(),
  });
  const opfs = await createOpfsBlobStore({ fallbackDatabase: "tessera-blobs-unused-fallback" });
  expect(opfs.backend).toBe("opfs");
  await assertBlobStoreContract(opfs);
  expect(persistCalls.count).toBe(1);
  const usage = await opfs.usage();
  expect(isOk(usage) && usage.value.quotaBytes === 8000).toBe(true);
});

function installNavigator(options: {
  readonly persistCalls: { count: number };
  readonly quotaBytes: number;
  readonly root?: MemoryDirectory;
}): void {
  const storage: Record<string, unknown> = {
    persist: async () => {
      options.persistCalls.count += 1;
      return true;
    },
    estimate: async () => ({ quota: options.quotaBytes, usage: 0 }),
  };
  if (options.root !== undefined) {
    storage["getDirectory"] = async () => options.root;
  }
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { storage },
  });
}

class MemoryFile {
  bytes = new Uint8Array(0);

  async getFile(): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; text(): Promise<string> }> {
    const copy = new ArrayBuffer(this.bytes.byteLength);
    new Uint8Array(copy).set(this.bytes);
    const snapshot = this.bytes;
    return {
      arrayBuffer: async () => copy,
      text: async () => new TextDecoder().decode(snapshot),
    };
  }

  async createWritable(): Promise<{
    write: (data: BufferSource | Blob | string) => Promise<void>;
    close: () => Promise<void>;
  }> {
    const file = this;
    return {
      async write(data) {
        if (typeof data === "string") {
          file.bytes = new TextEncoder().encode(data);
          return;
        }
        if (data instanceof Blob) {
          file.bytes = new Uint8Array(await data.arrayBuffer());
          return;
        }
        if (data instanceof ArrayBuffer) {
          file.bytes = new Uint8Array(data);
          return;
        }
        file.bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      },
      async close() {
        return;
      },
    };
  }
}

class MemoryDirectory {
  readonly files = new Map<string, MemoryFile>();
  readonly dirs = new Map<string, MemoryDirectory>();

  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<MemoryDirectory> {
    const existing = this.dirs.get(name);
    if (existing !== undefined) {
      return existing;
    }
    if (options?.create === true) {
      const created = new MemoryDirectory();
      this.dirs.set(name, created);
      return created;
    }
    throw new Error("missing directory");
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<MemoryFile> {
    const existing = this.files.get(name);
    if (existing !== undefined) {
      return existing;
    }
    if (options?.create === true) {
      const created = new MemoryFile();
      this.files.set(name, created);
      return created;
    }
    throw new Error("missing file");
  }

  async removeEntry(name: string): Promise<void> {
    this.files.delete(name);
    this.dirs.delete(name);
  }
}
