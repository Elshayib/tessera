import { canonicalize, emptyDocument } from "@tessera/schema";
import { isErr, isOk } from "@tessera/std";
import { docBuilder, FakeClock } from "@tessera/testing";
import { expect, test } from "vitest";
import { createCommandBus } from "../command-bus.js";
import { createDocument } from "../create-document.js";
import { createUndoService } from "../undo-service.js";

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

function boxedScene(clock = new FakeClock()) {
  const created = createDocument({ snapshot: emptyDocument(), clock });
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
    scale?: [number, number, number],
  ) => {
    const result = bus.execute(
      "entity.create",
      {
        name,
        components: {
          transform: { position, rotation: [0, 0, 0], scale: scale ?? [1, 1, 1] },
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
    ...created,
    bus,
    ground: spawn("ground", [0, 0, 0], [8, 1, 8]),
    a: spawn("a", [0, 6, 0]),
    b: spawn("b", [3, 6, 0]),
    c: spawn("c", [6, 6, 0]),
  };
}

function snapshotScene(clock = new FakeClock()) {
  const snapshot = docBuilder()
    .geometry("mesh", { type: "box", size: [2, 2, 2] })
    .entity("ground", { mesh: "mesh", transform: { position: [0, 0, 0], scale: [8, 1, 8] } })
    .entity("a", { mesh: "mesh", transform: { position: [0, 6, 0] } })
    .entity("b", { mesh: "mesh", transform: { position: [3, 6, 0] } })
    .entity("c", { mesh: "mesh", transform: { position: [6, 6, 0] } })
    .build();
  const created = createDocument({ snapshot, clock });
  return {
    ...created,
    bus: createCommandBus(created.doc),
    id(name: string): string {
      const entity = [...created.reader.entities()].find((item) => item.name === name);
      expect(entity).toBeDefined();
      return entity?.id ?? "e_missing000";
    },
  };
}

test("INV-CMD-08 layout macros are deterministic", () => {
  const first = snapshotScene();
  const second = snapshotScene();
  const a = first.bus.execute(
    "layout.arrangeGrid",
    {
      targets: [first.id("a"), first.id("b"), first.id("c")],
      columns: 3,
      spacing: [4, 4],
      origin: [0, 1, 0],
    },
    { author },
  );
  const b = second.bus.execute(
    "layout.arrangeGrid",
    {
      targets: [second.id("a"), second.id("b"), second.id("c")],
      columns: 3,
      spacing: [4, 4],
      origin: [0, 1, 0],
    },
    { author },
  );
  expect(isOk(a)).toBe(true);
  expect(isOk(b)).toBe(true);
  expect(canonicalize(first.reader.snapshot())).toBe(canonicalize(second.reader.snapshot()));
});

test("INV-CMD-01/02 schema and semantic rejection leave snapshot identical", () => {
  const { bus, reader } = snapshotScene();
  const before = canonicalize(reader.snapshot());
  const schema = bus.execute("layout.placeOn", { target: "nope" }, { author });
  expect(isErr(schema)).toBe(true);
  expect(canonicalize(reader.snapshot())).toBe(before);
  const missing = bus.execute(
    "layout.placeOn",
    { target: "e_zzzzzzzzzz", surface: "e_zzzzzzzzzy" },
    { author },
  );
  expect(isErr(missing) && missing.error.code === "NOT_FOUND").toBe(true);
  expect(canonicalize(reader.snapshot())).toBe(before);
});

test("INV-CMD-04 undo/redo after arrangeGrid", () => {
  const snapshot = docBuilder()
    .geometry("mesh", { type: "box", size: [2, 2, 2] })
    .entity("a", { mesh: "mesh", transform: { position: [0, 0, 0] } })
    .entity("b", { mesh: "mesh", transform: { position: [1, 0, 0] } })
    .build();
  const created = createDocument({ snapshot });
  const undo = createUndoService(created.doc);
  const bus = createCommandBus(created.doc, { undo: undo.capture });
  const id = (name: string) => {
    const entity = [...created.reader.entities()].find((item) => item.name === name);
    expect(entity).toBeDefined();
    return entity?.id ?? "e_missing000";
  };
  const start = canonicalize(created.reader.snapshot());
  const ran = bus.execute(
    "layout.arrangeGrid",
    { targets: [id("a"), id("b")], columns: 2, spacing: [5, 5], origin: [0, 0, 0] },
    { author },
  );
  expect(isOk(ran)).toBe(true);
  const after = canonicalize(created.reader.snapshot());
  expect(after).not.toBe(start);
  const scope = { kind: "author" as const, authorId: author.id };
  expect(isOk(undo.undo.undo(scope))).toBe(true);
  expect(canonicalize(created.reader.snapshot())).toBe(start);
  expect(isOk(undo.undo.redo(scope))).toBe(true);
  expect(canonicalize(created.reader.snapshot())).toBe(after);
});

test("placeOn snap align distribute lookAt resolveOverlaps and camera.fit succeed", () => {
  const { bus, reader, a, b, c, ground } = boxedScene();
  expect(isOk(bus.execute("layout.placeOn", { target: a, surface: ground }, { author }))).toBe(
    true,
  );
  expect(isOk(bus.execute("layout.snapToGround", { targets: [b], ground: "y0" }, { author }))).toBe(
    true,
  );
  expect(
    isOk(
      bus.execute(
        "layout.alignTo",
        { targets: [c], reference: a, axes: ["x"], mode: "center" },
        { author },
      ),
    ),
  ).toBe(true);
  expect(
    isOk(
      bus.execute(
        "layout.distribute",
        { targets: [a, b, c], axis: "x", spacing: "even" },
        { author },
      ),
    ),
  ).toBe(true);
  expect(isOk(bus.execute("layout.lookAt", { target: a, point: [10, 6, 0] }, { author }))).toBe(
    true,
  );
  expect(
    isOk(bus.execute("layout.resolveOverlaps", { targets: [a, b], iterations: 4 }, { author })),
  ).toBe(true);
  const camEntity = bus.execute("entity.create", { name: "cam" }, { author });
  expect(isOk(camEntity)).toBe(true);
  if (!camEntity.ok) {
    return;
  }
  expect(
    isOk(
      bus.execute(
        "component.add",
        { target: camEntity.value.output.id, type: "camera" },
        { author },
      ),
    ),
  ).toBe(true);
  expect(
    isOk(
      bus.execute(
        "camera.fit",
        { camera: camEntity.value.output.id, targets: "all", direction: "iso" },
        { author },
      ),
    ),
  ).toBe(true);
  expect(reader.getEntity(a)).toBeDefined();
});

test("layout option branches: anchors, entity ground, scatter jitter, lookAt entity, camera.fit", () => {
  const { bus, a, b, c, ground } = boxedScene();
  expect(
    isOk(
      bus.execute(
        "layout.placeOn",
        { target: a, surface: ground, anchor: "random", margin: 0.5 },
        { author },
      ),
    ),
  ).toBe(true);
  expect(
    isOk(bus.execute("layout.placeOn", { target: b, surface: ground, anchor: [0, 1] }, { author })),
  ).toBe(true);
  expect(isOk(bus.execute("layout.snapToGround", { targets: [c], ground }, { author }))).toBe(true);
  expect(
    isOk(
      bus.execute(
        "layout.alignTo",
        { targets: [a], reference: ground, axes: ["y", "z"], mode: "min" },
        { author },
      ),
    ),
  ).toBe(true);
  expect(
    isOk(
      bus.execute(
        "layout.distribute",
        { targets: [a, b], axis: "z", spacing: 2, from: [0, 0, 0], to: [0, 0, 10] },
        { author },
      ),
    ),
  ).toBe(true);
  expect(
    isOk(
      bus.execute(
        "layout.arrangeGrid",
        { targets: [a, b], columns: 2, spacing: [1, 1], origin: [0, 0, 0], plane: "xy" },
        { author },
      ),
    ),
  ).toBe(true);
  expect(
    isOk(
      bus.execute(
        "layout.scatter",
        {
          template: c,
          surface: ground,
          count: 2,
          seed: 3,
          minDistance: 0.5,
          randomYaw: true,
          scaleJitter: 0.1,
          alignToNormal: true,
        },
        { author },
      ),
    ),
  ).toBe(true);
  expect(isOk(bus.execute("layout.lookAt", { target: a, point: b }, { author }))).toBe(true);
  expect(
    isOk(
      bus.execute(
        "layout.resolveOverlaps",
        { targets: [a, b], iterations: 2, ground: "y0" },
        { author },
      ),
    ),
  ).toBe(true);
  const camEntity = bus.execute("entity.create", { name: "fit-cam" }, { author });
  expect(isOk(camEntity)).toBe(true);
  if (!camEntity.ok) {
    return;
  }
  expect(
    isOk(
      bus.execute(
        "component.add",
        { target: camEntity.value.output.id, type: "camera" },
        { author },
      ),
    ),
  ).toBe(true);
  expect(
    isOk(
      bus.execute(
        "camera.fit",
        { camera: camEntity.value.output.id, targets: [a, b], direction: "keep" },
        { author },
      ),
    ),
  ).toBe(true);
  expect(
    isOk(
      bus.execute(
        "camera.fit",
        { camera: camEntity.value.output.id, targets: [ground], direction: "front" },
        { author },
      ),
    ),
  ).toBe(true);
  expect(
    isOk(
      bus.execute(
        "camera.fit",
        { camera: camEntity.value.output.id, targets: [ground], direction: "top" },
        { author },
      ),
    ),
  ).toBe(true);
});

test("layout and camera.fit reject missing refs and camera-less entities", () => {
  const { bus, a, ground } = boxedScene();
  const missing = "e_zzzzzzzzzz";
  expect(isErr(bus.execute("layout.placeOn", { target: a, surface: missing }, { author }))).toBe(
    true,
  );
  expect(
    isErr(bus.execute("layout.snapToGround", { targets: [a], ground: missing }, { author })),
  ).toBe(true);
  expect(isOk(bus.execute("layout.snapToGround", { targets: [a] }, { author }))).toBe(true);
  expect(
    isErr(
      bus.execute(
        "layout.alignTo",
        { targets: [a], reference: missing, axes: ["x"], mode: "max" },
        { author },
      ),
    ),
  ).toBe(true);
  expect(
    isErr(bus.execute("layout.distribute", { targets: [missing], axis: "y" }, { author })),
  ).toBe(true);
  expect(
    isErr(
      bus.execute(
        "layout.arrangeGrid",
        { targets: [missing], columns: 1, spacing: [1, 1] },
        { author },
      ),
    ),
  ).toBe(true);
  expect(
    isErr(
      bus.execute(
        "layout.scatter",
        { template: a, surface: missing, count: 1, seed: 1 },
        { author },
      ),
    ),
  ).toBe(true);
  expect(isErr(bus.execute("layout.lookAt", { target: a, point: missing }, { author }))).toBe(true);
  expect(
    isErr(bus.execute("layout.resolveOverlaps", { targets: [a], ground: missing }, { author })),
  ).toBe(true);
  expect(
    isOk(bus.execute("layout.resolveOverlaps", { targets: [a, ground], ground }, { author })),
  ).toBe(true);
  const camEntity = bus.execute("entity.create", { name: "no-cam" }, { author });
  expect(isOk(camEntity)).toBe(true);
  if (!camEntity.ok) {
    return;
  }
  expect(
    isErr(
      bus.execute(
        "camera.fit",
        { camera: camEntity.value.output.id, targets: "all", direction: "iso" },
        { author },
      ),
    ),
  ).toBe(true);
  expect(
    isErr(
      bus.execute("camera.fit", { camera: missing, targets: [a], direction: "iso" }, { author }),
    ),
  ).toBe(true);
  expect(
    isOk(
      bus.execute(
        "component.add",
        { target: camEntity.value.output.id, type: "camera" },
        { author },
      ),
    ),
  ).toBe(true);
  expect(
    isErr(
      bus.execute(
        "camera.fit",
        { camera: camEntity.value.output.id, targets: [missing], direction: "iso" },
        { author },
      ),
    ),
  ).toBe(true);
});
