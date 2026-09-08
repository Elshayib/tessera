import { canonicalize, emptyDocument } from "@tessera/schema";
import type { Clock } from "@tessera/std";
import { isErr, isOk } from "@tessera/std";
import { expect, test } from "vitest";
import { MemoryBlobStore } from "./memory-blob-store.js";
import { MemoryProjectStore } from "./memory-project-store.js";

function frozenClock(iso: string): Clock {
  return {
    now() {
      return Date.parse(iso);
    },
    nowIso() {
      return iso;
    },
  };
}

test("memory project store create/open/snapshot", async () => {
  const clock = frozenClock("2026-09-07T12:00:00.000Z");
  const store = new MemoryProjectStore({ clock, blobs: new MemoryBlobStore() });
  const created = await store.create({ name: "Camp", description: "test" });
  expect(isOk(created)).toBe(true);
  if (!isOk(created)) {
    return;
  }
  expect(created.value.startsWith("p_")).toBe(true);

  const listed = await store.list();
  expect(isOk(listed) && listed.value.length === 1).toBe(true);
  if (!isOk(listed)) {
    return;
  }
  const summary = listed.value[0];
  expect(summary !== undefined && summary.name === "Camp" && summary.entityCount === 0).toBe(true);

  const opened = await store.open(created.value);
  expect(isOk(opened)).toBe(true);
  if (!isOk(opened)) {
    return;
  }
  expect(opened.value.id).toBe(created.value);
  await opened.value.close();

  const snapshot = await store.snapshot(created.value);
  expect(isOk(snapshot)).toBe(true);
  if (!isOk(snapshot)) {
    return;
  }
  expect(snapshot.value.meta.name).toBe("Camp");
  expect(snapshot.value.meta.description).toBe("test");
  expect(snapshot.value.meta.id).toBe(created.value);
  expect(snapshot.value.version).toBe(emptyDocument().version);

  const studio = await store.create({ name: "Studio" }, "studio");
  expect(isErr(studio) && studio.error.code === "UNSUPPORTED").toBe(true);
  const outdoor = await store.create({ name: "Out" }, "outdoor");
  expect(isErr(outdoor) && outdoor.error.code === "UNSUPPORTED").toBe(true);

  const missing = await store.open("p_zzzzzzzzzz");
  expect(isErr(missing) && missing.error.code === "NOT_FOUND").toBe(true);
});

test("duplicate and delete", async () => {
  const store = new MemoryProjectStore({
    clock: frozenClock("2026-09-07T12:00:00.000Z"),
    blobs: new MemoryBlobStore(),
  });
  const created = await store.create({ name: "A" });
  expect(isOk(created)).toBe(true);
  if (!isOk(created)) {
    return;
  }
  const copy = await store.duplicate(created.value, "B");
  expect(isOk(copy)).toBe(true);
  if (!isOk(copy)) {
    return;
  }
  expect(copy.value !== created.value).toBe(true);
  const snapA = await store.snapshot(created.value);
  const snapB = await store.snapshot(copy.value);
  expect(isOk(snapA) && isOk(snapB)).toBe(true);
  if (!isOk(snapA) || !isOk(snapB)) {
    return;
  }
  expect(snapB.value.meta.name).toBe("B");
  expect(canonicalize({ ...snapA.value, meta: { ...snapA.value.meta, id: "x", name: "n" } })).toBe(
    canonicalize({ ...snapB.value, meta: { ...snapB.value.meta, id: "x", name: "n" } }),
  );
  const removed = await store.delete(created.value);
  expect(isOk(removed)).toBe(true);
  const gone = await store.snapshot(created.value);
  expect(isErr(gone) && gone.error.code === "NOT_FOUND").toBe(true);
});
