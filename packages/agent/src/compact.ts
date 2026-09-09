import type { LlmMessage } from "@tessera/llm";

const ARRAY_LIMIT = 50;
const STRING_LIMIT = 2000;

/**
 * Compacts tool results (`06` §7.3).
 *
 * @example
 * ```ts
 * compactValue({ items: Array.from({ length: 60 }, (_, i) => i) });
 * ```
 *
 * @public
 */
export function compactValue(value: unknown): unknown {
  return compactInner(value);
}

/**
 * Approximate token count for a message list (`INV-AGT-07`).
 *
 * @public
 */
export function estimateTokens(messages: readonly LlmMessage[]): number {
  return Math.ceil(JSON.stringify(messages).length / 4);
}

/**
 * Context budget: `contextTokens − maxOutputTokens − 1_000` (`INV-AGT-07`).
 *
 * @public
 */
export function contextBudget(contextTokens: number, maxOutputTokens: number): number {
  return Math.max(0, contextTokens - maxOutputTokens - 1_000);
}

/**
 * Drops oldest non-system messages until the request fits.
 *
 * @public
 */
export function fitMessages(
  messages: readonly LlmMessage[],
  budget: number,
): readonly LlmMessage[] {
  const kept = [...messages];
  while (kept.length > 1 && estimateTokens(kept) > budget) {
    const index = kept.findIndex((message) => message.role !== "system");
    if (index === -1) {
      break;
    }
    kept.splice(index, 1);
  }
  return kept;
}

function compactInner(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.length <= STRING_LIMIT) {
      return value;
    }
    return `${value.slice(0, STRING_LIMIT)}…+${String(value.length - STRING_LIMIT)}`;
  }
  if (Array.isArray(value)) {
    const mapped = value.map((item) => compactInner(item));
    if (mapped.length <= ARRAY_LIMIT) {
      return mapped;
    }
    return [...mapped.slice(0, ARRAY_LIMIT), `…+${String(mapped.length - ARRAY_LIMIT)} more`];
  }
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = compactInner(child);
    }
    return out;
  }
  return value;
}
