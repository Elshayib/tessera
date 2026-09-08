import type { LlmClient, ProviderConfig } from "@tessera/llm";
import { createAiSdkLlmClient } from "./internal/ai-sdk-bridge.js";
import type { LlmClientDeps } from "./llm-client-deps.js";

/**
 * DeepSeek adapter via official `@ai-sdk/deepseek` (Q-0117).
 *
 * @public
 */
export function createDeepSeekClient(config: ProviderConfig, deps: LlmClientDeps): LlmClient {
  return createAiSdkLlmClient("deepseek", config, deps);
}
