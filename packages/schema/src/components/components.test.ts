import { expect, test } from "vitest";
import { ColliderSchema } from "./collider.js";
import { MeshRendererSchema } from "./mesh-renderer.js";
import { RigidBodySchema } from "./rigid-body.js";
import { TagsSchema } from "./tags.js";

test("collider enum default", () => {
  expect(ColliderSchema.parse({}).shape).toBe("box");
});

test("meshRenderer materials default", () => {
  expect(MeshRendererSchema.parse({ geometry: "a_aaaaaaaaaa" }).materials).toEqual([]);
});

test("rigidBody enum default", () => {
  expect(RigidBodySchema.parse({}).type).toBe("static");
  expect(RigidBodySchema.safeParse({ mass: 0 }).success).toBe(false);
});

test("tags pattern", () => {
  expect(TagsSchema.parse(["oak", "prop_01"])).toEqual(["oak", "prop_01"]);
  expect(TagsSchema.safeParse(["Bad"]).success).toBe(false);
});
