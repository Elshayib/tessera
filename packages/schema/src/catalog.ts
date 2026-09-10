import type { CommandSchema, QuerySchema } from "./command-schema.js";
import {
  assetCreateCommand,
  assetDeleteCommand,
  assetImportCommand,
  assetUpdateCommand,
} from "./commands/asset.js";
import { cameraFitCommand, cameraSetMainCommand } from "./commands/camera.js";
import {
  componentAddCommand,
  componentRemoveCommand,
  componentSetCommand,
} from "./commands/component.js";
import {
  entityCreateCommand,
  entityDeleteCommand,
  entityDuplicateCommand,
  entityRenameCommand,
  entityReorderCommand,
  entitySetEnabledCommand,
  entitySetParentCommand,
} from "./commands/entity.js";
import { environmentSetCommand } from "./commands/environment.js";
import {
  layoutAlignToCommand,
  layoutArrangeGridCommand,
  layoutDistributeCommand,
  layoutLookAtCommand,
  layoutPlaceOnCommand,
  layoutResolveOverlapsCommand,
  layoutScatterCommand,
  layoutSnapToGroundCommand,
} from "./commands/layout.js";
import {
  materialAssignCommand,
  materialCreateCommand,
  materialSetCommand,
} from "./commands/material.js";
import { metadataSetCommand } from "./commands/metadata.js";
import { settingsSetCommand } from "./commands/settings.js";
import { tagsAddCommand, tagsRemoveCommand } from "./commands/tags.js";
import {
  transformRotateCommand,
  transformScaleCommand,
  transformSetCommand,
  transformTranslateCommand,
} from "./commands/transform.js";
import { assetGetQuery, assetListQuery } from "./queries/asset.js";
import { entityChildrenQuery, entityGetQuery } from "./queries/entity.js";
import { historyListQuery } from "./queries/history.js";
import {
  sceneDescribeQuery,
  sceneFindQuery,
  sceneMeasureQuery,
  sceneStatsQuery,
} from "./queries/scene.js";

/**
 * Primitive v0.1 commands from `docs/04-command-bus.md` §8.1–8.5.
 */
export const COMMAND_CATALOG: readonly CommandSchema[] = [
  entityCreateCommand,
  entityDeleteCommand,
  entityDuplicateCommand,
  entityRenameCommand,
  entitySetParentCommand,
  entityReorderCommand,
  entitySetEnabledCommand,
  componentAddCommand,
  componentRemoveCommand,
  componentSetCommand,
  transformSetCommand,
  transformTranslateCommand,
  transformRotateCommand,
  transformScaleCommand,
  tagsAddCommand,
  tagsRemoveCommand,
  metadataSetCommand,
  assetCreateCommand,
  assetUpdateCommand,
  assetDeleteCommand,
  materialCreateCommand,
  materialSetCommand,
  materialAssignCommand,
  assetImportCommand,
  environmentSetCommand,
  settingsSetCommand,
  cameraSetMainCommand,
  layoutPlaceOnCommand,
  layoutSnapToGroundCommand,
  layoutAlignToCommand,
  layoutDistributeCommand,
  layoutArrangeGridCommand,
  layoutScatterCommand,
  layoutLookAtCommand,
  layoutResolveOverlapsCommand,
  cameraFitCommand,
];

export type CommandName = (typeof COMMAND_CATALOG)[number]["name"];

/**
 * Headless queries from `docs/04-command-bus.md` §10.
 */
export const QUERY_CATALOG: readonly QuerySchema[] = [
  entityGetQuery,
  entityChildrenQuery,
  sceneDescribeQuery,
  sceneFindQuery,
  sceneStatsQuery,
  sceneMeasureQuery,
  assetGetQuery,
  assetListQuery,
  historyListQuery,
];

export type QueryName = (typeof QUERY_CATALOG)[number]["name"];

/**
 * Engine-backed query names; omitted from {@link QUERY_CATALOG} so headless core skips them.
 */
export const ENGINE_QUERY_NAMES = ["view.screenshot", "scene.raycast", "view.getCamera"] as const;

export type EngineQueryName = (typeof ENGINE_QUERY_NAMES)[number];
