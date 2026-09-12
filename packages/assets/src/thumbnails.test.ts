import type { AssetId } from "@tessera/schema";
import { ok } from "@tessera/std";
import { MemoryBlobStore } from "@tessera/storage";
import { expect, test } from "vitest";
import { createThumbnailService, nullThumbnailService, thumbnailCacheKey } from "./thumbnails.js";

const ASSET: AssetId = "a_aaaaaaaaaa";

test("headless ThumbnailService.get returns null", async () => {
  const thumbs = nullThumbnailService();
  expect(await thumbs.get(ASSET)).toBeNull();
  const empty = createThumbnailService({ blobs: new MemoryBlobStore() });
  expect(await empty.get(ASSET)).toBeNull();
});

test("injected renderer caches derived:thumb:<assetId>:<hash>", async () => {
  const blobs = new MemoryBlobStore();
  let renders = 0;
  const thumbs = createThumbnailService({
    blobs,
    renderer: {
      sourceHash() {
        return "abc";
      },
      async render() {
        renders += 1;
        return ok(new Uint8Array([1, 2, 3]));
      },
    },
  });
  const first = await thumbs.get(ASSET);
  expect(first !== null).toBe(true);
  expect(thumbnailCacheKey(ASSET, "abc")).toBe("derived:thumb:a_aaaaaaaaaa:abc");
  const second = await thumbs.get(ASSET);
  expect(second).toEqual(first);
  expect(renders).toBe(1);
});

test("cache hit does not re-render", async () => {
  const blobs = new MemoryBlobStore();
  let renders = 0;
  const thumbs = createThumbnailService({
    blobs,
    renderer: {
      sourceHash() {
        return "h1";
      },
      async render() {
        renders += 1;
        return ok(new Uint8Array([9]));
      },
    },
  });
  await thumbs.get(ASSET);
  await thumbs.get(ASSET);
  expect(renders).toBe(1);
});
