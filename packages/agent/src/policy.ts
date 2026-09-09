import type { RunPolicy } from "./tools/types.js";
import type { CapabilityProfile } from "./types.js";

/**
 * Phase-2 {@link RunPolicy} defaults (`06` §3, Q-0126).
 *
 * @example
 * ```ts
 * defaultRunPolicy(profile, false).enabledTiers;
 * ```
 *
 * @public
 */
export function defaultRunPolicy(profile: CapabilityProfile, criticHasVision: boolean): RunPolicy {
  const verify = criticHasVision && profile.vision ? "spatial+vision" : "spatial";
  return {
    enabledTiers: [0, 1, 2],
    maxSteps: 24,
    maxToolCallsPerStep: 16,
    maxInputTokens: 400_000,
    timeoutMs: 600_000,
    verify,
    maxRepairRounds: 2,
    confirmDestructive: false,
    temperature: 0.2,
  };
}

/**
 * Merges request overrides onto defaults.
 *
 * @public
 */
export function mergeRunPolicy(base: RunPolicy, patch: Partial<RunPolicy> | undefined): RunPolicy {
  if (patch === undefined) {
    return base;
  }
  return {
    enabledTiers: patch.enabledTiers ?? base.enabledTiers,
    maxSteps: patch.maxSteps ?? base.maxSteps,
    maxToolCallsPerStep: patch.maxToolCallsPerStep ?? base.maxToolCallsPerStep,
    maxInputTokens: patch.maxInputTokens ?? base.maxInputTokens,
    timeoutMs: patch.timeoutMs ?? baseTimeout(patch, base),
    verify: patch.verify ?? base.verify,
    maxRepairRounds: patch.maxRepairRounds ?? base.maxRepairRounds,
    confirmDestructive: patch.confirmDestructive ?? base.confirmDestructive,
    temperature: patch.temperature ?? base.temperature,
    ...(patch.maxEstimatedCostUsd === undefined && base.maxEstimatedCostUsd === undefined
      ? {}
      : { maxEstimatedCostUsd: patch.maxEstimatedCostUsd ?? base.maxEstimatedCostUsd }),
  };
}

function baseTimeout(patch: Partial<RunPolicy>, base: RunPolicy): number {
  return patch.timeoutMs ?? base.timeoutMs;
}
