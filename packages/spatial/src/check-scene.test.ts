import type { Document, Entity } from "@tessera/schema";
import { docBuilder, fixtures } from "@tessera/testing";
import { expect, test } from "vitest";
import { checkScene } from "./check-scene.js";
import type { CheckSceneReader } from "./types.js";

function snapshotReader(snapshot: Document): CheckSceneReader {
  const reader: CheckSceneReader = {
    getEntity: (id) => snapshot.entities[id],
    getAsset: (id) => snapshot.assets[id],
    parentChain(id) {
      const chain: Entity[] = [];
      const visiting = new Set<string>();
      let current: string | null = id;
      while (current !== null) {
        if (visiting.has(current)) {
          break;
        }
        visiting.add(current);
        const entity = snapshot.entities[current];
        if (entity === undefined) {
          break;
        }
        chain.push(entity);
        current = entity.parent;
      }
      return chain;
    },
    pathOf(id) {
      const chain = reader.parentChain(id);
      const start = chain[0];
      if (start === undefined || start.id !== id) {
        return undefined;
      }
      return `/${[...chain]
        .reverse()
        .map((entity) => entity.name)
        .join("/")}`;
    },
    entities() {
      return Object.values(snapshot.entities);
    },
  };
  return reader;
}

function named(snapshot: Document, name: string): Entity | undefined {
  return Object.values(snapshot.entities).find((item) => item.name === name);
}

test("INV-AGT spatial overlap floating buried out-of-bounds", () => {
  const snapshot = docBuilder()
    .geometry("box", { type: "box", size: [1, 1, 1] })
    .entity("overlap_a", { mesh: "box", transform: { position: [0, 0.5, 0] } })
    .entity("overlap_b", { mesh: "box", transform: { position: [0.2, 0.5, 0] } })
    .entity("float_prop", { mesh: "box", transform: { position: [4, 2, 0] } })
    .entity("buried_prop", { mesh: "box", transform: { position: [8, 0, 0] } })
    .entity("far_away", { mesh: "box", transform: { position: [20_000, 0.5, 0] } })
    .entity("tiny", { mesh: "box", transform: { position: [12, 0.5, 0], scale: [0.0005, 1, 1] } })
    .build();
  const floatProp = named(snapshot, "float_prop");
  const buriedProp = named(snapshot, "buried_prop");
  expect(floatProp !== undefined && buriedProp !== undefined).toBe(true);
  if (floatProp === undefined || buriedProp === undefined) {
    return;
  }
  floatProp.components.tags = ["prop"];
  buriedProp.components.tags = ["furniture"];
  const reader = snapshotReader(snapshot);
  const changed = [...reader.entities()].map((entity) => entity.id);
  const result = checkScene(reader, changed);
  const checks = result.issues.map((issue) => issue.check);
  expect(checks).toContain("overlap");
  expect(checks).toContain("floating");
  expect(checks).toContain("buried");
  expect(checks).toContain("out-of-bounds");
  const overlap = result.issues.find((issue) => issue.check === "overlap");
  expect(overlap?.severity).toBe("error");
  expect(overlap?.suggestedTool?.name).toBe("layout.resolveOverlaps");
  expect(result.issues.find((issue) => issue.check === "floating")?.severity).toBe("warning");
  expect(result.issues.find((issue) => issue.check === "buried")?.suggestedTool?.name).toBe(
    "layout.snapToGround",
  );
});

test("size sanity duplicates orphans", () => {
  const snapshot = docBuilder()
    .geometry("box", { type: "box", size: [1, 1, 1] })
    .entity("chair", { mesh: "box", transform: { position: [0, 2.5, 0], scale: [1, 5, 1] } })
    .entity("twin_a", { mesh: "box", transform: { position: [6, 0.5, 0] } })
    .entity("twin_b", { mesh: "box", transform: { position: [6, 0.5, 0] } })
    .entity("lamp", { transform: { position: [80, 2, 0] } })
    .entity("cam", { transform: { position: [0, 1, 8], rotation: [0, 180, 0] } })
    .build();
  const chair = named(snapshot, "chair");
  const lamp = named(snapshot, "lamp");
  const cam = named(snapshot, "cam");
  expect(chair !== undefined && lamp !== undefined && cam !== undefined).toBe(true);
  if (chair === undefined || lamp === undefined || cam === undefined) {
    return;
  }
  chair.components.tags = ["prop"];
  lamp.components.light = {
    type: "point",
    color: "#ffffff",
    intensity: 100,
    range: 1,
    castShadow: false,
  };
  cam.components.camera = {
    type: "perspective",
    fov: 50,
    near: 0.1,
    far: 1000,
    orthoSize: 5,
  };
  const reader = snapshotReader(snapshot);
  const result = checkScene(
    reader,
    [...reader.entities()].map((entity) => entity.id),
  );
  expect(result.issues.some((issue) => issue.check === "size-sanity")).toBe(true);
  expect(result.issues.some((issue) => issue.check === "duplicates")).toBe(true);
  expect(result.issues.some((issue) => issue.check === "orphans")).toBe(true);
  expect(result.issues.find((issue) => issue.check === "size-sanity")?.severity).toBe("warning");
  expect(result.issues.find((issue) => issue.check === "duplicates")?.severity).toBe("warning");
  expect(result.issues.find((issue) => issue.check === "orphans")?.severity).toBe("info");
});

test("overlap-ok and parent-child are skipped; 200 D1 entities stay under 50ms", () => {
  const snapshot = docBuilder()
    .geometry("box", { type: "box", size: [1, 1, 1] })
    .entity("parent", { mesh: "box", transform: { position: [0, 0.5, 0] } })
    .entity("child", { parent: "parent", mesh: "box", transform: { position: [0, 0, 0] } })
    .entity("ok_a", { mesh: "box", transform: { position: [4, 0.5, 0] } })
    .entity("ok_b", { mesh: "box", transform: { position: [4.1, 0.5, 0] } })
    .build();
  const okA = named(snapshot, "ok_a");
  expect(okA !== undefined).toBe(true);
  if (okA === undefined) {
    return;
  }
  okA.components.tags = ["overlap-ok"];
  const reader = snapshotReader(snapshot);
  const small = checkScene(
    reader,
    [...reader.entities()].map((entity) => entity.id),
  );
  expect(small.issues.some((issue) => issue.check === "overlap")).toBe(false);

  const d1 = fixtures.D1();
  const keep = new Set(
    Object.keys(d1.entities)
      .slice(0, 250)
      .filter((id) => id.length > 0),
  );
  const subset: Document = {
    ...d1,
    entities: Object.fromEntries(Object.entries(d1.entities).filter((entry) => keep.has(entry[0]))),
  };
  const d1Reader = snapshotReader(subset);
  const meshes = [...d1Reader.entities()]
    .filter((entity) => entity.components.meshRenderer !== undefined)
    .slice(0, 200)
    .map((entity) => entity.id);
  checkScene(d1Reader, meshes);
  const started = performance.now();
  checkScene(d1Reader, meshes);
  expect(performance.now() - started).toBeLessThan(50);
});
