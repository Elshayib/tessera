import { z } from "zod";

const FiniteNumberSchema = z.number().finite();

export const Vec3Schema = z.tuple([FiniteNumberSchema, FiniteNumberSchema, FiniteNumberSchema]);
export type Vec3 = z.infer<typeof Vec3Schema>;

export const Vec2Schema = z.tuple([FiniteNumberSchema, FiniteNumberSchema]);
export type Vec2 = z.infer<typeof Vec2Schema>;

export const HexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/);

export const IsoUtcSchema = z.iso.datetime({ offset: true });

export const NameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[\p{L}\p{N} _.\-()]{1,64}$/u)
  .refine((value) => !value.includes("/"), { message: "names must not contain '/'" });

export const TagSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,31}$/);

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export const JsonObjectSchema = z.record(z.string(), JsonValueSchema);
export type JsonObject = z.infer<typeof JsonObjectSchema>;
