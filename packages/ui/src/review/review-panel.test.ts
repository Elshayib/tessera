import type { ChangeSet, TransactionRecord, UndoService } from "@tessera/core";
import { createDocument } from "@tessera/core";
import { emptyDocument } from "@tessera/schema";
import { ok } from "@tessera/std";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";
import { en } from "../i18n/en.js";
import { ReviewPanel } from "./review-panel.js";

const changeSet: ChangeSet = {
  entities: { created: ["e_0000000001"], deleted: [], updated: [] },
  assets: { created: [], deleted: [], updated: [] },
  behaviors: { created: [], deleted: [], updated: [] },
  summary: "create",
};

const transaction: TransactionRecord = {
  id: "t_1",
  author: { kind: "agent", id: "exec", runId: "r_aaaaaaaaaa" },
  label: "create box",
  runId: "r_aaaaaaaaaa",
  startedAt: "2026-01-01T00:00:00.000Z",
  durationMs: 1,
  commands: [{ name: "entity.create", input: { name: "box" } }],
  changeSet,
};

function fakeUndo(log: { revertRun: string[]; undo: number }): UndoService {
  return {
    undo() {
      log.undo += 1;
      return ok(null);
    },
    redo: () => ok(null),
    canUndo: () => true,
    canRedo: () => false,
    revertRun(runId) {
      log.revertRun.push(runId);
      return ok([]);
    },
    history: () => [],
  };
}

async function renderPanel(
  undo: UndoService,
): Promise<{ host: HTMLDivElement; root: ReturnType<typeof createRoot> }> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(ReviewPanel, {
        transactions: [transaction],
        undo,
        conversationOpen: true,
      }),
    );
  });
  return { host, root };
}

test("INV-AGT-01 revert run calls undo.revertRun", async () => {
  const log = { revertRun: [] as string[], undo: 0 };
  const { host, root } = await renderPanel(fakeUndo(log));
  const button = [...host.querySelectorAll("button")].find(
    (node) => node.textContent === en.review.revertRun,
  );
  expect(button !== undefined).toBe(true);
  if (button === undefined) {
    return;
  }
  await act(async () => {
    button.click();
  });
  expect(log.revertRun).toEqual(["r_aaaaaaaaaa"]);
  await act(async () => {
    root.unmount();
  });
});

test("accept is a no-op", async () => {
  const created = createDocument({ snapshot: emptyDocument() });
  const before = JSON.stringify(created.reader.snapshot());
  const log = { revertRun: [] as string[], undo: 0 };
  const { host, root } = await renderPanel(fakeUndo(log));
  const button = [...host.querySelectorAll("button")].find(
    (node) => node.textContent === en.review.accept,
  );
  expect(button !== undefined).toBe(true);
  if (button === undefined) {
    return;
  }
  await act(async () => {
    button.click();
  });
  expect(log.revertRun).toEqual([]);
  expect(log.undo).toBe(0);
  expect(JSON.stringify(created.reader.snapshot())).toBe(before);
  await act(async () => {
    root.unmount();
  });
});
