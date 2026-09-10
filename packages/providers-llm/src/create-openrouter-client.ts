import type { LlmClient, ProviderConfig } from "@tessera/llm";
import { createAiSdkLlmClient } from "./internal/ai-sdk-bridge.js";
import type { LlmClientDeps } from "./llm-client-deps.js";

/**
 * OpenRouter adapter; `listModels` fills pricing/context from the catalog (`07` §4).
 *
 * @public
 */
export function createOpenRouterClient(config: ProviderConfig, deps: LlmClientDeps): LlmClient {
  return createAiSdkLlmClient("openrouter", config, deps);
}
