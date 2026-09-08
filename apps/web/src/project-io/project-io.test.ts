import { fromYDoc } from "@tessera/core";
import { canonicalize } from "@tessera/schema";
import { isOk } from "@tessera/std";
import { MemoryBlobStore, MemoryProjectStore } from "@tessera/storage";
import { describeError } from "@tessera/ui";
import { expect, test } from "vitest";
import { bootstrap } from "../bootstrap.js";
import { comparableDocument, exportLiveArchive, importProjectArchive } from "./project-io.js";

const author = { kind: "user" as const, id: "tester" };

test("export then import archive", async () => {
  const storage = new MemoryProjectStore();
  const blobs = new MemoryBlobStore();
  const ctx = bootstrap({ storage });
  const created = ctx.commands.execute("entity.create", { name: "Saved" }, { author });
  expect(isOk(created)).toBe(true);
  const live = fromYDoc(ctx.document.ydoc);
  const exported = await exportLiveArchive({
    snapshot: live,
    blobs,
    createdAt: ctx.clock.nowIso(),
  });
  expect(isOk(exported)).toBe(true);
  if (!exported.ok) {
    return;
  }
  expect(exported.value.type).toBe("application/zip");
  const imported = await importProjectArchive(storage, exported.value);
  expect(isOk(imported)).toBe(true);
  if (!imported.ok) {
    return;
  }
  expect(canonicalize(comparableDocument(live))).toBe(
    canonicalize(comparableDocument(imported.value.snapshot)),
  );
});

test("import failure uses describeError", async () => {
  const storage = new MemoryProjectStore();
  const imported = await importProjectArchive(
    storage,
    new Blob([new Uint8Array([1])], { type: "application/zip" }),
  );
  expect(imported.ok).toBe(false);
  if (imported.ok) {
    return;
  }
  const described = describeError(imported.error);
  expect(described.key.startsWith("errors.")).toBe(true);
  expect(described.text.length).toBeGreaterThan(0);
});
