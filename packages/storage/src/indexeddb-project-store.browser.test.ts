import "fake-indexeddb/auto";
import type { Clock } from "@tessera/std";
import { isErr, isOk } from "@tessera/std";
import { expect, test } from "vitest";
import * as Y from "yjs";
import { createIndexedDbProjectStore, SNAPSHOT_DEBOUNCE_MS } from "./indexeddb-project-store.js";

class TestClock implements Clock {
  #nowMs = 1_700_000_000_000;

  now(): number {
    return this.#nowMs;
  }

  nowIso(): string {
    return new Date(this.#nowMs).toISOString();
  }

  advance(ms: number): void {
    this.#nowMs += ms;
  }
}

test("IndexedDbProjectStore list/create/open/close", async () => {
  const clock = new TestClock();
  const store = await createIndexedDbProjectStore({
    clock,
    database: "tessera-projects-open-close",
  });
  const created = await store.create({ name: "Camp" });
  expect(isOk(created)).toBe(true);
  if (!isOk(created)) {
    return;
  }
  const listed = await store.list();
  expect(isOk(listed) && listed.value.length === 1).toBe(true);
  if (!isOk(listed)) {
    return;
  }
  const summary = listed.value[0];
  expect(
    summary !== undefined &&
      summary.id === created.value &&
      summary.name === "Camp" &&
      summary.entityCount === 0,
  ).toBe(true);

  const opened = await store.open(created.value);
  expect(isOk(opened)).toBe(true);
  if (!isOk(opened)) {
    return;
  }
  expect(opened.value.ydoc instanceof Y.Doc).toBe(true);
  await opened.value.close();

  const missing = await store.open("p_zzzzzzzzzz");
  expect(isErr(missing) && missing.error.code === "NOT_FOUND").toBe(true);
});

test("5s snapshot uses FakeClock", async () => {
  const clock = new TestClock();
  const store = await createIndexedDbProjectStore({
    clock,
    database: "tessera-projects-debounce",
  });
  const created = await store.create({ name: "Debounced" });
  expect(isOk(created)).toBe(true);
  if (!isOk(created)) {
    return;
  }
  const opened = await store.open(created.value);
  expect(isOk(opened)).toBe(true);
  if (!isOk(opened)) {
    return;
  }
  const before = await store.list();
  expect(isOk(before)).toBe(true);
  if (!isOk(before)) {
    return;
  }
  const stampBefore = before.value[0]?.updatedAt;
  opened.value.ydoc.getMap("probe").set("n", 1);
  clock.advance(SNAPSHOT_DEBOUNCE_MS - 1);
  const mid = await store.list();
  expect(isOk(mid) && mid.value[0]?.updatedAt === stampBefore).toBe(true);
  clock.advance(1);
  const after = await store.list();
  expect(isOk(after) && after.value[0]?.updatedAt === clock.nowIso()).toBe(true);
  expect(SNAPSHOT_DEBOUNCE_MS).toBe(5000);
  await opened.value.close();
});

test("IndexedDbProjectStore duplicate delete templates archive", async () => {
  const clock = new TestClock();
  const store = await createIndexedDbProjectStore({
    clock,
    database: "tessera-projects-crud",
  });
  const created = await store.create({ name: "Camp", description: "site" }, "empty");
  expect(isOk(created)).toBe(true);
  if (!isOk(created)) {
    return;
  }
  const snapshot = await store.snapshot(created.value);
  expect(isOk(snapshot) && snapshot.value.meta.description === "site").toBe(true);

  const studio = await store.create({ name: "Studio" }, "studio");
  expect(isErr(studio) && studio.error.code === "UNSUPPORTED").toBe(true);
  const outdoor = await store.create({ name: "Out" }, "outdoor");
  expect(isErr(outdoor) && outdoor.error.code === "UNSUPPORTED").toBe(true);

  const copy = await store.duplicate(created.value, "Copy");
  expect(isOk(copy)).toBe(true);
  if (!isOk(copy)) {
    return;
  }
  const copySnap = await store.snapshot(copy.value);
  expect(isOk(copySnap) && copySnap.value.meta.name === "Copy").toBe(true);

  const exported = await store.exportArchive(created.value);
  expect(isOk(exported)).toBe(true);
  if (!isOk(exported)) {
    return;
  }
  const cancelledExport = await store.exportArchive(created.value, AbortSignal.abort());
  expect(isErr(cancelledExport) && cancelledExport.error.code === "CANCELLED").toBe(true);
  const cancelledImport = await store.importArchive(exported.value, AbortSignal.abort());
  expect(isErr(cancelledImport) && cancelledImport.error.code === "CANCELLED").toBe(true);
  const imported = await store.importArchive(exported.value);
  expect(isOk(imported) && imported.value !== created.value).toBe(true);

  const opened = await store.open(created.value);
  expect(isOk(opened)).toBe(true);
  if (!isOk(opened)) {
    return;
  }
  const again = await store.open(created.value);
  expect(isOk(again) && again.value.ydoc === opened.value.ydoc).toBe(true);
  await opened.value.close();
  await opened.value.close();

  const removed = await store.delete(created.value);
  expect(isOk(removed)).toBe(true);
  const gone = await store.snapshot(created.value);
  expect(isErr(gone) && gone.error.code === "NOT_FOUND").toBe(true);
  const missingDup = await store.duplicate("p_zzzzzzzzzz", "Nope");
  expect(isErr(missingDup) && missingDup.error.code === "NOT_FOUND").toBe(true);
  const missingDel = await store.delete("p_zzzzzzzzzz");
  expect(isErr(missingDel) && missingDel.error.code === "NOT_FOUND").toBe(true);
});
