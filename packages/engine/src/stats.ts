import type { ViewportStats } from "./types.js";

/**
 * Renderer counters sampled after a frame (`05` §9).
 *
 * @public
 */
export interface RenderCounters {
  readonly drawCalls: number;
  readonly triangles: number;
  readonly textures: number;
  readonly geometries: number;
  readonly programs: number;
}

/**
 * Builds {@link ViewportStats} from renderer counters and frame time.
 *
 * @example
 * ```ts
 * viewportStats({ drawCalls: 4, triangles: 12, textures: 1, geometries: 2, programs: 1 }, 8);
 * ```
 *
 * @public
 */
export function viewportStats(counters: RenderCounters, frameMs: number): ViewportStats {
  const safeFrame = Math.max(0, frameMs);
  return {
    fps: safeFrame === 0 ? 0 : 1000 / safeFrame,
    frameMs: safeFrame,
    drawCalls: counters.drawCalls,
    triangles: counters.triangles,
    textures: counters.textures,
    geometries: counters.geometries,
    programs: counters.programs,
  };
}
