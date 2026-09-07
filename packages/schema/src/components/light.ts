import { z } from "zod";
import type { InspectorFieldMeta } from "../inspector-field.js";
import { HexColorSchema } from "../primitives.js";

const typeMeta = {
  label: "Type",
  widget: "select",
  group: "Light",
  order: 10,
  description: "Light kind",
} as const satisfies InspectorFieldMeta;

const colorMeta = {
  label: "Color",
  widget: "color",
  group: "Light",
  order: 20,
  description: "sRGB light color",
} as const satisfies InspectorFieldMeta;

const shadowMeta = {
  label: "Cast shadow",
  widget: "toggle",
  group: "Light",
  order: 80,
  description: "Whether this light casts shadows",
} as const satisfies InspectorFieldMeta;

const LightBaseSchema = z.object({
  color: HexColorSchema.default("#ffffff").meta(colorMeta),
});

const DirectionalLightSchema = LightBaseSchema.extend({
  type: z.literal("directional").meta(typeMeta),
  intensity: z
    .number()
    .finite()
    .min(0)
    .default(3)
    .meta({
      label: "Intensity",
      unit: "lx",
      widget: "number",
      group: "Light",
      order: 30,
      description: "Illuminance",
    } satisfies InspectorFieldMeta),
  castShadow: z.boolean().default(true).meta(shadowMeta),
});

const PointLightSchema = LightBaseSchema.extend({
  type: z.literal("point").meta(typeMeta),
  intensity: z
    .number()
    .finite()
    .min(0)
    .default(100)
    .meta({
      label: "Intensity",
      unit: "cd",
      widget: "number",
      group: "Light",
      order: 30,
      description: "Luminous intensity",
    } satisfies InspectorFieldMeta),
  range: z
    .number()
    .finite()
    .min(0)
    .default(0)
    .meta({
      label: "Range",
      unit: "m",
      widget: "number",
      group: "Light",
      order: 40,
      description: "Attenuation range; 0 is infinite",
    } satisfies InspectorFieldMeta),
  castShadow: z.boolean().default(false).meta(shadowMeta),
});

const SpotLightSchema = LightBaseSchema.extend({
  type: z.literal("spot").meta(typeMeta),
  intensity: z
    .number()
    .finite()
    .min(0)
    .default(200)
    .meta({
      label: "Intensity",
      unit: "cd",
      widget: "number",
      group: "Light",
      order: 30,
      description: "Luminous intensity",
    } satisfies InspectorFieldMeta),
  range: z
    .number()
    .finite()
    .min(0)
    .default(0)
    .meta({
      label: "Range",
      unit: "m",
      widget: "number",
      group: "Light",
      order: 40,
      description: "Attenuation range; 0 is infinite",
    } satisfies InspectorFieldMeta),
  angle: z
    .number()
    .finite()
    .gt(0)
    .lt(90)
    .default(30)
    .meta({
      label: "Angle",
      unit: "°",
      step: 1,
      widget: "slider",
      group: "Light",
      order: 50,
      description: "Outer cone half-angle",
    } satisfies InspectorFieldMeta),
  penumbra: z
    .number()
    .finite()
    .min(0)
    .max(1)
    .default(0.2)
    .meta({
      label: "Penumbra",
      step: 0.01,
      widget: "slider",
      group: "Light",
      order: 60,
      description: "Soft edge of the spot cone",
    } satisfies InspectorFieldMeta),
  castShadow: z.boolean().default(false).meta(shadowMeta),
});

const AreaLightSchema = LightBaseSchema.extend({
  type: z.literal("area").meta(typeMeta),
  intensity: z
    .number()
    .finite()
    .min(0)
    .default(5)
    .meta({
      label: "Intensity",
      unit: "nt",
      widget: "number",
      group: "Light",
      order: 30,
      description: "Luminance",
    } satisfies InspectorFieldMeta),
  size: z
    .tuple([z.number().finite().positive(), z.number().finite().positive()])
    .default([1, 1])
    .meta({
      label: "Size",
      unit: "m",
      widget: "vec2",
      group: "Light",
      order: 40,
      description: "Rectangle width and height",
    } satisfies InspectorFieldMeta),
  castShadow: z.literal(false).default(false).meta(shadowMeta),
});

export const LightSchema = z.discriminatedUnion("type", [
  DirectionalLightSchema,
  PointLightSchema,
  SpotLightSchema,
  AreaLightSchema,
]);

export type Light = z.infer<typeof LightSchema>;
