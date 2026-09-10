import type { LlmClient, ProviderConfig } from "@tessera/llm";
import { createAiSdkLlmClient } from "./internal/ai-sdk-bridge.js";
import type { LlmClientDeps } from "./llm-client-deps.js";

/**
 * Google Gemini adapter (`07` §4).
 *
 * @public
 */
export function createGoogleClient(config: ProviderConfig, deps: LlmClientDeps): LlmClient {
  return createAiSdkLlmClient("google", config, deps);
}
