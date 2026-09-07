import { createDocument } from "@tessera/core";
import type { Document, Entity } from "@tessera/schema";
import { DocumentSchema } from "@tessera/schema";
import { docBuilder } from "@tessera/testing";
import {
  DirectionalLight,
  Group,
  MathUtils,
  Mesh,
  OrthographicCamera,
  RectAreaLight,
  Scene,
  SpotLight,
} from "three";
import { MeshBasicNodeMaterial, MeshPhysicalNodeMaterial } from "three/webgpu";
import { expect, test } from "vitest";
import campfireJson from "../../../schema/fixtures/documents/0.1.0/campfire.json";
import { createRendererSync } from "./renderer-sync.js";
import type { SyncReader } from "./types.js";

const campfire = DocumentSchema.parse(campfireJson);

test("INV-RND-01 change set twice", () => {
  const { reader } = createDocument({ snapshot: campfire });
  const sync = createRendererSync({ scene: new Scene() });
  const changeSet = createdAll(campfire);
  sync.apply(changeSet, reader);
  const first = sync.structuralHash();
  sync.apply(changeSet, reader);
  expect(sync.structuralHash()).toBe(first);
  expect(first.length).toBeGreaterThan(10);
  sync.dispose();
});

test("INV-RND-02 incremental equals rebuild", () => {
  const { reader } = createDocument({ snapshot: campfire });
  const incremental = createRendererSync({ scene: new Scene() });
  incremental.apply(createdAll(campfire), reader);
  const rebuilt = createRendererSync({ scene: new Scene() });
  rebuilt.rebuild(reader);
  expect(incremental.structuralHash()).toBe(rebuilt.structuralHash());
  incremental.dispose();
  rebuilt.dispose();
});

test("disabled entities set group visible from enabled", () => {
  const doc = docBuilder()
    .entity("hidden", { mesh: "box", enabled: false })
    .entity("shown", { mesh: "box", enabled: true })
    .build();
  const { reader } = createDocument({ snapshot: doc });
  const scene = new Scene();
  const sync = createRendererSync({ scene });
  sync.rebuild(reader);
  const hidden = reader.snapshot().entities;
  const hiddenId = Object.values(hidden).find((entity) => entity.name === "hidden")?.id;
  const shownId = Object.values(hidden).find((entity) => entity.name === "shown")?.id;
  expect(hiddenId !== undefined && shownId !== undefined).toBe(true);
  if (hiddenId === undefined || shownId === undefined) {
    return;
  }
  const hiddenGroup = findEntity(scene, hiddenId);
  const shownGroup = findEntity(scene, shownId);
  expect(hiddenGroup?.visible).toBe(false);
  expect(shownGroup?.visible).toBe(true);
  sync.dispose();
});

test("INV-RND-06 failed geometry uses placeholder without mutating the document", () => {
  const snapshot = DocumentSchema.parse(campfireJson);
  const blobId = "a_blob000001";
  snapshot.assets[blobId] = {
    id: blobId,
    kind: "geometry",
    name: "MissingBlob",
    license: "unknown",
    provenance: { source: "upload", importedAt: "2026-01-01T00:00:00.000Z" },
    createdAt: "2026-01-01T00:00:00.000Z",
    source: {
      kind: "blob",
      blob: {
        hash: "sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        size: 1,
        mime: "model/gltf-binary",
      },
    },
    bounds: { min: [0, 0, 0], max: [1, 1, 1] },
    stats: { triangles: 0, vertices: 0, primitiveGroups: 1 },
  };
  const ground = snapshot.entities["e_ground0001"];
  expect(ground !== undefined).toBe(true);
  if (ground === undefined) {
    return;
  }
  snapshot.entities["e_ground0001"] = {
    ...ground,
    components: {
      ...ground.components,
      meshRenderer: {
        geometry: blobId,
        materials: ["a_mat0000001"],
        castShadow: true,
        receiveShadow: true,
        visible: true,
      },
    },
  };
  const { reader } = createDocument({ snapshot });
  const before = JSON.stringify(reader.snapshot());
  const sync = createRendererSync({ scene: new Scene() });
  sync.rebuild(reader);
  expect(JSON.stringify(reader.snapshot())).toBe(before);
  expect(sync.structuralHash().includes("placeholder")).toBe(true);
  sync.dispose();
});

