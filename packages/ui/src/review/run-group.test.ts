import type { ChangeSet, TransactionRecord } from "@tessera/core";
import { createDocument } from "@tessera/core";
import { emptyDocument } from "@tessera/schema";
import { expect, test } from "vitest";
import { groupAgentRuns } from "./run-group.js";

const emptyChange: ChangeSet = {
  entities: { created: ["e_0000000001"], deleted: [], updated: [] },
  assets: { created: [], deleted: [], updated: [] },
  behaviors: { created: [], deleted: [], updated: [] },
  summary: "create",
};

function record(
  runId: string,
  id: string,
  kind: TransactionRecord["author"]["kind"] = "agent",
): TransactionRecord {
  return {
    id,
    author: { kind, id: "agent-1", runId },
    label: id,
    runId,
    startedAt: "2026-01-01T00:00:00.000Z",
    durationMs: 1,
    commands: [{ name: "entity.create", input: {} }],
    changeSet: emptyChange,
  };
}

test("live apply groups transactions by runId", () => {
  const groups = groupAgentRuns([
    record("r_aaaaaaaaaa", "t_1"),
    record("r_bbbbbbbbbb", "t_2"),
    record("r_aaaaaaaaaa", "t_3"),
    {
      ...record("r_cccccccccc", "t_user"),
      author: { kind: "user", id: "u" },
      runId: undefined,
    },
  ]);
  expect(groups.map((group) => group.runId)).toEqual(["r_aaaaaaaaaa", "r_bbbbbbbbbb"]);
  expect(groups[0]?.steps.map((step) => step.id)).toEqual(["t_1", "t_3"]);
  expect(groups[0]?.changeSet.entities.created).toEqual(["e_0000000001", "e_0000000001"]);
});

test("INV-ARCH-04 review UI state not in document", () => {
  const created = createDocument({ snapshot: emptyDocument() });
  const before = JSON.stringify(created.reader.snapshot());
  groupAgentRuns([record("r_aaaaaaaaaa", "t_1")]);
  expect(JSON.stringify(created.reader.snapshot())).toBe(before);
});
