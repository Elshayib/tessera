import { emptyDocument } from "@tessera/schema";
import { isErr, isOk } from "@tessera/std";
import { expect, test } from "vitest";
import { createCommandBus } from "../command-bus.js";
import { createDocument } from "../create-document.js";

const author = { kind: "user" as const, id: "tester" };

test("camera.setMain reject / success / change set", () => {
  const { doc, reader } = createDocument({ snapshot: emptyDocument() });
  const bus = createCommandBus(doc);
  const missing = bus.execute("camera.setMain", { target: "e_zzzzzzzzzz" }, { author });
  expect(isErr(missing) && missing.error.code === "NOT_FOUND").toBe(true);
  const entity = bus.execute("entity.create", { name: "cam" }, { author });
  expect(isOk(entity)).toBe(true);
  if (!entity.ok) {
    return;
  }
  const noCamera = bus.execute("camera.setMain", { target: entity.value.output.id }, { author });
  expect(isErr(noCamera) && noCamera.error.code === "CONFLICT").toBe(true);
  bus.execute("component.add", { target: entity.value.output.id, type: "camera" }, { author });
  const set = bus.execute("camera.setMain", { target: entity.value.output.id }, { author });
  expect(isOk(set)).toBe(true);
  if (!set.ok) {
    return;
  }
  expect(reader.snapshot().settings.mainCamera).toBe(entity.value.output.id);
  expect(set.value.transaction.changeSet.settings?.length).toBeGreaterThan(0);
});
