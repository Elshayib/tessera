import type { Entity } from "@tessera/schema";
import { emptyDocument } from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import { err, isErr, newId, tesseraError } from "@tessera/std";
import { docBuilder } from "@tessera/testing";
import { expect, test } from "vitest";
import type { WriteContext } from "../command-types.js";
import { createDocument } from "../create-document.js";
import { createDocumentReader } from "../document-reader.js";
import type { DocumentHandle } from "../document-types.js";
import type { DocumentWriter } from "../internal/document-writer.js";
import { createDocumentWriter } from "../internal/document-writer.js";
import { assetCreate, assetDelete, assetUpdate } from "./asset.js";
import { cameraSetMain } from "./camera.js";
import { componentAdd, componentRemove, componentSet } from "./component.js";
import {
  entityCreate,
  entityDelete,
  entityDuplicate,
  entityRename,
  entityReorder,
  entitySetEnabled,
  entitySetParent,
} from "./entity.js";
import { environmentSet } from "./environment.js";
import { materialAssign, materialCreate, materialSet } from "./material.js";
import { metadataSet } from "./metadata.js";
import { settingsSet } from "./settings.js";
import { tagsAdd, tagsRemove } from "./tags.js";
import { transformRotate, transformScale, transformSet, transformTranslate } from "./transform.js";

const author = { kind: "user" as const, id: "tester" };

function fail(): Result<void, TesseraError> {
  return err(tesseraError("CONFLICT", "forced writer fail"));
}

function failingWriter(): DocumentWriter {
  return {
    createEntity: () => fail(),
    updateEntity: () => fail(),
    deleteEntity: () => fail(),
    removeEntityUnchecked: () => fail(),
    createAsset: () => fail(),
    updateAsset: () => fail(),
    deleteAsset: () => fail(),
    upsertBehavior: () => fail(),
    deleteBehavior: () => fail(),
    setEnvironment: () => fail(),
    setSettings: () => fail(),
    setMeta: () => fail(),
  };
}

function overlay(base: DocumentWriter, patch: Partial<DocumentWriter>): DocumentWriter {
  return {
    createEntity: patch.createEntity ?? base.createEntity.bind(base),
    updateEntity: patch.updateEntity ?? base.updateEntity.bind(base),
    deleteEntity: patch.deleteEntity ?? base.deleteEntity.bind(base),
    removeEntityUnchecked: patch.removeEntityUnchecked ?? base.removeEntityUnchecked.bind(base),
    createAsset: patch.createAsset ?? base.createAsset.bind(base),
    updateAsset: patch.updateAsset ?? base.updateAsset.bind(base),
    deleteAsset: patch.deleteAsset ?? base.deleteAsset.bind(base),
    upsertBehavior: patch.upsertBehavior ?? base.upsertBehavior.bind(base),
    deleteBehavior: patch.deleteBehavior ?? base.deleteBehavior.bind(base),
    setEnvironment: patch.setEnvironment ?? base.setEnvironment.bind(base),
    setSettings: patch.setSettings ?? base.setSettings.bind(base),
    setMeta: patch.setMeta ?? base.setMeta.bind(base),
  };
}

function ctx(handle: DocumentHandle, write: DocumentWriter): WriteContext {
  return {
    doc: createDocumentReader(handle.ydoc),
    registry: {},
    clock: handle.clock,
    logger: handle.logger,
    write,
    author,
    transactionId: "t_testtest01",
    run: () => err(tesseraError("UNSUPPORTED", "no nested run")),
    newId: (prefix) => newId(prefix),
  };
}

function seed(handle: DocumentHandle, entity: Entity): void {
  const writer = createDocumentWriter(handle.ydoc);
  handle.ydoc.transact(() => {
    writer.createEntity(entity);
  });
}

