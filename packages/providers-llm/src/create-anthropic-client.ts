import type { LlmClient, ProviderConfig } from "@tessera/llm";
import { createAiSdkLlmClient } from "./internal/ai-sdk-bridge.js";
import type { LlmClientDeps } from "./llm-client-deps.js";

/**
 * Anthropic adapter. Sets `anthropic-dangerous-direct-browser-access` (`07` §5).
 *
 * @public
 */
export function createAnthropicClient(config: ProviderConfig, deps: LlmClientDeps): LlmClient {
  return createAiSdkLlmClient("anthropic", config, deps);
}
