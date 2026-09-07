import { canonicalize, validateDocument } from "@tessera/schema";
import { isOk } from "@tessera/std";
import { expect, test } from "vitest";
import { createCommandBus } from "./command-bus.js";
import { createDocument } from "./create-document.js";
import { createUndoService } from "./undo-service.js";

const author = { kind: "user" as const, id: "prop" };

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Documented subset for T-0010: entity.create, transform.translate, entity.rename,
 * entity.delete, undo.
 */
test("random create/translate/rename/delete/undo keep the document valid", () => {
  const seeds = [1, 42, 99, 2026, 7];
  for (const seed of seeds) {
    runSequence(seed, 40);
  }
});

function runSequence(seed: number, steps: number): void {
  const { doc, reader } = createDocument();
  const createdUndo = createUndoService(doc);
  const bus = createCommandBus(doc, { undo: createdUndo.capture });
  const start = canonicalize(reader.snapshot());
  const rand = mulberry32(seed);
  const scope = { kind: "author" as const, authorId: author.id };

  for (let step = 0; step < steps; step += 1) {
    const ids = [...reader.entities()].map((entity) => entity.id);
    const roll = rand();
    if (ids.length === 0 || roll < 0.3) {
      const created = bus.execute("entity.create", { name: `n${String(step)}` }, { author });
      expect(isOk(created), `create failed seed=${String(seed)} step=${String(step)}`).toBe(true);
    } else if (roll < 0.5) {
      const target = pick(ids, rand);
      const moved = bus.execute(
        "transform.translate",
        { target, delta: [rand() - 0.5, rand() - 0.5, 0] },
        { author },
      );
      expect(isOk(moved), `translate failed seed=${String(seed)} step=${String(step)}`).toBe(true);
    } else if (roll < 0.7) {
      const target = pick(ids, rand);
      const renamed = bus.execute(
        "entity.rename",
        { target, name: `r${String(step)}` },
        { author },
      );
      expect(isOk(renamed), `rename failed seed=${String(seed)} step=${String(step)}`).toBe(true);
    } else if (roll < 0.85) {
      const target = pick(ids, rand);
      const deleted = bus.execute("entity.delete", { target }, { author });
      expect(isOk(deleted), `delete failed seed=${String(seed)} step=${String(step)}`).toBe(true);
    } else if (createdUndo.undo.canUndo(scope)) {
      const undone = createdUndo.undo.undo(scope);
      expect(isOk(undone), `undo failed seed=${String(seed)} step=${String(step)}`).toBe(true);
    } else {
      const created = bus.execute("entity.create", { name: `f${String(step)}` }, { author });
      expect(isOk(created)).toBe(true);
    }
    const report = validateDocument(reader.snapshot());
    expect(report.ok, `invalid after seed=${String(seed)} step=${String(step)}`).toBe(true);
  }

  while (createdUndo.undo.canUndo(scope)) {
    const undone = createdUndo.undo.undo(scope);
    expect(isOk(undone)).toBe(true);
    expect(validateDocument(reader.snapshot()).ok).toBe(true);
  }
  expect(canonicalize(reader.snapshot())).toBe(start);
}

function pick(ids: readonly string[], rand: () => number): string {
  const index = Math.floor(rand() * ids.length);
  const id = ids[index];
  expect(id !== undefined).toBe(true);
  if (id === undefined) {
    return "e_zzzzzzzzzz";
  }
  return id;
}
