import { createCommandBus, createDocument, fromYDoc } from "@tessera/core";
import { emptyDocument, validateDocument } from "@tessera/schema";
import { isOk, systemClock } from "@tessera/std";
import { expect, test } from "vitest";
import { createCameraEntity, createLightEntity, createPrimitiveEntity } from "./create-actions.js";

const author = { kind: "user" as const, id: "tester" };

test("create box goes through entity.create", () => {
  const { doc, reader } = createDocument({ snapshot: emptyDocument() });
  const bus = createCommandBus(doc);
  const names: string[] = [];
  const stop = bus.events.on("transaction.committed", (payload) => {
    for (const command of payload.transaction.commands) {
      names.push(command.name);
    }
  });
  const created = createPrimitiveEntity(bus, author, systemClock, "box");
  stop();
  expect(isOk(created)).toBe(true);
  expect(names.includes("entity.create")).toBe(true);
  expect(names.includes("asset.create")).toBe(true);
  expect(validateDocument(fromYDoc(doc.ydoc)).ok).toBe(true);
  if (!created.ok) {
    return;
  }
  const entity = reader.getEntity(created.value.entityId);
  expect(entity?.components.meshRenderer?.geometry).toBeDefined();
  expect(entity?.components.meshRenderer?.materials.length).toBe(1);
});

test("create point light", () => {
  const { doc, reader } = createDocument({ snapshot: emptyDocument() });
  const bus = createCommandBus(doc);
  const created = createLightEntity(bus, author, "point");
  expect(isOk(created)).toBe(true);
  expect(validateDocument(fromYDoc(doc.ydoc)).ok).toBe(true);
  if (!created.ok) {
    return;
  }
  expect(reader.getEntity(created.value.entityId)?.components.light?.type).toBe("point");
});

test("create camera setMain", () => {
  const { doc, reader } = createDocument({ snapshot: emptyDocument() });
  const bus = createCommandBus(doc);
  const created = createCameraEntity(bus, author);
  expect(isOk(created)).toBe(true);
  expect(validateDocument(fromYDoc(doc.ydoc)).ok).toBe(true);
  if (!created.ok) {
    return;
  }
  expect(reader.snapshot().settings.mainCamera).toBe(created.value.entityId);
});
