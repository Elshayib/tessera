import { expect, test } from "vitest";
import { createUsageLedger } from "./usage-ledger.js";

test("UsageLedger per run conversation project", () => {
  const ledger = createUsageLedger();
  ledger.record({
    runId: "r_a",
    conversationId: "c_1",
    projectId: "p_1",
    providerId: "openai",
    inputTokens: 10,
    outputTokens: 2,
    costUsd: 0.01,
  });
  ledger.record({
    runId: "r_b",
    conversationId: "c_1",
    projectId: "p_1",
    providerId: "openai",
    inputTokens: 5,
    outputTokens: 1,
    costUsd: 0.02,
  });
  ledger.record({
    runId: "r_c",
    conversationId: "c_2",
    projectId: "p_2",
    providerId: "openai",
    inputTokens: 100,
    outputTokens: 0,
    costUsd: 1,
  });
  expect(ledger.forRun("r_a")).toEqual({ inputTokens: 10, outputTokens: 2, costUsd: 0.01 });
  expect(ledger.forConversation("c_1")).toEqual({
    inputTokens: 15,
    outputTokens: 3,
    costUsd: 0.03,
  });
  expect(ledger.forProject("p_1")).toEqual({ inputTokens: 15, outputTokens: 3, costUsd: 0.03 });
  expect(ledger.forProject("p_2").inputTokens).toBe(100);
});