test("handlers return writer and missing-target errors without the bus", () => {
  const { doc } = createDocument({ snapshot: emptyDocument() });
  const missing = ctx(doc, createDocumentWriter(doc.ydoc));
  const failed = ctx(doc, failingWriter());
  const gone = "e_zzzzzzzzzz";

  expect(isErr(entityCreate.handle(failed, { name: "oak" }))).toBe(true);
  expect(isErr(entityCreate.handle(missing, { name: "oak", parent: gone }))).toBe(true);
  expect(isErr(entityCreate.handle(missing, { name: "oak", after: gone }))).toBe(true);
  expect(isErr(entityDelete.handle(missing, { target: gone }))).toBe(true);
  expect(isErr(entityDuplicate.handle(missing, { target: gone }))).toBe(true);
  expect(isErr(entityDuplicate.handle(missing, { target: gone, parent: gone }))).toBe(true);
  expect(isErr(entityRename.handle(missing, { target: gone, name: "x" }))).toBe(true);
  expect(isErr(entitySetParent.handle(missing, { target: gone, parent: null }))).toBe(true);
  expect(isErr(entitySetParent.handle(missing, { target: gone, parent: gone }))).toBe(true);
  expect(isErr(entityReorder.handle(missing, { target: gone, after: gone }))).toBe(true);
  expect(isErr(entitySetEnabled.handle(missing, { target: gone, enabled: false }))).toBe(true);
  expect(isErr(componentAdd.handle(missing, { target: gone, type: "camera" }))).toBe(true);
  expect(isErr(componentRemove.handle(missing, { target: gone, type: "camera" }))).toBe(true);
  expect(isErr(componentSet.handle(missing, { target: gone, type: "transform", patch: {} }))).toBe(
    true,
  );
  expect(isErr(transformSet.handle(missing, { target: gone, position: [1, 0, 0] }))).toBe(true);
  expect(isErr(transformTranslate.handle(missing, { target: gone, delta: [1, 0, 0] }))).toBe(true);
  expect(isErr(transformRotate.handle(missing, { target: gone, delta: [0, 90, 0] }))).toBe(true);
  expect(isErr(transformScale.handle(missing, { target: gone, factor: 2 }))).toBe(true);
  expect(isErr(tagsAdd.handle(missing, { target: gone, tags: ["a"] }))).toBe(true);
  expect(isErr(tagsRemove.handle(missing, { target: gone, tags: ["a"] }))).toBe(true);
  expect(isErr(tagsRemove.validate?.(missing, { target: gone, tags: ["a"] }))).toBe(true);
  expect(isErr(environmentSet.handle(missing, { patch: { exposure: 0 } }))).toBe(true);
  expect(isErr(cameraSetMain.handle(missing, { target: gone }))).toBe(true);
  expect(isErr(metadataSet.handle(missing, { target: gone, patch: { k: 1 } }))).toBe(true);
  expect(isErr(cameraSetMain.handle(missing, { target: gone }))).toBe(true);
  expect(isErr(settingsSet.handle(missing, { patch: { mainCamera: gone } }))).toBe(true);
  expect(isErr(materialAssign.handle(missing, { target: gone, material: "a_zzzzzzzzzz" }))).toBe(
    true,
  );
  expect(isErr(materialSet.handle(missing, { target: "a_zzzzzzzzzz", patch: {} }))).toBe(true);
  expect(isErr(assetUpdate.handle(missing, { target: "a_zzzzzzzzzz", patch: {} }))).toBe(true);
  expect(isErr(assetDelete.handle(missing, { target: "a_zzzzzzzzzz" }))).toBe(true);
  expect(isErr(environmentSet.handle(failed, { patch: { exposure: 2 } }))).toBe(true);
  expect(isErr(settingsSet.handle(failed, { patch: { physics: { gravity: [0, -1, 0] } } }))).toBe(
    true,
  );
  expect(isErr(materialCreate.handle(failed, { name: "bark" }))).toBe(true);

  const withAsset = docBuilder().entity("box", { mesh: "box" }).build();
  const { doc: assetDoc } = createDocument({ snapshot: withAsset });
  const assetId = Object.keys(withAsset.assets)[0];
  expect(assetId !== undefined).toBe(true);
  if (assetId === undefined) {
    return;
  }
  const assetCtx = ctx(assetDoc, createDocumentWriter(assetDoc.ydoc));
  const validateUpdate = assetUpdate.validate;
  expect(validateUpdate !== undefined).toBe(true);
  if (validateUpdate === undefined) {
    return;
  }
  expect(isErr(validateUpdate(assetCtx, { target: assetId, patch: { kind: "material" } }))).toBe(
    true,
  );
});