test("mirrors directional spot area lights and orthographic cameras", () => {
  const snapshot = cloneDocument(
    docBuilder().entity("sun").entity("spot").entity("area").entity("ortho").build(),
  );
  const sunId = idByName(snapshot, "sun");
  const spotId = idByName(snapshot, "spot");
  const areaId = idByName(snapshot, "area");
  const orthoId = idByName(snapshot, "ortho");
  expect(
    sunId !== undefined && spotId !== undefined && areaId !== undefined && orthoId !== undefined,
  ).toBe(true);
  if (
    sunId === undefined ||
    spotId === undefined ||
    areaId === undefined ||
    orthoId === undefined
  ) {
    return;
  }
  snapshot.entities[sunId] = withLight(snapshot.entities[sunId], {
    type: "directional",
    color: "#ffffff",
    intensity: 3,
    castShadow: true,
  });
  snapshot.entities[spotId] = withLight(snapshot.entities[spotId], {
    type: "spot",
    color: "#ffeeaa",
    intensity: 200,
    range: 12,
    angle: 45,
    penumbra: 0.3,
    castShadow: false,
  });
  snapshot.entities[areaId] = withLight(snapshot.entities[areaId], {
    type: "area",
    color: "#88aaff",
    intensity: 5,
    size: [2, 1],
    castShadow: false,
  });
  snapshot.entities[orthoId] = withCamera(snapshot.entities[orthoId], {
    type: "orthographic",
    fov: 50,
    near: 0.1,
    far: 100,
    orthoSize: 8,
  });
  const { reader } = createDocument({ snapshot });
  const scene = new Scene();
  const sync = createRendererSync({ scene });
  sync.rebuild(reader);
  const sunLight = findKind(scene, sunId, "light");
  const spotLight = findKind(scene, spotId, "light");
  const areaLight = findKind(scene, areaId, "light");
  const orthoCam = findKind(scene, orthoId, "camera");
  expect(sunLight instanceof DirectionalLight).toBe(true);
  expect(spotLight instanceof SpotLight).toBe(true);
  expect(areaLight instanceof RectAreaLight).toBe(true);
  expect(orthoCam instanceof OrthographicCamera).toBe(true);
  if (spotLight instanceof SpotLight) {
    expect(spotLight.angle).toBeCloseTo(MathUtils.degToRad(45), 5);
    expect(spotLight.penumbra).toBe(0.3);
  }
  if (areaLight instanceof RectAreaLight) {
    expect(areaLight.width).toBe(2);
    expect(areaLight.height).toBe(1);
  }
  sync.dispose();
});

