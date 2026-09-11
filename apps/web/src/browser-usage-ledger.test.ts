import "fake-indexeddb/auto";
import { afterEach, expect, test } from "vitest";
import { createBrowserUsageLedger } from "./browser-usage-ledger.js";

const DB_NAME = "tessera-transcripts";

const row = {
  runId: "r_a",
  conversationId: "c_1",
  projectId: "p_1",
  providerId: "openai",
  inputTokens: 10,
  outputTokens: 2,
  costUsd: 0.01,
};

afterEach(async () => {
  await Promise.race([
    new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => {
        resolve();
      };
      request.onblocked = () => {
        resolve();
      };
      request.onerror = () => {
        resolve();
      };
    }),
    new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    }),
  ]);
});

test("browser usage persists across façade instances", async () => {
  const first = createBrowserUsageLedger();
  first.record(row);
  await first.flushed();
  const second = createBrowserUsageLedger();
  await second.flushed();
  expect(second.forProject("p_1")).toEqual({
    inputTokens: 10,
    outputTokens: 2,
    costUsd: 0.01,
  });
});

test("browser usage falls back to memory when open fails", async () => {
  const store = createBrowserUsageLedger({
    open: async () => ({
      ok: false,
      error: { code: "UNSUPPORTED", message: "no indexeddb" },
    }),
  });
  store.record(row);
  await store.flushed();
  expect(store.forProject("p_1")).toEqual({
    inputTokens: 10,
    outputTokens: 2,
    costUsd: 0.01,
  });
});
