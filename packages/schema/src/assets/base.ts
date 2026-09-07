import { z } from "zod";
import { AssetIdSchema } from "../ids.js";
import { IsoUtcSchema, NameSchema, TagSchema } from "../primitives.js";

const LicenseSchema = z.string().min(1);
export type License = z.infer<typeof LicenseSchema>;

const ProvenanceSchema = z.object({
  source: z.string().min(1),
  sourceId: z.string().optional(),
  sourceUrl: z.string().optional(),
  author: z.string().optional(),
  importedAt: IsoUtcSchema,
  generator: z
    .object({
      provider: z.string().min(1),
      model: z.string().optional(),
      promptHash: z.string().min(1),
      jobId: z.string().min(1),
    })
    .optional(),
  derivedFrom: z.array(AssetIdSchema).optional(),
});

export type Provenance = z.infer<typeof ProvenanceSchema>;

export const BlobRefSchema = z.object({
  hash: z.string().regex(/^sha256-[0-9a-f]{64}$/),
  size: z.number().int().nonnegative(),
  mime: z.string().min(1),
  fileName: z.string().optional(),
});

export type BlobRef = z.infer<typeof BlobRefSchema>;

export const AssetBaseSchema = z.object({
  id: AssetIdSchema,
  name: NameSchema,
  license: LicenseSchema,
  provenance: ProvenanceSchema,
  createdAt: IsoUtcSchema,
  tags: z.array(TagSchema).max(32).optional(),
});
