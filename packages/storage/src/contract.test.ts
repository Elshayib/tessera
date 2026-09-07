import "fake-indexeddb/auto";
import { test } from "vitest";
import { assertBlobStoreContract } from "./contract.js";
import { createIndexedDbBlobStore } from "./indexeddb-blob-store.js";
import { MemoryBlobStore } from "./memory-blob-store.js";

test("contract suite Memory vs browser", async () => {
  await assertBlobStoreContract(new MemoryBlobStore());
  const idb = await createIndexedDbBlobStore({ database: "tessera-blobs-contract-suite" });
  await assertBlobStoreContract(idb);
});