test("mirrors unlit physical and default materials then releases shared geometry", () => {
  const snapshot = cloneDocument(
    docBuilder()
      .material("unlit", { model: "unlit", baseColor: "#ff00ff" })
      .material("glass")
      .material("coat")
      .entity("bare", { mesh: "box" })
      .entity("sharedA", { mesh: "box" })
      .entity("sharedB", { mesh: "box" })
      .entity("unlitBox", { mesh: "box", material: "unlit" })
      .entity("glassBox", { mesh: "box", material: "glass" })
      .entity("coatBox", { mesh: "box", material: "coat" })
      .entity("wrongKind", { mesh: "box" })
      .build(),
  );
  const unlitId = assetIdByName(snapshot, "unlit");
  const glassId = assetIdByName(snapshot, "glass");
  const coatId = assetIdByName(snapshot, "coat");
  const unlitEntity = idByName(snapshot, "unlitBox");
  const glassEntity = idByName(snapshot, "glassBox");
  const coatEntity = idByName(snapshot, "coatBox");
  const wrongEntity = idByName(snapshot, "wrongKind");
  const sharedA = idByName(snapshot, "sharedA");
  const sharedB = idByName(snapshot, "sharedB");
  const bare = idByName(snapshot, "bare");
  expect(
    unlitId !== undefined &&
      glassId !== undefined &&
      coatId !== undefined &&
      unlitEntity !== undefined &&
      glassEntity !== undefined &&
      coatEntity !== undefined &&
      wrongEntity !== undefined &&
      sharedA !== undefined &&
      sharedB !== undefined &&
      bare !== undefined,
  ).toBe(true);
  if (
    unlitId === undefined ||
    glassId === undefined ||
    coatId === undefined ||
    unlitEntity === undefined ||
    glassEntity === undefined ||
    coatEntity === undefined ||
    wrongEntity === undefined ||
    sharedA === undefined ||
    sharedB === undefined ||
    bare === undefined
  ) {
    return;
  }
  const unlitAsset = snapshot.assets[unlitId];
  const glassAsset = snapshot.assets[glassId];
  const coatAsset = snapshot.assets[coatId];
  expect(
    unlitAsset?.kind === "material" &&
      glassAsset?.kind === "material" &&
      coatAsset?.kind === "material",
  ).toBe(true);
  if (
    unlitAsset?.kind !== "material" ||
    glassAsset?.kind !== "material" ||
    coatAsset?.kind !== "material"
  ) {
    return;
  }
  snapshot.assets[unlitId] = {
    ...unlitAsset,
    opacity: 0.4,
    doubleSided: true,
  };
  snapshot.assets[glassId] = {
    ...glassAsset,
    transmission: 1,
    ior: 1.5,
    thickness: 0.2,
    opacity: 0.5,
    doubleSided: true,
  };
  snapshot.assets[coatId] = {
    ...coatAsset,
    clearcoat: 0.8,
    clearcoatRoughness: 0.2,
  };
  const wrong = snapshot.entities[wrongEntity];
  expect(wrong !== undefined).toBe(true);
  if (wrong === undefined) {
    return;
  }
  snapshot.entities[wrongEntity] = {
    ...wrong,
    components: {
      ...wrong.components,
      meshRenderer: {
        geometry: unlitId,
        materials: [unlitId],
        castShadow: false,
        receiveShadow: false,
        visible: true,
      },
    },
  };
  const { reader } = createDocument({ snapshot });
  const scene = new Scene();
  const sync = createRendererSync({ scene });
  sync.rebuild(reader);
  const unlitMesh = findKind(scene, unlitEntity, "mesh");
  const glassMesh = findKind(scene, glassEntity, "mesh");
  const coatMesh = findKind(scene, coatEntity, "mesh");
  expect(unlitMesh instanceof Mesh && unlitMesh.material instanceof MeshBasicNodeMaterial).toBe(
    true,
  );
  expect(glassMesh instanceof Mesh && glassMesh.material instanceof MeshPhysicalNodeMaterial).toBe(
    true,
  );
  expect(coatMesh instanceof Mesh && coatMesh.material instanceof MeshPhysicalNodeMaterial).toBe(
    true,
  );
  expect(sync.structuralHash().includes("placeholder")).toBe(true);
  sync.apply(
    {
      entities: {
        created: [],
        deleted: [{ id: sharedA }, { id: sharedB }, { id: bare }],
        updated: [],
      },
      assets: { created: [], deleted: [], updated: [] },
    },
    reader,
  );
  expect(findEntity(scene, sharedA)).toBeUndefined();
  const unusedMaterial = assetIdByName(snapshot, "unlit");
  expect(unusedMaterial !== undefined).toBe(true);
  if (unusedMaterial === undefined) {
    return;
  }
  sync.apply(
    {
      entities: { created: [], deleted: [], updated: [] },
      assets: { created: [], deleted: [{ id: unusedMaterial }], updated: [] },
    },
    reader,
  );
  sync.dispose();
});

test("apply updates reparent asset users and ignores missing ids", () => {
  const nested = cloneDocument(
    docBuilder()
      .entity("root")
      .entity("leaf", { parent: "root", mesh: "box", material: "bark" })
      .material("bark", { baseColor: "#8b5a2b" })
      .entity("lonely")
      .build(),
  );
  const detached = cloneDocument(nested);
  const leafId = idByName(detached, "leaf");
  const rootId = idByName(detached, "root");
  const barkId = assetIdByName(detached, "bark");
  expect(leafId !== undefined && rootId !== undefined && barkId !== undefined).toBe(true);
  if (leafId === undefined || rootId === undefined || barkId === undefined) {
    return;
  }
  const leaf = detached.entities[leafId];
  expect(leaf !== undefined).toBe(true);
  if (leaf === undefined) {
    return;
  }
  detached.entities[leafId] = { ...leaf, parent: null };
  const { reader: detachedReader } = createDocument({ snapshot: detached });
  const { reader: nestedReader } = createDocument({ snapshot: nested });
  const scene = new Scene();
  const sync = createRendererSync({ scene });
  sync.rebuild(detachedReader);
  const leafGroup = findEntityGroup(scene, leafId);
  const rootGroup = findEntityGroup(scene, rootId);
  expect(leafGroup !== undefined && rootGroup !== undefined).toBe(true);
  if (leafGroup === undefined || rootGroup === undefined) {
    return;
  }
  expect(leafGroup.parent === rootGroup).toBe(false);
  sync.apply(
    {
      entities: { created: [], deleted: [], updated: [{ id: leafId }] },
      assets: { created: [], deleted: [], updated: [{ id: barkId }] },
    },
    nestedReader,
  );
  expect(leafGroup.parent).toBe(rootGroup);
  sync.apply(
    {
      entities: {
        created: ["e_missing001"],
        deleted: [{ id: "e_missing002" }],
        updated: [{ id: "e_missing003" }],
      },
      assets: {
        created: [barkId],
        deleted: [{ id: "a_missing001" }],
        updated: [{ id: barkId }],
      },
    },
    nestedReader,
  );
  const ghost: Entity = {
    id: "e_ghost00001",
    name: "ghost",
    parent: rootId,
    order: "z",
    enabled: true,
    components: {
      transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    },
  };
  const wrapped: SyncReader = {
    getEntity: (id) => nestedReader.getEntity(id),
    getAsset: (id) => nestedReader.getAsset(id),
    children: (id) =>
      id === rootId ? [...nestedReader.children(id), ghost] : nestedReader.children(id),
    parentChain: (id) => nestedReader.parentChain(id),
    snapshot: () => nestedReader.snapshot(),
  };
  sync.apply(
    {
      entities: { created: [], deleted: [], updated: [{ id: rootId }] },
      assets: { created: [], deleted: [], updated: [] },
    },
    wrapped,
  );
  sync.dispose();
});

