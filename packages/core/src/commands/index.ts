import type { CommandDefinition } from "../command-types.js";
import { assetCreate, assetDelete, assetUpdate } from "./asset.js";
import { cameraSetMain } from "./camera.js";
import { componentAdd, componentRemove, componentSet } from "./component.js";
import {
  entityCreate,
  entityDelete,
  entityDuplicate,
  entityRename,
  entityReorder,
  entitySetEnabled,
  entitySetParent,
} from "./entity.js";
import { environmentSet } from "./environment.js";
import { materialAssign, materialCreate, materialSet } from "./material.js";
import { metadataSet } from "./metadata.js";
import { settingsSet } from "./settings.js";
import { tagsAdd, tagsRemove } from "./tags.js";
import { transformRotate, transformScale, transformSet, transformTranslate } from "./transform.js";

/**
 * Primitive catalog handlers except `asset.import` (jobs / T-0008).
 *
 * @internal
 */
export const CATALOG_HANDLERS: readonly CommandDefinition[] = [
  entityCreate,
  entityDelete,
  entityDuplicate,
  entityRename,
  entitySetParent,
  entityReorder,
  entitySetEnabled,
  componentAdd,
  componentRemove,
  componentSet,
  transformSet,
  transformTranslate,
  transformRotate,
  transformScale,
  tagsAdd,
  tagsRemove,
  metadataSet,
  assetCreate,
  assetUpdate,
  assetDelete,
  materialCreate,
  materialSet,
  materialAssign,
  environmentSet,
  settingsSet,
  cameraSetMain,
];
