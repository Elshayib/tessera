import { emptyDocument } from "@tessera/schema";
import { expect, test } from "vitest";
import type { ChangeSet } from "./change-set.js";
import { summarizeChangeSet } from "./summarize-change-set.js";

function base(): Omit<ChangeSet, "summary"> {
  return {
    entities: { created: [], deleted: [], updated: [] },
    assets: { created: [], deleted: [], updated: [] },
    behaviors: { created: [], deleted: [], updated: [] },
  };
}

test("summarizeChangeSet templates and truncation", () => {
  expect(summarizeChangeSet(base())).toBe("No changes");
  expect(
    summarizeChangeSet({
      ...base(),
      entities: { created: ["e_1"], deleted: [], updated: [] },
    }),
  ).toBe("Created 1 entity");
  expect(
    summarizeChangeSet({
      ...base(),
      entities: {
        created: ["e_1", "e_2"],
        deleted: [emptyEntity()],
        updated: [],
      },
    }),
  ).toContain("Created 2 entities");

  const entity = emptyEntity();
  expect(
    summarizeChangeSet({
      ...base(),
      entities: {
        created: [],
        deleted: [entity],
        updated: [{ id: "e_moved0000", fields: [{ path: "parent", before: null, after: "e_1" }] }],
      },
    }),
  ).toContain("deleted 1 entity");
  expect(
    summarizeChangeSet({
      ...base(),
      entities: {
        created: [],
        deleted: [entity, entity],
        updated: [
          { id: "e_a", fields: [{ path: "parent", before: null, after: "e_1" }] },
          {
            id: "e_b",
            fields: [
              { path: "components.transform.position", before: [0, 0, 0], after: [1, 0, 0] },
            ],
          },
        ],
      },
    }),
  ).toContain("moved 2 entities");
  expect(
    summarizeChangeSet({
      ...base(),
      entities: {
        created: [],
        deleted: [],
        updated: [{ id: "e_name00000", fields: [{ path: "name", before: "a", after: "b" }] }],
      },
    }),
  ).toBe("updated 1 entity");
  expect(
    summarizeChangeSet({
      ...base(),
      entities: {
        created: [],
        deleted: [],
        updated: [
          { id: "e_1", fields: [{ path: "name", before: "a", after: "b" }] },
          { id: "e_2", fields: [{ path: "enabled", before: true, after: false }] },
        ],
      },
    }),
  ).toBe("updated 2 entities");
  expect(
    summarizeChangeSet({
      ...base(),
      assets: { created: ["a_1"], deleted: [], updated: [] },
    }),
  ).toBe("created 1 asset");
  expect(
    summarizeChangeSet({
      ...base(),
      assets: { created: ["a_1", "a_2"], deleted: [textureLike(), textureLike()], updated: [] },
    }),
  ).toContain("created 2 assets");
  expect(
    summarizeChangeSet({
      ...base(),
      assets: {
        created: [],
        deleted: [textureLike()],
        updated: [
          { id: "a_mat", fields: [{ path: "baseColor", before: "#000000", after: "#ffffff" }] },
        ],
      },
    }),
  ).toContain("changed material");
  expect(
    summarizeChangeSet({
      ...base(),
      assets: {
        created: [],
        deleted: [],
        updated: [{ id: "a_other", fields: [{ path: "license", before: "a", after: "b" }] }],
      },
    }),
  ).toBe("updated 1 asset");
  expect(
    summarizeChangeSet({
      ...base(),
      assets: {
        created: [],
        deleted: [],
        updated: [
          { id: "a_1", fields: [{ path: "license", before: "a", after: "b" }] },
          { id: "a_2", fields: [{ path: "license", before: "c", after: "d" }] },
        ],
      },
    }),
  ).toBe("updated 2 assets");
  expect(
    summarizeChangeSet({
      ...base(),
      environment: [{ path: "exposure", before: 1, after: 2 }],
      settings: [{ path: "mainCamera", before: null, after: "e_1" }],
    }),
  ).toBe("changed environment; changed settings");

  const huge = summarizeChangeSet({
    ...base(),
    entities: {
      created: { length: 9e15 },
      deleted: { length: 9e15 },
      updated: [
        { id: "e_x", fields: [{ path: "parent", before: null, after: "e_1" }] },
        { id: "e_y", fields: [{ path: "name", before: "a", after: "b" }] },
      ],
    },
    assets: {
      created: { length: 9e15 },
      deleted: { length: 9e15 },
      updated: [{ id: "a_x", fields: [{ path: "license", before: "a", after: "b" }] }],
    },
    environment: [{ path: "exposure", before: 1, after: 2 }],
    settings: [{ path: "mainCamera", before: null, after: "e_1" }],
  });
  expect(huge.length).toBe(200);
});

function emptyEntity() {
  return {
    id: "e_0000000000",
    name: "x",
    parent: null,
    order: "a0",
    enabled: true,
    components: { transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } },
  };
}

function textureLike() {
  const createdAt = emptyDocument().meta.createdAt;
  return {
    id: "a_0000000000",
    kind: "texture" as const,
    name: "tex",
    license: "unknown",
    provenance: { source: "derived", importedAt: createdAt },
    createdAt,
    blob: {
      hash: "sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      size: 1,
      mime: "image/png",
    },
    colorSpace: "srgb" as const,
    wrapS: "repeat" as const,
    wrapT: "repeat" as const,
    size: [1, 1] as const,
    hasAlpha: false,
  };
}
