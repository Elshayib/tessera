import { isErr, isOk } from "@tessera/std";
import { expect } from "vitest";
import type { BlobStore } from "./types.js";

/**
 * Shared BlobStore contract (`08` §2, `INV-AST-01`).
 *
 * @example
 * ```ts
 * await assertBlobStoreContract(new MemoryBlobStore());
 * ```
 */
export async function assertBlobStoreContract(store: BlobStore): Promise<void> {
  const bytes = new Uint8Array([1, 2, 3]);
  const first = await store.write(bytes, "application/octet-stream", "a.bin");
  expect(isOk(first)).toBe(true);
  if (!isOk(first)) {
    return;
  }
  expect(first.value.hash).toMatch(/^sha256-[0-9a-f]{64}$/);
  expect(await store.has(first.value.hash)).toBe(true);
  const again = await store.write(bytes, "application/octet-stream");
  expect(isOk(again) && again.value.hash === first.value.hash).toBe(true);
  const listed = await store.list();
  expect(isOk(listed) && listed.value.length === 1).toBe(true);
  const blob = await store.read(first.value.hash);
  expect(isOk(blob)).toBe(true);
  if (isOk(blob)) {
    expect(new Uint8Array(await blob.value.arrayBuffer())).toEqual(bytes);
  }
  const usage = await store.usage();
  expect(isOk(usage) && usage.value.bytes === 3).toBe(true);
  const removed = await store.delete(first.value.hash);
  expect(isOk(removed)).toBe(true);
  expect(await store.has(first.value.hash)).toBe(false);
  const missing = await store.read(first.value.hash);
  expect(isErr(missing) && missing.error.code === "NOT_FOUND").toBe(true);
}
