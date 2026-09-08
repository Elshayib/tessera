import type {
  Asset,
  AssetId,
  BlobRef,
  Components,
  EntityId,
  EntityRef,
  Vec3,
} from "@tessera/schema";

/**
 * Hard blob reject from the archive entry cap (`08` §7.1, `03` §12, Q-0050).
 *
 * @public
 */
export const HARD_BLOB_LIMIT_BYTES = 50 * 1024 * 1024;

/**
 * Triangle-count warning threshold (`08` §7.1).
 *
 * @public
 */
export const IMPORT_TRIANGLE_WARN_COUNT = 2_000_000;

/**
 * Planned asset payload. `id` is a temporary handle remapped by `commitPlan` (`08` §7.5, Q-0051).
 *
 * @public
 */
export type AssetInput = Asset extends infer Item
  ? Item extends { createdAt: string }
    ? Omit<Item, "createdAt">
    : never
  : never;

/**
 * Proposed entity in an {@link ImportPlan} (`08` §7.5, Q-0051).
 *
 * @public
 */
export interface EntityInput {
  readonly id: EntityId;
  readonly name: string;
  readonly parent: EntityId | null;
  readonly components?: Partial<Components>;
}

/**
 * Worker output committed through the command bus in one transaction (`INV-AST-02`).
 *
 * @public
 */
export interface ImportPlan {
  readonly blobs: readonly BlobRef[];
  readonly assets: readonly AssetInput[];
  readonly entities?: readonly EntityInput[];
  readonly warnings: readonly string[];
  readonly attribution?: string;
}

/**
 * Options for `commitPlan` (`08` §7.5).
 *
 * @public
 */
export interface CommitPlanOptions {
  readonly parent?: EntityRef;
  readonly position?: Vec3;
  readonly author: {
    readonly kind: "user" | "agent" | "remote" | "system";
    readonly id: string;
    readonly runId?: string;
  };
}

/**
 * Result of a successful `commitPlan` (ids only; the transaction record lives on the service).
 *
 * @public
 */
export interface CommitPlanIds {
  readonly assetIds: readonly AssetId[];
  readonly entityIds: readonly EntityId[];
}
