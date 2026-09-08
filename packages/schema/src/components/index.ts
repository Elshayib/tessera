import { z } from "zod";
import { CameraSchema } from "./camera.js";
import { ColliderSchema } from "./collider.js";
import { LightSchema } from "./light.js";
import { MeshRendererSchema } from "./mesh-renderer.js";
import { MetadataSchema } from "./metadata.js";
import { RigidBodySchema } from "./rigid-body.js";
import { TagsSchema } from "./tags.js";
import { TransformSchema } from "./transform.js";

export const ComponentsSchema = z.object({
  transform: TransformSchema,
  meshRenderer: MeshRendererSchema.optional(),
  light: LightSchema.optional(),
  camera: CameraSchema.optional(),
  collider: ColliderSchema.optional(),
  rigidBody: RigidBodySchema.optional(),
  tags: TagsSchema.optional(),
  metadata: MetadataSchema.optional(),
});

export type Components = z.infer<typeof ComponentsSchema>;
