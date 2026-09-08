import { z } from "zod";
import { AssetIdSchema } from "../ids.js";
import type { InspectorFieldMeta } from "../inspector-field.js";

export const MeshRendererSchema = z.object({
  geometry: AssetIdSchema.meta({
    label: "Geometry",
    widget: "asset",
    assetKind: "geometry",
    group: "Mesh",
    order: 10,
    description: "Geometry asset to render",
  } satisfies InspectorFieldMeta),
  materials: z
    .array(AssetIdSchema)
    .max(64)
    .default([])
    .meta({
      label: "Materials",
      widget: "asset",
      assetKind: "material",
      group: "Mesh",
      order: 20,
      description: "Material slots; missing slots reuse the last material",
    } satisfies InspectorFieldMeta),
  castShadow: z
    .boolean()
    .default(true)
    .meta({
      label: "Cast shadow",
      widget: "toggle",
      group: "Mesh",
      order: 30,
      description: "Whether this mesh casts shadows",
    } satisfies InspectorFieldMeta),
  receiveShadow: z
    .boolean()
    .default(true)
    .meta({
      label: "Receive shadow",
      widget: "toggle",
      group: "Mesh",
      order: 40,
      description: "Whether this mesh receives shadows",
    } satisfies InspectorFieldMeta),
  visible: z
    .boolean()
    .default(true)
    .meta({
      label: "Visible",
      widget: "toggle",
      group: "Mesh",
      order: 50,
      description: "Hidden meshes still export",
    } satisfies InspectorFieldMeta),
});

export type MeshRenderer = z.infer<typeof MeshRendererSchema>;
