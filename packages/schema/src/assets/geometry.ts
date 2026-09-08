import { z } from "zod";
import { AssetIdSchema } from "../ids.js";
import type { InspectorFieldMeta } from "../inspector-field.js";
import { JsonObjectSchema, Vec2Schema, Vec3Schema } from "../primitives.js";
import { AssetBaseSchema, BlobRefSchema } from "./base.js";

const kindMeta = {
  label: "Kind",
  widget: "select",
  group: "Geometry",
  order: 10,
  description: "Primitive kind",
} as const satisfies InspectorFieldMeta;

const BoxPrimitiveSchema = z.object({
  type: z.literal("box").meta(kindMeta),
  size: Vec3Schema.default([1, 1, 1]).meta({
    label: "Size",
    unit: "m",
    widget: "vec3",
    group: "Geometry",
    order: 20,
    description: "Box extents",
  } satisfies InspectorFieldMeta),
});

const SpherePrimitiveSchema = z.object({
  type: z.literal("sphere").meta(kindMeta),
  radius: z
    .number()
    .finite()
    .positive()
    .default(0.5)
    .meta({
      label: "Radius",
      unit: "m",
      widget: "number",
      group: "Geometry",
      order: 20,
      description: "Sphere radius",
    } satisfies InspectorFieldMeta),
  segments: z
    .number()
    .int()
    .positive()
    .default(32)
    .meta({
      label: "Segments",
      widget: "number",
      group: "Geometry",
      order: 30,
      description: "Tessellation segments",
    } satisfies InspectorFieldMeta),
});

const CylinderPrimitiveSchema = z.object({
  type: z.literal("cylinder").meta(kindMeta),
  radiusTop: z
    .number()
    .finite()
    .nonnegative()
    .default(0.5)
    .meta({
      label: "Radius top",
      unit: "m",
      widget: "number",
      group: "Geometry",
      order: 20,
      description: "Top radius",
    } satisfies InspectorFieldMeta),
  radiusBottom: z
    .number()
    .finite()
    .nonnegative()
    .default(0.5)
    .meta({
      label: "Radius bottom",
      unit: "m",
      widget: "number",
      group: "Geometry",
      order: 30,
      description: "Bottom radius",
    } satisfies InspectorFieldMeta),
  height: z
    .number()
    .finite()
    .positive()
    .default(1)
    .meta({
      label: "Height",
      unit: "m",
      widget: "number",
      group: "Geometry",
      order: 40,
      description: "Cylinder height",
    } satisfies InspectorFieldMeta),
  segments: z
    .number()
    .int()
    .positive()
    .default(32)
    .meta({
      label: "Segments",
      widget: "number",
      group: "Geometry",
      order: 50,
      description: "Tessellation segments",
    } satisfies InspectorFieldMeta),
});

const ConePrimitiveSchema = z.object({
  type: z.literal("cone").meta(kindMeta),
  radius: z
    .number()
    .finite()
    .positive()
    .default(0.5)
    .meta({
      label: "Radius",
      unit: "m",
      widget: "number",
      group: "Geometry",
      order: 20,
      description: "Base radius",
    } satisfies InspectorFieldMeta),
  height: z
    .number()
    .finite()
    .positive()
    .default(1)
    .meta({
      label: "Height",
      unit: "m",
      widget: "number",
      group: "Geometry",
      order: 30,
      description: "Cone height",
    } satisfies InspectorFieldMeta),
  segments: z
    .number()
    .int()
    .positive()
    .default(32)
    .meta({
      label: "Segments",
      widget: "number",
      group: "Geometry",
      order: 40,
      description: "Tessellation segments",
    } satisfies InspectorFieldMeta),
});

const PlanePrimitiveSchema = z.object({
  type: z.literal("plane").meta(kindMeta),
  size: Vec2Schema.default([1, 1]).meta({
    label: "Size",
    unit: "m",
    widget: "vec2",
    group: "Geometry",
    order: 20,
    description: "Plane width and depth",
  } satisfies InspectorFieldMeta),
});

const TorusPrimitiveSchema = z.object({
  type: z.literal("torus").meta(kindMeta),
  radius: z
    .number()
    .finite()
    .positive()
    .default(0.5)
    .meta({
      label: "Radius",
      unit: "m",
      widget: "number",
      group: "Geometry",
      order: 20,
      description: "Ring radius",
    } satisfies InspectorFieldMeta),
  tube: z
    .number()
    .finite()
    .positive()
    .default(0.2)
    .meta({
      label: "Tube",
      unit: "m",
      widget: "number",
      group: "Geometry",
      order: 30,
      description: "Tube radius",
    } satisfies InspectorFieldMeta),
  radialSegments: z
    .number()
    .int()
    .positive()
    .default(16)
    .meta({
      label: "Radial segments",
      widget: "number",
      group: "Geometry",
      order: 40,
      description: "Segments around the ring",
    } satisfies InspectorFieldMeta),
  tubularSegments: z
    .number()
    .int()
    .positive()
    .default(32)
    .meta({
      label: "Tubular segments",
      widget: "number",
      group: "Geometry",
      order: 50,
      description: "Segments around the tube",
    } satisfies InspectorFieldMeta),
});

