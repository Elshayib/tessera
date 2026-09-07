import { canonicalize } from "@tessera/schema";
import { isOk } from "@tessera/std";
import { expect, test } from "vitest";
import { createCommandBus } from "./command-bus.js";
import { createDocument } from "./create-document.js";
import { createUndoService } from "./undo-service.js";

const alice = { kind: "user" as const, id: "alice" };
const bob = { kind: "user" as const, id: "bob" };

test("INV-CMD-04 undo/redo restores snapshot", () => {
  const { doc, reader } = createDocument();
  const created = createUndoService(doc);
  const bus = createCommandBus(doc, { undo: created.capture });
  const start = canonicalize(reader.snapshot());
  const createdEntity = bus.execute("entity.create", { name: "oak" }, { author: alice });
  expect(isOk(createdEntity)).toBe(true);
  const afterCreate = canonicalize(reader.snapshot());
  expect(afterCreate).not.toBe(start);
  const scope = { kind: "author" as const, authorId: alice.id };
  expect(created.undo.canUndo(scope)).toBe(true);
  expect(created.undo.history(scope).length).toBe(1);
  const undone = created.undo.undo(scope);
  expect(isOk(undone) && undone.value !== null).toBe(true);
  expect(canonicalize(reader.snapshot())).toBe(start);
  expect(created.undo.canUndo(scope)).toBe(false);
  expect(created.undo.canRedo(scope)).toBe(true);
  expect(created.undo.history(scope)).toEqual([]);
  const redone = created.undo.redo(scope);
  expect(isOk(redone) && redone.value !== null).toBe(true);
  expect(canonicalize(reader.snapshot())).toBe(afterCreate);
  expect(created.undo.canRedo(scope)).toBe(false);
});

test("per-author isolation: A undo does not revert B", () => {
  const { doc, reader } = createDocument();
  const created = createUndoService(doc);
  const bus = createCommandBus(doc, { undo: created.capture });
  bus.execute("entity.create", { name: "oak" }, { author: alice });
  bus.execute("entity.create", { name: "pine" }, { author: bob });
  const names = () => [...reader.entities()].map((entity) => entity.name).sort();
  expect(names()).toEqual(["oak", "pine"]);
  created.undo.undo({ kind: "author", authorId: alice.id });
  expect(names()).toEqual(["pine"]);
  expect(created.undo.canUndo({ kind: "author", authorId: bob.id })).toBe(true);
});

test("INV-CMD-09 revertRun with interleaved authors", () => {
  const { doc, reader } = createDocument();
  const created = createUndoService(doc);
  const bus = createCommandBus(doc, { undo: created.capture });
  const runId = "r_aaaaaaaaaa";
  bus.execute("entity.create", { name: "oak" }, { author: alice });
  bus.execute("entity.create", { name: "pine" }, { author: { kind: "agent", id: "bot" }, runId });
  bus.execute("entity.create", { name: "elm" }, { author: alice });
  const names = () => [...reader.entities()].map((entity) => entity.name).sort();
  expect(names()).toEqual(["elm", "oak", "pine"]);
  const reverted = created.undo.revertRun(runId);
  expect(isOk(reverted)).toBe(true);
  expect(names()).toEqual(["elm", "oak"]);
});

test("empty undo/redo and history", () => {
  const { doc } = createDocument();
  const created = createUndoService(doc);
  const scope = { kind: "author" as const, authorId: "nobody" };
  expect(created.undo.canUndo(scope)).toBe(false);
  expect(created.undo.canRedo(scope)).toBe(false);
  expect(created.undo.history(scope)).toEqual([]);
  const undone = created.undo.undo(scope);
  expect(isOk(undone) && undone.value === null).toBe(true);
  const redone = created.undo.redo(scope);
  expect(isOk(redone) && redone.value === null).toBe(true);
  const reverted = created.undo.revertRun("r_bbbbbbbbbb");
  expect(isOk(reverted) && reverted.value.length === 0).toBe(true);
});
