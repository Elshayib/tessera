import { emptyDocument } from "@tessera/schema";
import { isErr, isOk } from "@tessera/std";
import { docBuilder } from "@tessera/testing";
import { expect, test } from "vitest";
import { createCommandBus } from "../command-bus.js";
import { createDocument } from "../create-document.js";

const author = { kind: "user" as const, id: "tester" };

test("material.create / set / assign", () => {
  const { doc, reader } = createDocument({ snapshot: emptyDocument() });
  const bus = createCommandBus(doc);
  const created = bus.execute("material.create", { name: "bark" }, { author });
  expect(isOk(created)).toBe(true);
  if (!created.ok) {
    return;
  }
  const id = created.value.output.id;
  expect(reader.getAsset(id)?.kind).toBe("material");
  expect(created.value.transaction.changeSet.assets.created).toContain(id);

  const patched = bus.execute(
    "material.set",
    { target: id, patch: { baseColor: "#112233" } },
    { author },
  );
  expect(isOk(patched)).toBe(true);
  const material = reader.getAsset(id);
  expect(material?.kind === "material" && material.baseColor === "#112233").toBe(true);

  expect(
    isErr(bus.execute("material.set", { target: "a_zzzzzzzzzz", patch: {} }, { author })),
  ).toBe(true);

  const built = docBuilder().entity("box", { mesh: "box" }).build();
  const geometry = Object.values(built.assets)[0];
  expect(geometry !== undefined).toBe(true);
  if (geometry === undefined) {
    return;
  }
  const { id: _gid, createdAt: _c, ...geometryInput } = geometry;
  void _gid;
  void _c;
  const geom = bus.execute("asset.create", { asset: geometryInput }, { author });
  expect(isOk(geom)).toBe(true);
  if (!geom.ok) {
    return;
  }
  const entity = bus.execute(
    "entity.create",
    {
      name: "mesh",
      components: { meshRenderer: { geometry: geom.value.output.id } },
    },
    { author },
  );
  expect(isOk(entity)).toBe(true);
  if (!entity.ok) {
    return;
  }
  const assigned = bus.execute(
    "material.assign",
    { target: entity.value.output.id, material: id },
    { author },
  );
  expect(isOk(assigned)).toBe(true);
  if (!assigned.ok) {
    return;
  }
  expect(assigned.value.output.materials).toEqual([id]);
});
