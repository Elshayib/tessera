import type { CheckSceneReader, SpatialCheckResult } from "@tessera/spatial";
import { checkScene } from "@tessera/spatial";

/**
 * Runs `@tessera/spatial` `checkScene` (`06` §8.1).
 *
 * @example
 * ```ts
 * runSpatialVerification(reader, ["e_0000000000"]);
 * ```
 *
 * @public
 */
export function runSpatialVerification(
  reader: CheckSceneReader,
  changedEntities: readonly string[],
): SpatialCheckResult {
  return checkScene(reader, changedEntities);
}
