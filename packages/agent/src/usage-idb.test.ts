import "fake-indexeddb/auto";
import { expect, test } from "vitest";
import { createIndexedDbUsageLedger } from "./usage-idb.js";

const row = {
  runId: "r_a",
  conversationId: "c_1",
  projectId: "p_1",
  providerId: "openai",
  inputTokens: 10,
  outputTokens: 2,
  costUsd: 0.01,
};

test("indexeddb usage ledger persists across open", async () => {
  const first = await createIndexedDbUsageLedger();
  expect(first.ok).toBe(true);
  if (!first.ok) {
    return;
  }
  first.value.record(row);
  await first.value.flushed();
  const second = await createIndexedDbUsageLedger();
  expect(second.ok).toBe(true);
  if (!second.ok) {
    return;
  }
  expect(second.value.forProject("p_1")).toEqual({
    inputTokens: 10,
    outputTokens: 2,
    costUsd: 0.01,
  });
});
