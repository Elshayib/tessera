import type { ChangeSet, TransactionRecord, UndoService } from "@tessera/core";
import { ok } from "@tessera/std";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";
import { en } from "../i18n/en.js";
import { ReviewPanel } from "./review-panel.js";

const changeSet: ChangeSet = {
  entities: { created: [], deleted: [], updated: [] },
  assets: { created: [], deleted: [], updated: [] },
  behaviors: { created: [], deleted: [], updated: [] },
  summary: "step",
};

const transaction: TransactionRecord = {
  id: "t_1",
  author: { kind: "agent", id: "exec", runId: "r_aaaaaaaaaa" },
  label: "step",
  runId: "r_aaaaaaaaaa",
  startedAt: "2026-01-01T00:00:00.000Z",
  durationMs: 1,
  commands: [],
  changeSet,
};

test("review panel keyboard operable", async () => {
  const reverted: string[] = [];
  const undo: UndoService = {
    undo: () => ok(null),
    redo: () => ok(null),
    canUndo: () => true,
    canRedo: () => false,
    revertRun(runId) {
      reverted.push(runId);
      return ok([]);
    },
    history: () => [],
  };
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <ReviewPanel
        transactions={[transaction]}
        undo={undo}
        conversationOpen
        working
        plan={[{ text: "place box", done: false }]}
      />,
    );
  });
  const last = [...host.querySelectorAll("button")].find(
    (node) => node.textContent === en.review.revertLastRun,
  );
  expect(last !== undefined).toBe(true);
  if (last === undefined) {
    return;
  }
  last.focus();
  expect(document.activeElement).toBe(last);
  await act(async () => {
    last.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  expect(reverted).toEqual(["r_aaaaaaaaaa"]);
  expect(host.textContent?.includes(en.review.working)).toBe(true);
  expect(host.textContent?.includes("place box")).toBe(true);
  await act(async () => {
    root.unmount();
  });
});