test("handlers fail when writer methods return Err after a live entity exists", () => {
  const { doc } = createDocument({ snapshot: emptyDocument() });
  const live: Entity = {
    id: "e_0000000000",
    name: "oak",
    parent: null,
    order: "a0",
    enabled: true,
    components: { transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } },
  };
  seed(doc, live);
  const writer = overlay(createDocumentWriter(doc.ydoc), {
    updateEntity: () => fail(),
    setSettings: () => fail(),
    removeEntityUnchecked: () => fail(),
    deleteBehavior: () => fail(),
  });
  const writeCtx = ctx(doc, writer);
  expect(isErr(entityRename.handle(writeCtx, { target: live.id, name: "pine" }))).toBe(true);
  expect(isErr(entitySetEnabled.handle(writeCtx, { target: live.id, enabled: false }))).toBe(true);
  expect(isErr(entitySetParent.handle(writeCtx, { target: live.id, parent: null }))).toBe(true);
  expect(isErr(entityReorder.handle(writeCtx, { target: live.id, after: null }))).toBe(true);
  expect(isErr(componentAdd.handle(writeCtx, { target: live.id, type: "camera" }))).toBe(true);
  expect(isErr(transformSet.handle(writeCtx, { target: live.id, position: [1, 0, 0] }))).toBe(true);
  expect(isErr(transformTranslate.handle(writeCtx, { target: live.id, delta: [1, 0, 0] }))).toBe(
    true,
  );
  expect(isErr(transformRotate.handle(writeCtx, { target: live.id, delta: [0, 10, 0] }))).toBe(
    true,
  );
  expect(isErr(transformScale.handle(writeCtx, { target: live.id, factor: 2 }))).toBe(true);
  expect(isErr(tagsAdd.handle(writeCtx, { target: live.id, tags: ["wood"] }))).toBe(true);
  expect(isErr(tagsRemove.handle(writeCtx, { target: live.id, tags: ["wood"] }))).toBe(true);
  expect(isErr(metadataSet.handle(writeCtx, { target: live.id, patch: { k: 1 } }))).toBe(true);
  expect(isErr(entityDelete.handle(writeCtx, { target: live.id }))).toBe(true);
  expect(isErr(componentRemove.handle(writeCtx, { target: live.id, type: "transform" }))).toBe(
    true,
  );
  expect(isErr(cameraSetMain.handle(writeCtx, { target: live.id }))).toBe(true);
  expect(
    isErr(materialAssign.handle(writeCtx, { target: live.id, material: "a_zzzzzzzzzz" })),
  ).toBe(true);
});

test("asset handlers fail when writer returns Err", () => {
  const snapshot = docBuilder().entity("box", { mesh: "box" }).material("bark").build();
  const { doc } = createDocument({ snapshot });
  const geom = Object.values(snapshot.assets).find((asset) => asset.kind === "geometry");
  const mat = Object.values(snapshot.assets).find((asset) => asset.kind === "material");
  expect(geom !== undefined && mat !== undefined).toBe(true);
  if (geom === undefined || mat === undefined) {
    return;
  }
  const writer = overlay(createDocumentWriter(doc.ydoc), {
    deleteAsset: () => fail(),
    updateAsset: () => fail(),
    createAsset: () => fail(),
    updateEntity: () => fail(),
    setEnvironment: () => fail(),
  });
  const writeCtx = ctx(doc, writer);
  expect(isErr(assetDelete.handle(writeCtx, { target: geom.id, force: true }))).toBe(true);
  expect(isErr(assetUpdate.handle(writeCtx, { target: geom.id, patch: { name: "crate" } }))).toBe(
    true,
  );
  expect(
    isErr(materialSet.handle(writeCtx, { target: mat.id, patch: { baseColor: "#111111" } })),
  ).toBe(true);
  const { id: _id, createdAt: _createdAt, ...geomInput } = geom;
  void _id;
  void _createdAt;
  expect(isErr(assetCreate.handle(writeCtx, { asset: { ...geomInput, name: "other" } }))).toBe(
    true,
  );
  expect(isErr(materialCreate.handle(writeCtx, { name: "extra" }))).toBe(true);
});