test("apply child before parent then relinks after parent exists", () => {
  const snapshot = cloneDocument(
    docBuilder().entity("root").entity("leaf", { parent: "root", mesh: "box" }).build(),
  );
  const leafId = idByName(snapshot, "leaf");
  const rootId = idByName(snapshot, "root");
  expect(leafId !== undefined && rootId !== undefined).toBe(true);
  if (leafId === undefined || rootId === undefined) {
    return;
  }
  const { reader } = createDocument({ snapshot });
  const scene = new Scene();
  const sync = createRendererSync({ scene });
  sync.apply(
    {
      entities: { created: [leafId], deleted: [], updated: [] },
      assets: { created: Object.keys(snapshot.assets), deleted: [], updated: [] },
    },
    reader,
  );
  const earlyLeaf = findEntityGroup(scene, leafId);
  expect(earlyLeaf !== undefined).toBe(true);
  expect(findEntityGroup(scene, rootId)).toBeUndefined();
  sync.apply(
    {
      entities: { created: [rootId], deleted: [], updated: [] },
      assets: { created: [], deleted: [], updated: [] },
    },
    reader,
  );
  const rootGroup = findEntityGroup(scene, rootId);
  expect(earlyLeaf?.parent).toBe(rootGroup);
  sync.dispose();
});

function createdAll(document: Document) {
  return {
    entities: {
      created: Object.keys(document.entities),
      deleted: [],
      updated: [],
    },
    assets: {
      created: Object.keys(document.assets),
      deleted: [],
      updated: [],
    },
  };
}

function findEntity(scene: Scene, id: string) {
  let found: { visible: boolean } | undefined;
  scene.traverse((object) => {
    if (object.userData["entityId"] === id) {
      found = object;
    }
  });
  return found;
}

function findEntityGroup(scene: Scene, id: string): Group | undefined {
  let found: Group | undefined;
  scene.traverse((object) => {
    if (object instanceof Group && object.userData["entityId"] === id) {
      found = object;
    }
  });
  return found;
}

function findKind(scene: Scene, entityId: string, kind: string) {
  const group = findEntityGroup(scene, entityId);
  return group?.children.find((child) => child.userData["tesseraKind"] === kind);
}

function cloneDocument(document: Document): Document {
  const parsed: unknown = JSON.parse(JSON.stringify(document));
  return DocumentSchema.parse(parsed);
}

function idByName(document: Document, name: string): string | undefined {
  return Object.values(document.entities).find((entity) => entity.name === name)?.id;
}

function assetIdByName(document: Document, name: string): string | undefined {
  return Object.values(document.assets).find((asset) => asset.name === name)?.id;
}

function withLight(entity: Entity | undefined, light: Entity["components"]["light"]): Entity {
  expect(entity !== undefined).toBe(true);
  if (entity === undefined) {
    return {
      id: "e_0000000000",
      name: "missing",
      parent: null,
      order: "a",
      enabled: true,
      components: { transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } },
    };
  }
  return {
    ...entity,
    components: {
      ...entity.components,
      light,
    },
  };
}

function withCamera(entity: Entity | undefined, camera: Entity["components"]["camera"]): Entity {
  expect(entity !== undefined).toBe(true);
  if (entity === undefined) {
    return {
      id: "e_0000000000",
      name: "missing",
      parent: null,
      order: "a",
      enabled: true,
      components: { transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } },
    };
  }
  return {
    ...entity,
    components: {
      ...entity.components,
      camera,
    },
  };
}
