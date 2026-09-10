/**
 * Conservative context-window defaults when the descriptor omits them (`07` §3).
 *
 * @public
 */
export const UNKNOWN_CONTEXT_TOKENS = 32_000;

/**
 * Conservative max output when the descriptor omits it (`07` §3).
 *
 * @public
 */
export const UNKNOWN_MAX_OUTPUT_TOKENS = 4_000;

/**
 * Practical tool-count default (`07` §2).
 *
 * @public
 */
export const DEFAULT_MAX_TOOLS = 64;

/**
 * `INV-PRV-04`: probe any model that is not on the curated descriptor list.
 *
 * @example
 * ```ts
 * needsCapabilityProbe({ inCuratedDescriptorList: false }) === true;
 * ```
 *
 * @public
 */
export function needsCapabilityProbe(input: {
  readonly inCuratedDescriptorList: boolean;
}): boolean {
  return !input.inCuratedDescriptorList;
}

/**
 * Fills missing context / output token limits from `07` §3.
 *
 * @public
 */
export function resolveContextLimits(input: {
  readonly contextTokens?: number;
  readonly maxOutputTokens?: number;
}): { readonly contextTokens: number; readonly maxOutputTokens: number } {
  return {
    contextTokens: input.contextTokens ?? UNKNOWN_CONTEXT_TOKENS,
    maxOutputTokens: input.maxOutputTokens ?? UNKNOWN_MAX_OUTPUT_TOKENS,
  };
}

/**
 * Fills `Capabilities.maxTools` when probing does not measure it (`07` §2).
 *
 * @public
 */
export function withDefaultMaxTools(maxTools: number | undefined): number {
  return maxTools ?? DEFAULT_MAX_TOOLS;
}
