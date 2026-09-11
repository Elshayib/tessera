import type { ProviderDescriptor } from "@tessera/llm";

/**
 * Built-in provider ids (`07` §4).
 *
 * @public
 */
export const BUILTIN_PROVIDER_IDS = [
  "openai",
  "anthropic",
  "google",
  "xai",
  "deepseek",
  "openrouter",
  "ollama",
  "openai-compatible",
] as const;

/**
 * Provider ids whose origin may be set in Settings (SEC-02, Q-0145).
 *
 * @public
 */
export const ORIGIN_EDITABLE_PROVIDER_ID = "openai-compatible" as const;

function descriptor(
  id: (typeof BUILTIN_PROVIDER_IDS)[number],
  displayName: string,
  auth: "apiKey" | "none",
  listsModels: boolean,
  defaultUrl?: string,
): ProviderDescriptor {
  return {
    id,
    displayName,
    auth,
    baseUrl:
      defaultUrl === undefined
        ? { configurable: true }
        : { default: defaultUrl, configurable: true },
    browserDirect: "yes",
    listsModels,
    docsUrl: "https://example.invalid",
  };
}

/**
 * Spec ids for the settings list when no registry is injected.
 *
 * @public
 */
export const BUILTIN_DESCRIPTORS: readonly ProviderDescriptor[] = [
  descriptor("openai", "OpenAI", "apiKey", true, "https://api.openai.com/v1"),
  descriptor("anthropic", "Anthropic", "apiKey", true, "https://api.anthropic.com"),
  descriptor(
    "google",
    "Google",
    "apiKey",
    true,
    "https://generativelanguage.googleapis.com/v1beta",
  ),
  descriptor("xai", "xAI", "apiKey", true),
  descriptor("deepseek", "DeepSeek", "apiKey", true),
  descriptor("openrouter", "OpenRouter", "apiKey", true, "https://openrouter.ai/api/v1"),
  descriptor("ollama", "Ollama", "none", true, "http://localhost:11434/v1"),
  descriptor("openai-compatible", "OpenAI-compatible", "apiKey", true),
];

/**
 * Origin shown for SEC-02. Built-in entries use their default URL.
 *
 * @public
 */
export function originFor(descriptor: ProviderDescriptor, compatibleOrigin: string): string {
  if (descriptor.id === ORIGIN_EDITABLE_PROVIDER_ID) {
    return compatibleOrigin;
  }
  return descriptor.baseUrl.default ?? "";
}
