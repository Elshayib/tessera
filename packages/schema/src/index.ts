export type { BlobRef, License, Provenance } from "./assets/base.js";
export type { EnvironmentAsset } from "./assets/environment.js";
export type { GeometryAsset, Primitive } from "./assets/geometry.js";
export type { Asset } from "./assets/index.js";
export { AssetSchema } from "./assets/index.js";
export type { MaterialAsset, TextureSlot } from "./assets/material.js";
export { MaterialAssetSchema } from "./assets/material.js";
export type { ScriptAsset } from "./assets/script.js";
export type { TextureAsset } from "./assets/texture.js";
export type { Aabb } from "./bounds-primitives.js";
export { primitiveBounds } from "./bounds-primitives.js";
export { canonicalize } from "./canonicalize.js";
export type { CommandName, EngineQueryName, QueryName } from "./catalog.js";
export { COMMAND_CATALOG, ENGINE_QUERY_NAMES, QUERY_CATALOG } from "./catalog.js";
export type { CommandSchema, QuerySchema } from "./command-schema.js";
export {
  assetCreateCommand,
  assetDeleteCommand,
  assetImportCommand,
  assetUpdateCommand,
} from "./commands/asset.js";
export { cameraSetMainCommand } from "./commands/camera.js";
export type { ComponentType, EntityRef } from "./commands/common.js";
export { COMPONENT_TYPES, ComponentTypeSchema, EntityRefSchema } from "./commands/common.js";
export {
  componentAddCommand,
  componentRemoveCommand,
  componentSetCommand,
} from "./commands/component.js";
export {
  entityCreateCommand,
  entityDeleteCommand,
  entityDuplicateCommand,
  entityRenameCommand,
  entityReorderCommand,
  entitySetEnabledCommand,
  entitySetParentCommand,
} from "./commands/entity.js";
export { environmentSetCommand } from "./commands/environment.js";
export {
  materialAssignCommand,
  materialCreateCommand,
  materialSetCommand,
} from "./commands/material.js";
export { metadataSetCommand } from "./commands/metadata.js";
export { settingsSetCommand } from "./commands/settings.js";
export { tagsAddCommand, tagsRemoveCommand } from "./commands/tags.js";
export {
  transformRotateCommand,
  transformScaleCommand,
  transformSetCommand,
  transformTranslateCommand,
} from "./commands/transform.js";
export type { Camera } from "./components/camera.js";
export { CameraSchema } from "./components/camera.js";
export type { Collider } from "./components/collider.js";
export { ColliderSchema } from "./components/collider.js";
export type { Components } from "./components/index.js";
export { ComponentsSchema } from "./components/index.js";
export type { Light } from "./components/light.js";
export { LightSchema } from "./components/light.js";
export type { MeshRenderer } from "./components/mesh-renderer.js";
export { MeshRendererSchema } from "./components/mesh-renderer.js";
export type { Metadata } from "./components/metadata.js";
export { MetadataSchema } from "./components/metadata.js";
export { RESERVED_COMPONENT_NAMES } from "./components/reserved.js";
export type { RigidBody } from "./components/rigid-body.js";
export { RigidBodySchema } from "./components/rigid-body.js";
export type { Tags } from "./components/tags.js";
export { TagsSchema } from "./components/tags.js";
export type { Transform } from "./components/transform.js";
export { TransformSchema } from "./components/transform.js";
export { DEFAULT_LIGHT_INTENSITY, emptyDocument } from "./defaults.js";
export type { Behavior, Document, DocumentMeta, Settings } from "./document.js";
export { DOCUMENT_VERSION, DocumentSchema } from "./document.js";
export type { Entity } from "./entity.js";
export { EntitySchema } from "./entity.js";
export type { Environment } from "./environment.js";
export { EnvironmentSchema } from "./environment.js";
export type { AssetId, BehaviorId, EntityId, ProjectId } from "./ids.js";
export {
  AssetIdSchema,
  BehaviorIdSchema,
  EntityIdSchema,
  ProjectIdSchema,
} from "./ids.js";
export type { InspectorAssetKind, InspectorFieldMeta, InspectorWidget } from "./inspector-meta.js";
export { INSPECTOR_WIDGETS } from "./inspector-meta.js";
export type { EmittedJsonSchema } from "./json-schema.js";
export { emitJsonSchema } from "./json-schema.js";
export { migrate } from "./migrations/index.js";
export type { JsonObject, JsonValue, Vec2, Vec3 } from "./primitives.js";
export { HexColorSchema, NameSchema, Vec2Schema, Vec3Schema } from "./primitives.js";
export { assetGetQuery, assetListQuery } from "./queries/asset.js";
export { entityChildrenQuery, entityGetQuery } from "./queries/entity.js";
export { historyListQuery } from "./queries/history.js";
export {
  sceneDescribeQuery,
  sceneFindQuery,
  sceneMeasureQuery,
  sceneStatsQuery,
} from "./queries/scene.js";
export type {
  Sidecar,
  SidecarAsset,
  SidecarCollider,
  SidecarEntity,
  SidecarEnvironment,
} from "./sidecar.js";
export {
  emitSidecarJsonSchema,
  emitSidecarJsonSchemaText,
  SIDECAR_FORMAT,
  SIDECAR_VERSION,
  SidecarSchema,
} from "./sidecar.js";
export type { DocumentInvariant, ValidationIssue, ValidationReport } from "./validate.js";
export { validateDocument } from "./validate.js";
