/**
 * Agent runtime: probing, roles, tools, and (later) the run loop (`docs/06-agent-runtime.md`).
 *
 * @public
 */
export const PACKAGE_NAME = "@tessera/agent" as const;

export { probeModel } from "./probe.js";
export type { ProbeCache } from "./probe-cache.js";
export { createProbeCache, PROBE_CACHE_TTL_MS } from "./probe-cache.js";
export { resolveRoles } from "./roles.js";
export { DESTRUCTIVE_CONFIRM_SUGGESTION } from "./tools/destructive.js";
export { createToolRegistry } from "./tools/registry.js";
export { selectTools } from "./tools/select.js";
export { suggestionFor } from "./tools/suggestions.js";
export type {
  RunPolicy,
  ToolContext,
  ToolDefinition,
  ToolGroup,
  ToolRegistry,
} from "./tools/types.js";
export type { CapabilityProfile, ResolvedRoles, Role, RoleSources } from "./types.js";
