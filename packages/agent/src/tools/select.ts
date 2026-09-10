import type { CapabilityProfile } from "../types.js";
import type { RunPolicy, ToolDefinition, ToolGroup, ToolRegistry } from "./types.js";

const CATALOG_MODE_GROUPS: ReadonlySet<ToolGroup> = new Set(["entities", "components", "layout"]);

/**
 * Progressive disclosure (`06` §5).
 *
 * Always includes tier 0 and meta-tools. When `profile.maxTools ≥ 40`, includes
 * every remaining tool in enabled tiers 0–2. Otherwise catalog mode: `entities`,
 * `components`, `layout`, plus groups enabled via `tools.enable`.
 *
 * @example
 * ```ts
 * selectTools(registry, policy, profile);
 * ```
 *
 * @public
 */
export function selectTools(
  registry: ToolRegistry,
  policy: RunPolicy,
  profile: CapabilityProfile,
): readonly ToolDefinition[] {
  const extra = registry.enabledGroups();
  const tiers = new Set(policy.enabledTiers);
  return registry.list().filter((tool) => {
    if (tool.tier > 2) {
      return false;
    }
    if (tool.group === "meta" || tool.tier === 0) {
      return true;
    }
    if (!tiers.has(tool.tier)) {
      return false;
    }
    if (profile.maxTools >= 40) {
      return true;
    }
    if (CATALOG_MODE_GROUPS.has(tool.group)) {
      return true;
    }
    return extra.has(tool.group);
  });
}
