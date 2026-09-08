import { z } from "zod";
import { AssetIdSchema } from "./ids.js";
import { HexColorSchema } from "./primitives.js";

export const EnvironmentSchema = z.object({
  sky: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("environment"), asset: AssetIdSchema }),
    z.object({ kind: z.literal("color"), color: HexColorSchema }),
    z.object({ kind: z.literal("none") }),
  ]),
  exposure: z.number().finite().gt(0).max(64).default(1),
  toneMapping: z.enum(["neutral", "aces", "agx", "none"]).default("neutral"),
  fog: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("none") }),
    z.object({
      kind: z.literal("linear"),
      color: HexColorSchema,
      near: z.number().finite(),
      far: z.number().finite(),
    }),
    z.object({
      kind: z.literal("exponential"),
      color: HexColorSchema,
      density: z.number().finite().min(0),
    }),
  ]),
  ambient: z.object({
    color: HexColorSchema.default("#ffffff"),
    intensity: z.number().finite().min(0).default(0.2),
  }),
});

export type Environment = z.infer<typeof EnvironmentSchema>;
