/**
 * AI SDK implementations of `@tessera/llm` (`docs/07-providers.md` §4).
 *
 * @public
 */
export const PACKAGE_NAME = "@tessera/providers-llm" as const;

export { createAnthropicClient } from "./create-anthropic-client.js";
export { createDeepSeekClient } from "./create-deepseek-client.js";
export { createGoogleClient } from "./create-google-client.js";
export { createOllamaClient } from "./create-ollama-client.js";
export { createOpenAIClient } from "./create-openai-client.js";
export { createOpenAICompatibleClient } from "./create-openai-compatible-client.js";
export { createOpenRouterClient } from "./create-openrouter-client.js";
export { createXaiClient } from "./create-xai-client.js";
export {
  ANTHROPIC_BROWSER_HEADER,
  ANTHROPIC_DESCRIPTOR,
  DEEPSEEK_DESCRIPTOR,
  GOOGLE_DESCRIPTOR,
  OLLAMA_DESCRIPTOR,
  OPENAI_COMPATIBLE_DESCRIPTOR,
  OPENAI_DESCRIPTOR,
  OPENROUTER_DESCRIPTOR,
  XAI_DESCRIPTOR,
} from "./descriptors.js";
export type { LlmClientDeps } from "./llm-client-deps.js";
export { isRetryableProviderError, retryDelayMs, withProviderRetries } from "./retries.js";
