/**
 * Vendor-free language-model interfaces (`docs/07-providers.md` §2).
 *
 * @public
 */
export const PACKAGE_NAME = "@tessera/llm" as const;

export {
  DEFAULT_MAX_TOOLS,
  needsCapabilityProbe,
  resolveContextLimits,
  UNKNOWN_CONTEXT_TOKENS,
  UNKNOWN_MAX_OUTPUT_TOKENS,
  withDefaultMaxTools,
} from "./capabilities.js";
export type { ProviderFailure } from "./map-provider-error.js";
export { mapProviderError } from "./map-provider-error.js";
export {
  assistantText,
  assistantToolCalls,
  systemMessage,
  toolResultMessage,
  userImage,
  userText,
} from "./messages.js";
export type {
  Capabilities,
  ImagePart,
  JsonSchema,
  KeyVault,
  LlmClient,
  LlmClientFactory,
  LlmMessage,
  LlmRequest,
  LlmResponse,
  LlmStreamEvent,
  ModelDescriptor,
  ModelRef,
  ProviderConfig,
  ProviderDescriptor,
  ProviderRegistry,
  TextPart,
  ToolCallPart,
  ToolResultPart,
  ToolSpec,
  Usage,
} from "./types.js";
