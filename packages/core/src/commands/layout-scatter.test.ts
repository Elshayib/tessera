import { emptyDocument } from "@tessera/schema";
import { isOk } from "@tessera/std";
import { docBuilder, FakeClock } from "@tessera/testing";
import { expect, test } from "vitest";
import { createCommandBus } from "../command-bus.js";
import { createDocument } from "../create-document.js";

const author = { kind: "user" as const, id: "tester" };

function geometryInput() {
  const built = docBuilder().entity("box", { mesh: "box" }).build();
  const asset = Object.values(built.assets)[0];
  expect(asset !== undefined).toBe(true);
  if (asset === undefined) {
    throw new Error("expected geometry");
  }
  const { id: _id, createdAt: _createdAt, ...input } = asset;
  void _id;
  void _createdAt;
  return input;
}

function scatterScene() {
  const created = createDocument({ snapshot: emptyDocument(), clock: new FakeClock() });
  const bus = createCommandBus(created.doc);
  const geom = bus.execute("asset.create", { asset: geometryInput() }, { author });
  expect(isOk(geom)).toBe(true);
  if (!geom.ok) {
    throw new Error("geometry");
  }
  const geometry = geom.value.output.id;
  const spawn = (
    name: string,
    position: [number, number, number],
    scale: [number, number, number],
  ) => {
    const result = bus.execute(
      "entity.create",
      {
        name,
        components: {
          transform: { position, rotation: [0, 0, 0], scale },
          meshRenderer: { geometry },
        },
      },
      { author },
    );
    expect(isOk(result)).toBe(true);
    if (!result.ok) {
      throw new Error(name);
    }
    return result.value.output.id;
  };
  return {
    reader: created.reader,
    bus,
    ground: spawn("ground", [0, 0, 0], [20, 1, 20]),
    tree: spawn("tree", [0, 2, 0], [1, 1, 1]),
  };
}

test("INV-CMD-08 scatter same seed same duplicates", () => {
  const left = scatterScene();
  const right = scatterScene();
  const a = left.bus.execute(
    "layout.scatter",
    { template: left.tree, surface: left.ground, count: 4, seed: 7, minDistance: 1 },
    { author },
  );
  const b = right.bus.execute(
    "layout.scatter",
    { template: right.tree, surface: right.ground, count: 4, seed: 7, minDistance: 1 },
    { author },
  );
  expect(a.ok, a.ok ? "ok" : `${a.error.code}: ${a.error.message}`).toBe(true);
  expect(isOk(b)).toBe(true);
  const pose = (reader: typeof left.reader) =>
    [...reader.entities()]
      .map((entity) => ({ name: entity.name, transform: entity.components.transform }))
      .sort((leftEntity, rightEntity) => leftEntity.name.localeCompare(rightEntity.name));
  expect(pose(left.reader)).toEqual(pose(right.reader));
});

test("layout.scatter missing template is NOT_FOUND", () => {
  const { bus, ground } = scatterScene();
  const missing = bus.execute(
    "layout.scatter",
    { template: "e_zzzzzzzzzz", surface: ground, count: 1, seed: 1 },
    { author },
  );
  expect(missing.ok).toBe(false);
});