const CapsulePrimitiveSchema = z.object({
  type: z.literal("capsule").meta(kindMeta),
  radius: z
    .number()
    .finite()
    .positive()
    .default(0.5)
    .meta({
      label: "Radius",
      unit: "m",
      widget: "number",
      group: "Geometry",
      order: 20,
      description: "Capsule radius",
    } satisfies InspectorFieldMeta),
  height: z
    .number()
    .finite()
    .positive()
    .default(1)
    .meta({
      label: "Height",
      unit: "m",
      widget: "number",
      group: "Geometry",
      order: 30,
      description: "Cylinder height excluding caps",
    } satisfies InspectorFieldMeta),
  segments: z
    .number()
    .int()
    .positive()
    .default(16)
    .meta({
      label: "Segments",
      widget: "number",
      group: "Geometry",
      order: 40,
      description: "Tessellation segments",
    } satisfies InspectorFieldMeta),
});

const PrimitiveSchema = z.discriminatedUnion("type", [
  BoxPrimitiveSchema,
  SpherePrimitiveSchema,
  CylinderPrimitiveSchema,
  ConePrimitiveSchema,
  PlanePrimitiveSchema,
  TorusPrimitiveSchema,
  CapsulePrimitiveSchema,
]);

export type Primitive = z.infer<typeof PrimitiveSchema>;

const sourceKindMeta = {
  label: "Source kind",
  widget: "select",
  group: "Source",
  order: 10,
  description: "How geometry is produced",
} as const satisfies InspectorFieldMeta;

const GeometrySourceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("primitive").meta(sourceKindMeta),
    primitive: PrimitiveSchema.meta({
      label: "Primitive",
      widget: "json",
      group: "Source",
      order: 20,
      description: "Analytic primitive",
    } satisfies InspectorFieldMeta),
  }),
  z.object({
    kind: z.literal("blob").meta(sourceKindMeta),
    blob: BlobRefSchema.meta({
      label: "Blob",
      widget: "json",
      group: "Source",
      order: 20,
      description: "glTF or GLB blob",
    } satisfies InspectorFieldMeta),
    meshName: z
      .string()
      .optional()
      .meta({
        label: "Mesh name",
        widget: "text",
        group: "Source",
        order: 30,
        description: "Named mesh inside the blob",
      } satisfies InspectorFieldMeta),
    meshIndex: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .meta({
        label: "Mesh index",
        widget: "number",
        group: "Source",
        order: 40,
        description: "Mesh index inside the blob",
      } satisfies InspectorFieldMeta),
  }),
  z.object({
    kind: z.literal("procedural").meta(sourceKindMeta),
    script: AssetIdSchema.meta({
      label: "Script",
      widget: "asset",
      assetKind: "script",
      group: "Source",
      order: 20,
      description: "Procedural script asset",
    } satisfies InspectorFieldMeta),
    params: JsonObjectSchema.meta({
      label: "Params",
      widget: "json",
      group: "Source",
      order: 30,
      description: "Script parameters",
    } satisfies InspectorFieldMeta),
  }),
]);

export const GeometryAssetSchema = AssetBaseSchema.extend({
  kind: z.literal("geometry").meta({
    label: "Kind",
    widget: "select",
    group: "Asset",
    order: 0,
    description: "Asset kind",
  } satisfies InspectorFieldMeta),
  source: GeometrySourceSchema.meta({
    label: "Source",
    widget: "select",
    group: "Geometry",
    order: 10,
    description: "Primitive, blob, or procedural source",
  } satisfies InspectorFieldMeta),
  bounds: z
    .object({
      min: Vec3Schema.meta({
        label: "Min",
        unit: "m",
        widget: "vec3",
        group: "Bounds",
        order: 10,
        description: "AABB minimum",
      } satisfies InspectorFieldMeta),
      max: Vec3Schema.meta({
        label: "Max",
        unit: "m",
        widget: "vec3",
        group: "Bounds",
        order: 20,
        description: "AABB maximum",
      } satisfies InspectorFieldMeta),
    })
    .meta({
      label: "Bounds",
      widget: "json",
      group: "Geometry",
      order: 20,
      description: "Local-space AABB",
    } satisfies InspectorFieldMeta),
  stats: z
    .object({
      triangles: z
        .number()
        .int()
        .nonnegative()
        .meta({
          label: "Triangles",
          widget: "number",
          group: "Stats",
          order: 10,
          description: "Triangle count",
        } satisfies InspectorFieldMeta),
      vertices: z
        .number()
        .int()
        .nonnegative()
        .meta({
          label: "Vertices",
          widget: "number",
          group: "Stats",
          order: 20,
          description: "Vertex count",
        } satisfies InspectorFieldMeta),
      primitiveGroups: z
        .number()
        .int()
        .nonnegative()
        .meta({
          label: "Primitive groups",
          widget: "number",
          group: "Stats",
          order: 30,
          description: "Material slot count",
        } satisfies InspectorFieldMeta),
    })
    .meta({
      label: "Stats",
      widget: "json",
      group: "Geometry",
      order: 30,
      description: "Mesh statistics",
    } satisfies InspectorFieldMeta),
});

export type GeometryAsset = z.infer<typeof GeometryAssetSchema>;
