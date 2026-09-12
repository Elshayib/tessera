import type { InspectorFieldMeta } from "@tessera/schema";
import { EntityIdSchema } from "@tessera/schema";
import { z } from "zod";

const field = (
  label: string,
  widget: InspectorFieldMeta["widget"],
  order: number,
  description: string,
): InspectorFieldMeta => ({
  label,
  widget,
  group: "Export",
  order,
  description,
});

/**
 * Zod schema for {@link GltfExportOptions}, with inspector metadata (`09` §2–§3.1).
 *
 * @public
 */
export const GltfExportOptionsSchema = z.object({
  outputName: z
    .string()
    .min(1)
    .meta(field("Output name", "text", 10, "Basename for the glTF and sidecar files")),
  selection: z
    .array(EntityIdSchema)
    .optional()
    .meta(field("Selection", "entity", 20, "Entity ids to export; omit for the whole document")),
  includeDisabled: z
    .boolean()
    .default(false)
    .meta(field("Include disabled", "toggle", 30, "Export entities with enabled = false")),
  container: z
    .enum(["glb", "gltf"])
    .default("glb")
    .meta(field("Container", "select", 40, "GLB binary or glTF JSON")),
  textures: z
    .enum(["source", "png", "ktx2"])
    .default("source")
    .meta(field("Textures", "select", 50, "Texture encoding: source, png, or ktx2")),
  compression: z
    .enum(["none", "draco", "meshopt"])
    .default("none")
    .meta(
      field(
        "Compression",
        "select",
        60,
        "Mesh compression: none, draco, or meshopt (meshopt unsupported)",
      ),
    ),
  includeColliders: z
    .boolean()
    .default(true)
    .meta(field("Include colliders", "toggle", 70, "Write colliders to extras and the sidecar")),
  includeCameras: z
    .boolean()
    .default(true)
    .meta(field("Include cameras", "toggle", 80, "Export camera components")),
  includeLights: z
    .boolean()
    .default(true)
    .meta(field("Include lights", "toggle", 90, "Export punctual lights")),
  sidecar: z
    .boolean()
    .default(true)
    .meta(field("Sidecar", "toggle", 100, "Write <name>.tessera.json")),
  bakeUnitScale: z
    .number()
    .finite()
    .positive()
    .default(1)
    .meta(
      field("Bake unit scale", "number", 110, "Scale translations; bridges apply engine scale"),
    ),
  deterministic: z
    .boolean()
    .default(false)
    .meta(field("Deterministic", "toggle", 120, "Omit exportedAt for byte-identical output")),
});

/**
 * Parsed {@link GltfExportOptionsSchema} (`09` §3.1, Q-0028).
 *
 * @public
 */
export type GltfExportOptions = z.infer<typeof GltfExportOptionsSchema>;
