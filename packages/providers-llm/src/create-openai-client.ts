import type { LlmClient, ProviderConfig } from "@tessera/llm";
import { createAiSdkLlmClient } from "./internal/ai-sdk-bridge.js";
import type { LlmClientDeps } from "./llm-client-deps.js";

/**
 * OpenAI Responses API adapter (`07` §4).
 *
 * @example
 * ```ts
 * createOpenAIClient({ providerId: "openai", apiKeyRef: "k" }, deps);
 * ```
 *
 * @public
 */
export function createOpenAIClient(config: ProviderConfig, deps: LlmClientDeps): LlmClient {
  return createAiSdkLlmClient("openai", config, deps);
}
