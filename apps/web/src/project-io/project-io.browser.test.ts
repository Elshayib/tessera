import "fake-indexeddb/auto";
import { fromYDoc } from "@tessera/core";
import { canonicalize } from "@tessera/schema";
import { isOk } from "@tessera/std";
import { createIndexedDbProjectStore, MemoryBlobStore } from "@tessera/storage";
import { expect, test } from "vitest";
import { bootstrap } from "../bootstrap.js";
import { comparableDocument, loadProjectSnapshot, persistLiveDocument } from "./project-io.js";

const author = { kind: "user" as const, id: "tester" };

test("save/load round-trip", async () => {
  const storage = await createIndexedDbProjectStore({
    database: "tessera-projects-t0118",
  });
  const blobs = new MemoryBlobStore();
  const ctx = bootstrap({ storage });
  const created = ctx.commands.execute("entity.create", { name: "Roundtrip" }, { author });
  expect(isOk(created)).toBe(true);
  const live = fromYDoc(ctx.document.ydoc);
  const persisted = await persistLiveDocument({
    storage,
    snapshot: live,
    blobs,
    createdAt: ctx.clock.nowIso(),
  });
  expect(isOk(persisted)).toBe(true);
  if (!persisted.ok) {
    return;
  }
  const loaded = await loadProjectSnapshot(storage, persisted.value.projectId);
  expect(isOk(loaded)).toBe(true);
  if (!loaded.ok) {
    return;
  }
  expect(canonicalize(comparableDocument(live))).toBe(
    canonicalize(comparableDocument(loaded.value.snapshot)),
  );
});
