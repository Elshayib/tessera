import { canonicalize } from "@tessera/schema";
import type { Clock } from "@tessera/std";
import { isErr, isOk } from "@tessera/std";
import { strToU8, zipSync } from "fflate";
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

function zipBytes(entries: Record<string, string | Uint8Array>): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  for (const [name, body] of Object.entries(entries)) {
    files[name] = typeof body === "string" ? strToU8(body) : body;
  }
  return zipSync(files);
}

test("exportArchive then importArchive restores snapshot", async () => {
  const blobs = new MemoryBlobStore();
  const store = new MemoryProjectStore({
    clock: frozenClock("2026-09-07T12:00:00.000Z"),
    blobs,
  });
  const created = await store.create({ name: "Packed" });
  expect(isOk(created)).toBe(true);
  if (!isOk(created)) {
    return;
  }
  const payload = new Uint8Array([7, 8, 9]);
  const written = await blobs.write(payload, "application/octet-stream", "mesh.bin");
  expect(isOk(written)).toBe(true);

  const exported = await store.exportArchive(created.value);
  expect(isOk(exported)).toBe(true);
  if (!isOk(exported)) {
    return;
  }
  expect(exported.value.type).toBe("application/zip");

  const before = await store.snapshot(created.value);
  expect(isOk(before)).toBe(true);
  if (!isOk(before)) {
    return;
  }

  const imported = await store.importArchive(exported.value);
  expect(isOk(imported)).toBe(true);
  if (!isOk(imported)) {
    return;
  }
  expect(imported.value !== created.value).toBe(true);
  const after = await store.snapshot(imported.value);
  expect(isOk(after)).toBe(true);
  if (!isOk(after)) {
    return;
  }
  expect(after.value.meta.name).toBe("Packed");
  expect(
    canonicalize({ ...before.value, meta: { ...before.value.meta, id: "p_aaaaaaaaaa" } }),
  ).toBe(canonicalize({ ...after.value, meta: { ...after.value.meta, id: "p_aaaaaaaaaa" } }));
  if (!isOk(written)) {
    return;
  }
  expect(await blobs.has(written.value.hash)).toBe(true);
});

test("malformed zip is I/O or INVALID_INPUT", async () => {
  const store = new MemoryProjectStore({
    clock: frozenClock("2026-09-07T12:00:00.000Z"),
    blobs: new MemoryBlobStore(),
  });
  const notZip = await store.importArchive(
    new Blob([new Uint8Array([1, 2, 3])], { type: "application/zip" }),
  );
  expect(
    isErr(notZip) && (notZip.error.code === "INVALID_INPUT" || notZip.error.code === "IO_ERROR"),
  ).toBe(true);

  const missingProject = zipBytes({
    "manifest.json": JSON.stringify({
      format: "tessera-archive",
      version: 1,
      documentVersion: "0.1.0",
      createdAt: "2026-09-07T12:00:00.000Z",
      generator: "tessera@0.0.0",
    }),
  });
  const missing = await store.importArchive(
    new Blob([missingProject], { type: "application/zip" }),
  );
  expect(isErr(missing) && missing.error.code === "INVALID_INPUT").toBe(true);
});

test("SEC-08 rejects zip-slip and oversized entries", async () => {
  const store = new MemoryProjectStore({
    clock: frozenClock("2026-09-07T12:00:00.000Z"),
    blobs: new MemoryBlobStore(),
    archiveLimits: { maxEntryBytes: 16, maxTotalBytes: 32 },
  });
  const slip = zipBytes({
    "../secret.txt": "nope",
    "project.tessera.json": "{}",
    "manifest.json": JSON.stringify({
      format: "tessera-archive",
      version: 1,
      documentVersion: "0.1.0",
      createdAt: "2026-09-07T12:00:00.000Z",
      generator: "tessera@0.0.0",
    }),
  });
  const slipped = await store.importArchive(new Blob([slip], { type: "application/zip" }));
  expect(isErr(slipped) && slipped.error.code === "INVALID_INPUT").toBe(true);

  const huge = zipBytes({
    "project.tessera.json": "x".repeat(20),
    "manifest.json": JSON.stringify({
      format: "tessera-archive",
      version: 1,
      documentVersion: "0.1.0",
      createdAt: "2026-09-07T12:00:00.000Z",
      generator: "tessera@0.0.0",
    }),
  });
  const oversized = await store.importArchive(new Blob([huge], { type: "application/zip" }));
  expect(isErr(oversized) && oversized.error.code === "INVALID_INPUT").toBe(true);
});
