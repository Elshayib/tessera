import { emptyDocument } from "@tessera/schema";
import { isErr, isOk } from "@tessera/std";
import { docBuilder } from "@tessera/testing";
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

test("asset.create / update / delete", () => {
  const { doc, reader } = createDocument({ snapshot: emptyDocument() });
  const bus = createCommandBus(doc);
  const input = geometryInput();
  const created = bus.execute("asset.create", { asset: input }, { author });
  expect(isOk(created)).toBe(true);
  if (!created.ok) {
    return;
  }
  const id = created.value.output.id;
  expect(reader.getAsset(id)?.kind).toBe("geometry");
  expect(created.value.transaction.changeSet.assets.created).toContain(id);

  const updated = bus.execute("asset.update", { target: id, patch: { name: "crate" } }, { author });
  expect(isOk(updated)).toBe(true);
  expect(reader.getAsset(id)?.name).toBe("crate");

  const missing = bus.execute("asset.delete", { target: "a_zzzzzzzzzz" }, { author });
  expect(isErr(missing) && missing.error.code === "NOT_FOUND").toBe(true);

  const entity = bus.execute(
    "entity.create",
    {
      name: "mesh",
      components: { meshRenderer: { geometry: id } },
    },
    { author },
  );
  expect(isOk(entity)).toBe(true);
  const blocked = bus.execute("asset.delete", { target: id }, { author });
  expect(isErr(blocked) && blocked.error.code === "CONFLICT").toBe(true);
  const forced = bus.execute("asset.delete", { target: id, force: true }, { author });
  expect(isOk(forced)).toBe(true);
  expect(reader.getAsset(id)).toBeUndefined();
});
