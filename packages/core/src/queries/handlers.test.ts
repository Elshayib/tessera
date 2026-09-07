import { isOk } from "@tessera/std";
import { docBuilder } from "@tessera/testing";
import { expect, test } from "vitest";
import { createCommandBus } from "../command-bus.js";
import { createDocument } from "../create-document.js";
import { createUndoService } from "../undo-service.js";
import { createQueryHost } from "./host.js";

const author = { kind: "user" as const, id: "tester" };

test("entity, asset, measure, stats, and history queries", () => {
  const snapshot = docBuilder()
    .entity("oak", { mesh: "box" })
    .entity("pine", { transform: { position: [10, 0, 0] } })
    .build();
  const { doc, reader } = createDocument({ snapshot });
  const undo = createUndoService(doc);
  const bus = createCommandBus(doc, { undo: undo.capture });
  const oak = [...reader.entities()].find((entity) => entity.name === "oak");
  const pine = [...reader.entities()].find((entity) => entity.name === "pine");
  const geom = [...reader.assets("geometry")][0];
  expect(oak !== undefined && pine !== undefined && geom !== undefined).toBe(true);
  if (oak === undefined || pine === undefined || geom === undefined) {
    return;
  }
  expect(isOk(bus.execute("entity.rename", { target: oak.id, name: "oak_01" }, { author }))).toBe(
    true,
  );
  const queries = createQueryHost(doc, { history: () => undo.committed() });
  expect(isOk(queries.query("entity.get", { target: oak.id, includeChildren: true }))).toBe(true);
  expect(isOk(queries.query("entity.children", { target: null }))).toBe(true);
  expect(isOk(queries.query("scene.stats", {}))).toBe(true);
  expect(isOk(queries.query("scene.measure", { a: oak.id, b: pine.id, mode: "distance" }))).toBe(
    true,
  );
  expect(isOk(queries.query("scene.measure", { a: oak.id, mode: "bounds" }))).toBe(true);
  expect(isOk(queries.query("scene.measure", { a: oak.id, b: pine.id, mode: "gap" }))).toBe(true);
  expect(isOk(queries.query("asset.get", { id: geom.id }))).toBe(true);
  expect(isOk(queries.query("asset.list", { kind: "geometry", unused: false }))).toBe(true);
  const history = queries.query("history.list", { limit: 10 });
  expect(isOk(history)).toBe(true);
  if (!history.ok) {
    return;
  }
  expect(Array.isArray(history.value) && history.value.length > 0).toBe(true);
  expect(isOk(queries.query("scene.describe", { detail: "full", includeAssets: true }))).toBe(true);
  expect(isOk(queries.query("scene.find", { within: oak.id, limit: 5 }))).toBe(true);
});
