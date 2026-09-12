import { MemoryBlobStore } from "@tessera/storage";
import { expect, test } from "vitest";
import { FakeAssetSource } from "./fake-asset-source.js";
import { FakeClock } from "./fake-clock.js";

test("FakeAssetSource search/fetch deterministic", async () => {
  const source = new FakeAssetSource({
    clock: new FakeClock(),
    items: [
      {
        id: "barrel",
        name: "Wooden Barrel",
        kind: "model",
        thumbnailUrl: "https://example.invalid/b.png",
        tags: ["prop"],
        license: "CC0-1.0",
        author: "Tessera",
      },
      {
        id: "forest",
        name: "Forest HDRI",
        kind: "hdri",
        thumbnailUrl: "https://example.invalid/f.png",
        tags: [],
        license: "CC0-1.0",
      },
    ],
  });
  const signal = new AbortController().signal;
  const page = await source.search({ text: "barrel", kind: "model" }, signal);
  expect(page.ok).toBe(true);
  if (!page.ok) {
    return;
  }
  expect(page.value.items).toHaveLength(1);
  expect(page.value.items[0]?.id).toBe("barrel");
  const item = page.value.items[0];
  if (item === undefined) {
    return;
  }
  const blobs = new MemoryBlobStore();
  const fetched = await source.fetch(item, { resolution: "1k" }, blobs, signal);
  expect(fetched.ok).toBe(true);
  if (!fetched.ok) {
    return;
  }
  expect(fetched.value.license).toBe("CC0-1.0");
  expect(fetched.value.provenance.sourceId).toBe("barrel");
  expect(fetched.value.blobs).toHaveLength(1);
});
