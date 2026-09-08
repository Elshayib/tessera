import type { LlmClient, ProviderConfig } from "@tessera/llm";
import { createAiSdkLlmClient } from "./internal/ai-sdk-bridge.js";
import type { LlmClientDeps } from "./llm-client-deps.js";

/**
 * User-supplied OpenAI-compatible origin (`07` §4). Requires `baseUrl`.
 *
 * @public
 */
export function createOpenAICompatibleClient(
  config: ProviderConfig,
  deps: LlmClientDeps,
): LlmClient {
  return createAiSdkLlmClient("openai-compatible", config, deps);
}
