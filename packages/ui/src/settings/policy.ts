/**
 * Settings RunPolicy defaults (`06` §3, Q-0126).
 *
 * @public
 */
export const SETTINGS_RUN_POLICY_DEFAULTS = {
  enabledTiers: [0, 1, 2] as const,
  maxSteps: 24,
  maxToolCallsPerStep: 16,
  maxInputTokens: 400_000,
  timeoutMs: 600_000,
  verify: "spatial" as const,
  maxRepairRounds: 2,
  confirmDestructive: false,
  temperature: 0.2,
};
