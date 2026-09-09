/**
 * Agent runtime: probing, roles, tools, and the observe-plan-act loop (`docs/06-agent-runtime.md`).
 *
 * @public
 */
export const PACKAGE_NAME = "@tessera/agent" as const;

export { compactValue, contextBudget } from "./compact.js";
export { parseJsonModeTools } from "./json-mode.js";
export { defaultRunPolicy, mergeRunPolicy } from "./policy.js";
export { probeModel } from "./probe.js";
export type { ProbeCache } from "./probe-cache.js";
export { createProbeCache, PROBE_CACHE_TTL_MS } from "./probe-cache.js";
export { resolveRoles } from "./roles.js";
export type { RunEvent, RunReport, RunRequest } from "./run-types.js";
export type { AgentRuntime } from "./runtime.js";
export { createAgentRuntime } from "./runtime.js";
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
export { wrapUntrusted } from "./untrusted.js";
export type { Verifier } from "./verifier.js";
export { createSkipVerifier } from "./verifier.js";
