import { z } from "zod";
import { AssetIdSchema } from "../ids.js";
import type { InspectorFieldMeta } from "../inspector-field.js";
import { IsoUtcSchema, NameSchema, TagSchema } from "../primitives.js";

const LicenseSchema = z.string().min(1);
export type License = z.infer<typeof LicenseSchema>;

const GeneratorSchema = z.object({
  provider: z
    .string()
    .min(1)
    .meta({
      label: "Provider",
      widget: "text",
      group: "Provenance",
      order: 70,
      description: "Generation provider id",
    } satisfies InspectorFieldMeta),
  model: z
    .string()
    .optional()
    .meta({
      label: "Model",
      widget: "text",
      group: "Provenance",
      order: 80,
      description: "Generation model id",
    } satisfies InspectorFieldMeta),
  promptHash: z
    .string()
    .min(1)
    .meta({
      label: "Prompt hash",
      widget: "text",
      group: "Provenance",
      order: 90,
      description: "sha256 of the generation prompt",
    } satisfies InspectorFieldMeta),
  jobId: z
    .string()
    .min(1)
    .meta({
      label: "Job id",
      widget: "text",
      group: "Provenance",
      order: 100,
      description: "Generation job id",
    } satisfies InspectorFieldMeta),
});

const ProvenanceSchema = z.object({
  source: z
    .string()
    .min(1)
    .meta({
      label: "Source",
      widget: "text",
      group: "Provenance",
      order: 10,
      description: "Where this asset came from",
    } satisfies InspectorFieldMeta),
  sourceId: z
    .string()
    .optional()
    .meta({
      label: "Source id",
      widget: "text",
      group: "Provenance",
      order: 20,
      description: "Id in the source system",
    } satisfies InspectorFieldMeta),
  sourceUrl: z
    .string()
    .optional()
    .meta({
      label: "Source URL",
      widget: "text",
      group: "Provenance",
      order: 30,
      description: "Source locator",
    } satisfies InspectorFieldMeta),
  author: z
    .string()
    .optional()
    .meta({
      label: "Author",
      widget: "text",
      group: "Provenance",
      order: 40,
      description: "Human author",
    } satisfies InspectorFieldMeta),
  importedAt: IsoUtcSchema.meta({
    label: "Imported at",
    widget: "text",
    group: "Provenance",
    order: 50,
    description: "Import timestamp (UTC)",
  } satisfies InspectorFieldMeta),
  generator: GeneratorSchema.optional().meta({
    label: "Generator",
    widget: "json",
    group: "Provenance",
    order: 60,
    description: "Generation metadata when source is generated",
  } satisfies InspectorFieldMeta),
  derivedFrom: z
    .array(AssetIdSchema)
    .optional()
    .meta({
      label: "Derived from",
      widget: "asset",
      group: "Provenance",
      order: 110,
      description: "Parent assets when this asset is derived",
    } satisfies InspectorFieldMeta),
});

export type Provenance = z.infer<typeof ProvenanceSchema>;

export const BlobRefSchema = z.object({
  hash: z
    .string()
    .regex(/^sha256-[0-9a-f]{64}$/)
    .meta({
      label: "Hash",
      widget: "text",
      group: "Blob",
      order: 10,
      description: "Content hash sha256-<hex>",
    } satisfies InspectorFieldMeta),
  size: z
    .number()
    .int()
    .nonnegative()
    .meta({
      label: "Size",
      unit: "B",
      widget: "number",
      group: "Blob",
      order: 20,
      description: "Byte length",
    } satisfies InspectorFieldMeta),
  mime: z
    .string()
    .min(1)
    .meta({
      label: "MIME",
      widget: "text",
      group: "Blob",
      order: 30,
      description: "MIME type",
    } satisfies InspectorFieldMeta),
  fileName: z
    .string()
    .optional()
    .meta({
      label: "File name",
      widget: "text",
      group: "Blob",
      order: 40,
      description: "Original file name",
    } satisfies InspectorFieldMeta),
});

export type BlobRef = z.infer<typeof BlobRefSchema>;

export const AssetBaseSchema = z.object({
  id: AssetIdSchema.meta({
    label: "Id",
    widget: "text",
    group: "Asset",
    order: 1,
    description: "Opaque asset id",
  } satisfies InspectorFieldMeta),
  name: NameSchema.meta({
    label: "Name",
    widget: "text",
    group: "Asset",
    order: 2,
    description: "Human-readable name, unique per kind",
  } satisfies InspectorFieldMeta),
  license: LicenseSchema.meta({
    label: "License",
    widget: "text",
    group: "Asset",
    order: 3,
    description: "SPDX id, proprietary, or unknown",
  } satisfies InspectorFieldMeta),
  provenance: ProvenanceSchema.meta({
    label: "Provenance",
    widget: "json",
    group: "Asset",
    order: 4,
    description: "Import and generation history",
  } satisfies InspectorFieldMeta),
  createdAt: IsoUtcSchema.meta({
    label: "Created at",
    widget: "text",
    group: "Asset",
    order: 5,
    description: "Creation timestamp (UTC)",
  } satisfies InspectorFieldMeta),
  tags: z
    .array(TagSchema)
    .max(32)
    .optional()
    .meta({
      label: "Tags",
      widget: "tags",
      group: "Asset",
      order: 6,
      description: "Asset tags",
    } satisfies InspectorFieldMeta),
});
