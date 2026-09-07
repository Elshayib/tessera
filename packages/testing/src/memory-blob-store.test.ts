import { isErr, isOk } from "@tessera/std";
import { expect, test } from "vitest";
import { MemoryBlobStore } from "./index.js";

test("MemoryBlobStore write, read, dedupe, and delete", async () => {
  const store = new MemoryBlobStore();
  const bytes = new Uint8Array([1, 2, 3]);
  const first = await store.write(bytes, "application/octet-stream", "a.bin");
  expect(isOk(first)).toBe(true);
  if (!isOk(first)) {
    return;
  }
  expect(first.value.hash.startsWith("sha256-")).toBe(true);
  expect(await store.has(first.value.hash)).toBe(true);
  const again = await store.write(bytes, "application/octet-stream");
  expect(isOk(again) && again.value.hash === first.value.hash).toBe(true);
  const unnamed = await store.write(new Uint8Array([4, 5, 6]), "application/octet-stream");
  expect(isOk(unnamed) && unnamed.value.fileName === undefined).toBe(true);
  const listed = await store.list();
  expect(isOk(listed) && listed.value.length === 2).toBe(true);
  const usage = await store.usage();
  expect(isOk(usage) && usage.value.bytes === 6).toBe(true);
  const blob = await store.read(first.value.hash);
  expect(isOk(blob)).toBe(true);
  if (isOk(blob)) {
    expect(new Uint8Array(await blob.value.arrayBuffer())).toEqual(bytes);
  }
  const fromBlob = await store.write(
    new Blob([bytes], { type: "application/octet-stream" }),
    "application/octet-stream",
  );
  expect(isOk(fromBlob) && fromBlob.value.hash === first.value.hash).toBe(true);
  const removed = await store.delete(first.value.hash);
  expect(isOk(removed)).toBe(true);
  expect(await store.has(first.value.hash)).toBe(false);
  const missing = await store.read(first.value.hash);
  expect(isErr(missing) && missing.error.code === "NOT_FOUND").toBe(true);
});

test("MemoryBlobStore honours abort and missing delete", async () => {
  const store = new MemoryBlobStore();
  const signal = AbortSignal.abort();
  const cancelledWrite = await store.write(new Uint8Array([9]), "text/plain", "x.bin", signal);
  expect(isErr(cancelledWrite) && cancelledWrite.error.code === "CANCELLED").toBe(true);
  const cancelledRead = await store.read("sha256-missing", signal);
  expect(isErr(cancelledRead) && cancelledRead.error.code === "CANCELLED").toBe(true);
  const missing = await store.delete("sha256-missing");
  expect(isErr(missing) && missing.error.code === "NOT_FOUND").toBe(true);
  const empty = await store.list();
  expect(isOk(empty) && empty.value.length === 0).toBe(true);
});
