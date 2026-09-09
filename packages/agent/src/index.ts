/**
 * Agent runtime: probing, roles, and (later) the run loop (`docs/06-agent-runtime.md`).
 *
 * @public
 */
export const PACKAGE_NAME = "@tessera/agent" as const;

export { probeModel } from "./probe.js";
export type { ProbeCache } from "./probe-cache.js";
export { createProbeCache, PROBE_CACHE_TTL_MS } from "./probe-cache.js";
export { resolveRoles } from "./roles.js";
export type { CapabilityProfile, ResolvedRoles, Role, RoleSources } from "./types.js";
