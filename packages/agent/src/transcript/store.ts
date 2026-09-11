import type { LlmMessage } from "@tessera/llm";
import type { Result, TesseraError } from "@tessera/std";
import { estimateTokens, fitMessages } from "../compact.js";
import type { RunTrace } from "../trace.js";

/**
 * One persisted transcript row (Q-0130: fields required by append / recent).
 *
 * @public
 */
export interface TranscriptEntry {
  readonly id: string;
  readonly conversationId: string;
  readonly projectId: string;
  readonly runId?: string;
  readonly message: LlmMessage;
  readonly createdAt: string;
}

/**
 * Conversation list row (Q-0130: fields required by listConversations).
 *
 * @public
 */
export interface ConversationSummary {
  readonly conversationId: string;
  readonly projectId: string;
  readonly updatedAt: string;
}

/**
 * Project-local transcripts and traces (`06` §13). Never synced.
 *
 * `recordTrace` is required so `exportRun` can return a `RunTrace` stored with the
 * transcript (spec: traces are stored with transcripts).
 *
 * @public
 */
export interface TranscriptStore {
  append(
    conversationId: string,
    entries: readonly TranscriptEntry[],
  ): Promise<Result<void, TesseraError>>;
  recent(
    conversationId: string,
    tokenBudget: number,
  ): Promise<Result<readonly LlmMessage[], TesseraError>>;
  listConversations(
    projectId: string,
  ): Promise<Result<readonly ConversationSummary[], TesseraError>>;
  recordTrace(trace: RunTrace): Promise<Result<void, TesseraError>>;
  exportRun(
    runId: string,
    options?: { readonly includeAttachments?: boolean },
  ): Promise<Result<RunTrace, TesseraError>>;
}

/**
 * Compacts stored messages to `tokenBudget` (`INV-AGT-07` estimator).
 *
 * @public
 */
export function recentMessages(
  entries: readonly TranscriptEntry[],
  tokenBudget: number,
): readonly LlmMessage[] {
  const messages = entries.map((entry) => entry.message);
  return fitMessages(messages, tokenBudget);
}

/**
 * Token estimate used by {@link recentMessages}.
 *
 * @public
 */
export function transcriptTokens(messages: readonly LlmMessage[]): number {
  return estimateTokens(messages);
}
