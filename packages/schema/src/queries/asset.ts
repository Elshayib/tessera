import { z } from "zod";
import { AssetSchema } from "../assets/index.js";
import type { QuerySchema } from "../command-schema.js";
import { AssetIdSchema } from "../ids.js";

const AssetKindSchema = z.enum(["geometry", "material", "texture", "environment", "script"]);

export const assetGetQuery = {
  name: "asset.get",
  description: "Read one asset by id.",
  input: z.object({ id: AssetIdSchema }),
  output: AssetSchema,
  tags: [],
} as const satisfies QuerySchema;

export const assetListQuery = {
  name: "asset.list",
  description: "List assets, optionally filtered by kind or unused status.",
  input: z.object({
    kind: AssetKindSchema.optional(),
    unused: z.boolean().optional(),
  }),
  output: z.array(AssetSchema),
  tags: [],
} as const satisfies QuerySchema;
