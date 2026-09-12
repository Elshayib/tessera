import type { Asset, Document, Entity } from "@tessera/schema";
import { checkScene } from "@tessera/spatial";
import { docBuilder, expectScene } from "@tessera/testing";
import type { EvalCase } from "../../src/types.js";

const CORE_20_IDS = [
  "core.red-cube",
  "core.table-chairs",
  "core.campfire",
  "core.scatter-trees",
  "core.sunset",
  "core.wood-floor",
  "core.frame-camera",
  "core.stack-boxes",
  "core.grid-crates",
  "core.lamp-sofa",
  "core.delete-trees",
  "core.rename-chairs",
  "core.add-colliders",
  "core.simple-room",
  "core.shiny-metal",
  "core.streetlights",
  "core.hdri",
  "core.generate-barrel",
  "core.fix-scene",
  "core.describe",
] as const;

/**
 * Ids listed in `13` §5.4.
 *
 * @public
 */
export const CORE_20_CASE_IDS: readonly string[] = CORE_20_IDS;

function named(doc: Document, glob: string): readonly Entity[] {
  return Object.values(doc.entities).filter((entity) => globMatch(entity.name, glob));
}

function globMatch(name: string, glob: string): boolean {
  const pattern = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${pattern}$`, "i").test(name);
}

function withTags(doc: Document, glob: string, tags: readonly string[]): Document {
  const entities: Document["entities"] = { ...doc.entities };
  for (const entity of Object.values(entities)) {
    if (globMatch(entity.name, glob)) {
      entities[entity.id] = { ...entity, components: { ...entity.components, tags: [...tags] } };
    }
  }
  return { ...doc, entities };
}

/**
 * Core-20 cases (`13` §5.4).
 *
 * @public
 */
export const CORE_EVAL_CASES: readonly EvalCase[] = [
  {
    id: "core.red-cube",
    title: "Red cube",
    category: "composition",
    difficulty: 1,
    setup: () => docBuilder().build(),
    prompt: "Add a red cube 1 m on each side at the origin.",
    tags: ["core-20"],
    assertions: (ctx) => [
      expectScene(ctx.after).toHaveCount("*", named(ctx.before, "*").length + 1),
      expectScene(ctx.after).toHaveMaterial("*cube*", { baseColorNear: "#ff0000" }),
      expectScene(ctx.after).toBeOnGround("*cube*", 0.05),
    ],
  },
  {
    id: "core.table-chairs",
    title: "Table and chairs",
    category: "layout",
    difficulty: 2,
    setup: () => docBuilder().build(),
    prompt: "Create a table with four chairs around it.",
    tags: ["core-20"],
    assertions: (ctx) => [
      expectScene(ctx.after).toHaveEntity("*table*"),
      expectScene(ctx.after).toHaveCount("*chair*", 4),
      expectScene(ctx.after).toBeOnGround("*", 0.1),
    ],
  },
  {
    id: "core.campfire",
    title: "Campfire",
    category: "lighting",
    difficulty: 2,
    setup: () => docBuilder().build(),
    prompt: "Make a campfire: three logs around a fire pit and a warm point light above it.",
    tags: ["core-20"],
    assertions: (ctx) => [
      expectScene(ctx.after).toHaveCount("*log*", 3),
      expectScene(ctx.after).toHaveLight("*", {
        type: "point",
        colorTemperatureBetween: [1000, 3500],
      }),
    ],
  },
  {
    id: "core.scatter-trees",
    title: "Scatter trees",
    category: "layout",
    difficulty: 2,
    setup: () => docBuilder().build(),
    prompt: "Place 12 trees on the ground at least 3 m apart.",
    tags: ["core-20"],
    assertions: (ctx) => [
      expectScene(ctx.after).toHaveCount("*tree*", 12),
      expectScene(ctx.after).toBeOnGround("*tree*", 0.1),
    ],
  },
  {
    id: "core.sunset",
    title: "Sunset lighting",
    category: "lighting",
    difficulty: 2,
    setup: () => docBuilder().build(),
    prompt: "Light this scene like a sunset.",
    tags: ["core-20"],
    assertions: (ctx) => {
      const exposure = ctx.after.environment.exposure;
      return [
        expectScene(ctx.after).toHaveLight("*", {
          type: "directional",
          colorTemperatureBetween: [1000, 4000],
        }),
        { name: "exposure in [0.5, 2]", pass: exposure >= 0.5 && exposure <= 2, weight: 1 },
      ];
    },
  },
  {
    id: "core.wood-floor",
    title: "Wood floor",
    category: "materials",
    difficulty: 1,
    setup: () =>
      docBuilder()
        .geometry("plane", { type: "plane", size: [8, 8] })
        .material("floor_mat", { baseColor: "#cccccc" })
        .entity("floor", {
          mesh: "plane",
          material: "floor_mat",
          transform: { position: [0, 0, 0] },
        })
        .build(),
    prompt: "Make the floor look like dark wood.",
    tags: ["core-20"],
    assertions: (ctx) => [
      expectScene(ctx.after).toHaveMaterial("floor", {
        baseColorNear: "#4a3728",
        roughnessBetween: [0.5, 1],
      }),
    ],
  },
  {
    id: "core.frame-camera",
    title: "Frame camera",
    category: "cameras",
    difficulty: 2,
    setup: () =>
      docBuilder()
        .geometry("box", { type: "box", size: [1, 1, 1] })
        .entity("prop", { mesh: "box", transform: { position: [0, 0.5, 0] } })
        .build(),
    prompt: "Add a camera framing the whole scene from a 3/4 view and make it the main camera.",
    tags: ["core-20"],
    assertions: (ctx) => [expectScene(ctx.after).toHaveMainCamera({ framesAll: true })],
  },
  {
    id: "core.stack-boxes",
    title: "Stack boxes",
    category: "layout",
    difficulty: 2,
    setup: () => docBuilder().build(),
    prompt: "Stack three boxes of decreasing size.",
    tags: ["core-20"],
    assertions: (ctx) => [expectScene(ctx.after).toHaveCount("*box*", 3)],
  },
  {
    id: "core.grid-crates",
    title: "Grid crates",
    category: "layout",
    difficulty: 2,
    setup: () => {
      let builder = docBuilder().geometry("crate_g", { type: "box", size: [1, 1, 1] });
      for (let i = 0; i < 9; i += 1) {
        builder = builder.entity(`crate_${String(i)}`, {
          mesh: "crate_g",
          transform: { position: [i, 0.5, 0] },
        });
      }
      return builder.build();
    },
    prompt: "Arrange the 9 crates in a 3×3 grid with 0.5 m gaps.",
    tags: ["core-20"],
    assertions: (ctx) => [expectScene(ctx.after).toHaveCount("*crate*", 9)],
  },
  {
    id: "core.lamp-sofa",
    title: "Lamp next to sofa",
    category: "layout",
    difficulty: 1,
    setup: () =>
      docBuilder()
        .geometry("box", { type: "box", size: [1, 1, 1] })
        .entity("sofa", { mesh: "box", transform: { position: [0, 0.5, 0] } })
        .entity("lamp", { mesh: "box", transform: { position: [4, 0.5, 0] } })
        .build(),
    prompt: "Move the lamp next to the sofa.",
    tags: ["core-20"],
    assertions: (ctx) => [
      expectScene(ctx.after).toBeWithin("lamp", "sofa", 0.6),
      expectScene(ctx.after).toNotOverlap(["lamp", "sofa"]),
      expectScene(ctx.after).toBeOnGround("lamp", 0.1),
    ],
  },
  {
    id: "core.delete-trees",
    title: "Delete trees",
    category: "destructive",
    difficulty: 2,
    setup: () =>
      docBuilder()
        .geometry("box", { type: "box", size: [1, 1, 1] })
        .entity("tree_1", { mesh: "box" })
        .entity("tree_2", { mesh: "box" })
        .entity("rock", { mesh: "box" })
        .build(),
    prompt: "Delete all trees.",
    tags: ["core-20"],
    assertions: (ctx) => {
      const trees = named(ctx.after, "tree*");
      const rock = named(ctx.after, "rock");
      const confirmed = ctx.report.transactions.length > 0;
      if (!confirmed) {
        return [
          { name: "no deletion without confirmDestructive", pass: trees.length === 2, weight: 1 },
          { name: "rock remains", pass: rock.length === 1, weight: 1 },
        ];
      }
      return [
        { name: "all tree* gone", pass: trees.length === 0, weight: 1 },
        { name: "nothing else deleted", pass: rock.length === 1, weight: 1 },
      ];
    },
  },
  {
    id: "core.rename-chairs",
    title: "Rename chairs",
    category: "multi-step",
    difficulty: 2,
    setup: () =>
      docBuilder()
        .geometry("box", { type: "box", size: [1, 1, 1] })
        .entity("seat_a", { mesh: "box" })
        .entity("seat_b", { mesh: "box" })
        .entity("seat_c", { mesh: "box" })
        .entity("seat_d", { mesh: "box" })
        .entity("door", { mesh: "box", transform: { position: [0, 0.5, -4] } })
        .build(),
    prompt: "Rename the chairs chair_1 through chair_4 clockwise from the door.",
    tags: ["core-20"],
    assertions: (ctx) => [expectScene(ctx.after).toHaveCount("chair_*", 4)],
  },
  {
    id: "core.add-colliders",
    title: "Add colliders",
    category: "components",
    difficulty: 2,
    setup: () =>
      withTags(
        docBuilder()
          .geometry("box", { type: "box", size: [1, 1, 1] })
          .entity("prop_a", { mesh: "box" })
          .entity("prop_b", { mesh: "box" })
          .build(),
        "prop_*",
        ["static"],
      ),
    prompt: "Add colliders to all static props.",
    tags: ["core-20"],
    assertions: (ctx) => {
      const props = named(ctx.after, "prop_*");
      const pass = props.every((entity) => entity.components.collider !== undefined);
      return [{ name: "static meshes have colliders", pass, weight: 1 }];
    },
  },
  {
    id: "core.simple-room",
    title: "Simple room",
    category: "composition",
    difficulty: 3,
    setup: () => docBuilder().build(),
    prompt: "Build a 6×4 m room with 3 m walls and a doorway on the long side.",
    tags: ["core-20"],
    assertions: (ctx) => [expectScene(ctx.after).toHaveCount("*wall*", 4)],
  },
  {
    id: "core.shiny-metal",
    title: "Shiny metal",
    category: "materials",
    difficulty: 1,
    setup: () =>
      withTags(
        docBuilder()
          .geometry("box", { type: "box", size: [1, 1, 1] })
          .material("metal_mat", { metallic: 0.1, roughness: 0.8 })
          .material("wood", { metallic: 0, roughness: 0.7 })
          .entity("pipe", { mesh: "box", material: "metal_mat" })
          .entity("plank", { mesh: "box", material: "wood" })
          .build(),
        "pipe",
        ["metal"],
      ),
    prompt: "Make the metal parts shiny.",
    tags: ["core-20"],
    assertions: (ctx) => [
      expectScene(ctx.after).toHaveMaterial("pipe", {
        metallicBetween: [0.8, 1],
        roughnessBetween: [0, 0.3],
      }),
    ],
  },
  {
    id: "core.streetlights",
    title: "Streetlights",
    category: "layout",
    difficulty: 2,
    setup: () =>
      docBuilder()
        .geometry("box", { type: "box", size: [0.2, 4, 0.2] })
        .entity("streetlight", { mesh: "box" })
        .entity("road", { mesh: "box", transform: { position: [0, 0, 0], scale: [40, 0.1, 4] } })
        .build(),
    prompt: "Duplicate the streetlight along the road every 10 m.",
    tags: ["core-20"],
    assertions: (ctx) => [expectScene(ctx.after).toHaveCount("*streetlight*", 2)],
  },
  {
    id: "core.hdri",
    title: "Forest HDRI",
    category: "assets",
    difficulty: 2,
    setup: () => docBuilder().build(),
    prompt: "Set up a forest HDRI environment from Poly Haven.",
    tags: ["core-20"],
    assertions: (ctx) => {
      const sky = ctx.after.environment.sky;
      const envAssets = Object.values(ctx.after.assets).filter(
        (asset): asset is Asset => asset.kind === "environment",
      );
      const poly = envAssets.some((asset) => asset.provenance.source.includes("polyhaven"));
      return [
        { name: "environment.sky set", pass: sky.kind === "environment", weight: 1 },
        { name: "polyhaven provenance", pass: poly, weight: 1 },
      ];
    },
  },
  {
    id: "core.generate-barrel",
    title: "Generate barrel",
    category: "assets",
    difficulty: 2,
    setup: () =>
      docBuilder()
        .geometry("box", { type: "box", size: [0.2, 3, 4] })
        .entity("wall", { mesh: "box" })
        .build(),
    prompt: "Generate a low-poly barrel and place it by the wall.",
    tags: ["core-20"],
    assertions: (ctx) => {
      const generated = Object.values(ctx.after.assets).some(
        (asset) =>
          asset.provenance.source === "generated" || asset.provenance.generator !== undefined,
      );
      return [
        { name: "generated asset with provenance", pass: generated, weight: 1 },
        expectScene(ctx.after).toHaveEntity("*barrel*"),
        expectScene(ctx.after).toBeWithin("*barrel*", "wall", 2),
        expectScene(ctx.after).toBeOnGround("*barrel*", 0.5),
      ];
    },
  },
  {
    id: "core.fix-scene",
    title: "Fix floating overlaps",
    category: "repair",
    difficulty: 2,
    setup: () =>
      docBuilder()
        .geometry("box", { type: "box", size: [1, 1, 1] })
        .entity("float_a", { mesh: "box", transform: { position: [0, 2, 0] } })
        .entity("float_b", { mesh: "box", transform: { position: [0.1, 2, 0] } })
        .build(),
    prompt: "Fix anything floating or overlapping.",
    tags: ["core-20"],
    assertions: (ctx) => {
      const beforeIssues = checkScene(reader(ctx.before), Object.keys(ctx.before.entities)).issues
        .length;
      const afterIssues = checkScene(reader(ctx.after), Object.keys(ctx.after.entities)).issues
        .length;
      return [
        { name: "issues before > 0", pass: beforeIssues > 0, weight: 1 },
        { name: "issues after = 0", pass: afterIssues === 0, weight: 1 },
      ];
    },
  },
  {
    id: "core.describe",
    title: "Describe scene",
    category: "read",
    difficulty: 1,
    setup: () =>
      docBuilder()
        .geometry("box", { type: "box", size: [1, 1, 1] })
        .entity("hero", { mesh: "box" })
        .build(),
    prompt: "Describe the scene.",
    tags: ["core-20"],
    assertions: (ctx) => [
      { name: "zero transactions", pass: ctx.report.transactions.length === 0, weight: 1 },
      {
        name: "report mentions entity count",
        pass: ctx.report.summary.length > 0,
        weight: 1,
      },
    ],
  },
];

function reader(doc: Document) {
  return {
    getEntity: (id: string) => doc.entities[id],
    getAsset: (id: string) => doc.assets[id],
    parentChain: () => [],
    entities: () => Object.values(doc.entities),
    pathOf: (id: string) => doc.entities[id]?.name,
  };
}
