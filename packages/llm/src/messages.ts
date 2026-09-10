import type { ImagePart, LlmMessage, TextPart, ToolCallPart, ToolResultPart } from "./types.js";

/**
 * Builds a system message (`07` §2).
 *
 * @public
 */
export function systemMessage(content: string): Extract<LlmMessage, { role: "system" }> {
  return { role: "system", content };
}

/**
 * Builds a user text message (`07` §2).
 *
 * @public
 */
export function userText(text: string): Extract<LlmMessage, { role: "user" }> {
  const part: TextPart = { kind: "text", text };
  return { role: "user", parts: [part] };
}

/**
 * Builds a user image message (`07` §2).
 *
 * @public
 */
export function userImage(
  mime: ImagePart["mime"],
  data: Uint8Array,
): Extract<LlmMessage, { role: "user" }> {
  const part: ImagePart = { kind: "image", mime, data };
  return { role: "user", parts: [part] };
}

/**
 * Builds an assistant text message (`07` §2).
 *
 * @public
 */
export function assistantText(text: string): Extract<LlmMessage, { role: "assistant" }> {
  const part: TextPart = { kind: "text", text };
  return { role: "assistant", parts: [part] };
}

/**
 * Builds an assistant tool-call message (`07` §2).
 *
 * @public
 */
export function assistantToolCalls(
  calls: readonly ToolCallPart[],
): Extract<LlmMessage, { role: "assistant" }> {
  return { role: "assistant", parts: calls };
}

/**
 * Builds a tool-result message (`07` §2).
 *
 * @public
 */
export function toolResultMessage(
  results: readonly ToolResultPart[],
): Extract<LlmMessage, { role: "tool" }> {
  return { role: "tool", results };
}
