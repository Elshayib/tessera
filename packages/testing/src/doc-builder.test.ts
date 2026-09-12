import { validateDocument } from "@tessera/schema";
import { InvariantError } from "@tessera/std";
import { expect, test } from "vitest";
import { docBuilder } from "./index.js";

test("builder produces valid documents", () => {
  const empty = docBuilder().build();
  expect(validateDocument(empty).ok).toBe(true);

  const oak = docBuilder()
    .geometry("oak", {
      type: "cylinder",
      radiusTop: 0.2,
      radiusBottom: 0.25,
      height: 2,
      segments: 16,
    })
    .entity("grove", { transform: { position: [1, 0, 0] } })
    .entity("oak_01", {
      parent: "grove",
      mesh: "oak",
      material: "bark",
      transform: { position: [0, 1, 0], rotation: [0, 15, 0], scale: [1, 1, 1] },
      enabled: true,
    })
    .material("bark", { baseColor: "#8b5a2b", metallic: 0, roughness: 0.8, model: "pbr" })
    .build();
  const report = validateDocument(oak);
  expect(report.issues).toEqual([]);
  expect(report.ok).toBe(true);
  expect(Object.keys(oak.entities).length).toBe(2);
  expect(Object.keys(oak.assets).length).toBe(2);

  const implied = docBuilder().entity("box_01", { mesh: "box" }).build();
  expect(validateDocument(implied).ok).toBe(true);
  expect(Object.keys(implied.assets).length).toBe(1);

  const defaults = docBuilder()
    .geometry("crate")
    .entity("crate_01", {
      mesh: "crate",
      material: "plain",
      transform: { rotation: [0, 5, 0] },
    })
    .material("plain")
    .build();
  expect(validateDocument(defaults).ok).toBe(true);

  const disabled = docBuilder().entity("hidden", { enabled: false }).build();
  expect(validateDocument(disabled).ok).toBe(true);

  const wall = docBuilder().entity("wall").entity("prop").build();
  const wallEntity = Object.values(wall.entities).find((entity) => entity.name === "wall");
  const propEntity = Object.values(wall.entities).find((entity) => entity.name === "prop");
  expect(wallEntity?.order).toBe("a0");
  expect(propEntity?.order).toBe("a1");

  expect(() => docBuilder().entity("a").entity("b", { parent: "missing" })).toThrow(InvariantError);
  expect(() => docBuilder().entity("a").entity("a")).toThrow(InvariantError);
  expect(() => docBuilder().entity("a", { material: "bark" })).toThrow(InvariantError);
  expect(() => docBuilder().geometry("g").geometry("g")).toThrow(InvariantError);
  expect(() => docBuilder().material("m").material("m")).toThrow(InvariantError);
});
