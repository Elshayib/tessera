import type { ModelRef } from "@tessera/llm";

/**
 * Distinct `07` §4 providers used for phase-2 replay (`INV-TST-02`).
 *
 * @public
 */
export const PHASE2_REPLAY_MODELS: readonly ModelRef[] = [
  { providerId: "openai", modelId: "gpt-4o" },
  { providerId: "anthropic", modelId: "claude-sonnet" },
];
