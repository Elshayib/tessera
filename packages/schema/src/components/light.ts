import { z } from "zod";
import { HexColorSchema } from "../primitives.js";

const LightBaseSchema = z.object({
  color: HexColorSchema.default("#ffffff"),
});

const DirectionalLightSchema = LightBaseSchema.extend({
  type: z.literal("directional"),
  intensity: z.number().finite().min(0).default(3),
  castShadow: z.boolean().default(true),
});

const PointLightSchema = LightBaseSchema.extend({
  type: z.literal("point"),
  intensity: z.number().finite().min(0).default(100),
  range: z.number().finite().min(0).default(0),
  castShadow: z.boolean().default(false),
});

const SpotLightSchema = LightBaseSchema.extend({
  type: z.literal("spot"),
  intensity: z.number().finite().min(0).default(200),
  range: z.number().finite().min(0).default(0),
  angle: z.number().finite().gt(0).lt(90).default(30),
  penumbra: z.number().finite().min(0).max(1).default(0.2),
  castShadow: z.boolean().default(false),
});

const AreaLightSchema = LightBaseSchema.extend({
  type: z.literal("area"),
  intensity: z.number().finite().min(0).default(5),
  size: z.tuple([z.number().finite().positive(), z.number().finite().positive()]).default([1, 1]),
  castShadow: z.literal(false).default(false),
});

export const LightSchema = z.discriminatedUnion("type", [
  DirectionalLightSchema,
  PointLightSchema,
  SpotLightSchema,
  AreaLightSchema,
]);

export type Light = z.infer<typeof LightSchema>;
