import { emptyDocument } from "@tessera/schema";
import { isErr, isOk } from "@tessera/std";
import { expect, test } from "vitest";
import { createCommandBus } from "../command-bus.js";
import { createDocument } from "../create-document.js";

const author = { kind: "user" as const, id: "tester" };

test("transform.set / translate / rotate / scale", () => {
  const { doc, reader } = createDocument({ snapshot: emptyDocument() });
  const bus = createCommandBus(doc);
  const created = bus.execute("entity.create", { name: "box" }, { author });
  expect(isOk(created)).toBe(true);
  if (!created.ok) {
    return;
  }
  const id = created.value.output.id;
  const missing = bus.execute(
    "transform.set",
    { target: "e_zzzzzzzzzz", position: [1, 0, 0] },
    { author },
  );
  expect(isErr(missing) && missing.error.code === "NOT_FOUND").toBe(true);

  const set = bus.execute("transform.set", { target: id, position: [1, 2, 3] }, { author });
  expect(isOk(set)).toBe(true);
  expect(reader.getEntity(id)?.components.transform.position).toEqual([1, 2, 3]);

  const translated = bus.execute(
    "transform.translate",
    { target: id, delta: [1, 0, 0] },
    { author },
  );
  expect(isOk(translated)).toBe(true);
  expect(reader.getEntity(id)?.components.transform.position).toEqual([2, 2, 3]);

  const rotated = bus.execute("transform.rotate", { target: id, delta: [0, 90, 0] }, { author });
  expect(isOk(rotated)).toBe(true);
  const rotation = reader.getEntity(id)?.components.transform.rotation;
  expect(rotation !== undefined).toBe(true);
  if (rotation === undefined) {
    return;
  }
  expect(Math.abs(rotation[1] - 90)).toBeLessThan(1e-4);

  const scaled = bus.execute("transform.scale", { target: id, factor: 2 }, { author });
  expect(isOk(scaled)).toBe(true);
  expect(reader.getEntity(id)?.components.transform.scale).toEqual([2, 2, 2]);

  const invalid = bus.execute("transform.scale", { target: id, factor: 0 }, { author });
  expect(isErr(invalid)).toBe(true);
});
