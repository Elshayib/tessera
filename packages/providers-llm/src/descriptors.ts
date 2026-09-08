import type { ProviderDescriptor } from "@tessera/llm";

const OPENAI_DOCS = "https://platform.openai.com/docs";
const ANTHROPIC_DOCS = "https://docs.anthropic.com";
const GOOGLE_DOCS = "https://ai.google.dev/gemini-api/docs";
const XAI_DOCS = "https://docs.x.ai";
const DEEPSEEK_DOCS = "https://api-docs.deepseek.com";
const OPENROUTER_DOCS = "https://openrouter.ai/docs";
const OLLAMA_DOCS = "https://github.com/ollama/ollama/blob/main/docs/api.md";

/**
 * Built-in provider descriptors (`07` §4–§5).
 *
 * @public
 */
export const OPENAI_DESCRIPTOR: ProviderDescriptor = {
  id: "openai",
  displayName: "OpenAI",
  auth: "apiKey",
  baseUrl: { default: "https://api.openai.com/v1", configurable: true },
  browserDirect: "yes",
  listsModels: true,
  docsUrl: OPENAI_DOCS,
};

/**
 * Anthropic Messages API (`07` §5 header).
 *
 * @public
 */
export const ANTHROPIC_DESCRIPTOR: ProviderDescriptor = {
  id: "anthropic",
  displayName: "Anthropic",
  auth: "apiKey",
  baseUrl: { default: "https://api.anthropic.com", configurable: true },
  browserDirect: "header",
  listsModels: true,
  docsUrl: ANTHROPIC_DOCS,
};

/**
 * Google Gemini API.
 *
 * @public
 */
export const GOOGLE_DESCRIPTOR: ProviderDescriptor = {
  id: "google",
  displayName: "Google",
  auth: "apiKey",
  baseUrl: { default: "https://generativelanguage.googleapis.com/v1beta", configurable: true },
  browserDirect: "yes",
  listsModels: true,
  docsUrl: GOOGLE_DOCS,
};

/**
 * xAI via official `@ai-sdk/xai` (Q-0117: package present at pin).
 *
 * @public
 */
export const XAI_DESCRIPTOR: ProviderDescriptor = {
  id: "xai",
  displayName: "xAI",
  auth: "apiKey",
  baseUrl: { configurable: true },
  browserDirect: "no",
  listsModels: true,
  docsUrl: XAI_DOCS,
};

/**
 * DeepSeek via official `@ai-sdk/deepseek`.
 *
 * @public
 */
export const DEEPSEEK_DESCRIPTOR: ProviderDescriptor = {
  id: "deepseek",
  displayName: "DeepSeek",
  auth: "apiKey",
  baseUrl: { configurable: true },
  browserDirect: "no",
  listsModels: true,
  docsUrl: DEEPSEEK_DOCS,
};

/**
 * OpenRouter catalog + chat.
 *
 * @public
 */
export const OPENROUTER_DESCRIPTOR: ProviderDescriptor = {
  id: "openrouter",
  displayName: "OpenRouter",
  auth: "apiKey",
  baseUrl: { default: "https://openrouter.ai/api/v1", configurable: true },
  browserDirect: "yes",
  listsModels: true,
  docsUrl: OPENROUTER_DOCS,
};

/**
 * Ollama OpenAI-compatible + `/api/tags` (`07` §4).
 *
 * @public
 */
export const OLLAMA_DESCRIPTOR: ProviderDescriptor = {
  id: "ollama",
  displayName: "Ollama",
  auth: "none",
  baseUrl: { default: "http://localhost:11434/v1", configurable: true },
  browserDirect: "yes",
  listsModels: true,
  docsUrl: OLLAMA_DOCS,
};

/**
 * User-supplied OpenAI-compatible origin.
 *
 * @public
 */
export const OPENAI_COMPATIBLE_DESCRIPTOR: ProviderDescriptor = {
  id: "openai-compatible",
  displayName: "OpenAI-compatible",
  auth: "apiKey",
  baseUrl: { configurable: true },
  browserDirect: "yes",
  listsModels: true,
  docsUrl: OPENAI_DOCS,
};

/**
 * Direct-browser header required by Anthropic (`07` §5).
 *
 * @public
 */
export const ANTHROPIC_BROWSER_HEADER = "anthropic-dangerous-direct-browser-access" as const;
