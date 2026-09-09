import { ok } from "@tessera/std";
import type { RunTrace } from "../trace.js";
import { prepareRunExport } from "./export.js";
import type { ConversationSummary, TranscriptEntry, TranscriptStore } from "./store.js";
import { recentMessages } from "./store.js";

/**
 * In-memory {@link TranscriptStore} for tests and headless runs.
 *
 * @example
 * ```ts
 * createMemoryTranscriptStore();
 * ```
 *
 * @public
 */
export function createMemoryTranscriptStore(): TranscriptStore {
  const entries: TranscriptEntry[] = [];
  const traces = new Map<string, RunTrace>();
  return {
    async append(_conversationId, next) {
      void _conversationId;
      entries.push(...next);
      return ok(undefined);
    },
    async recent(conversationId, tokenBudget) {
      const scoped = entries.filter((entry) => entry.conversationId === conversationId);
      return ok(recentMessages(scoped, tokenBudget));
    },
    async listConversations(projectId) {
      const latest = new Map<string, ConversationSummary>();
      for (const entry of entries) {
        if (entry.projectId !== projectId) {
          continue;
        }
        latest.set(entry.conversationId, {
          conversationId: entry.conversationId,
          projectId: entry.projectId,
          updatedAt: entry.createdAt,
        });
      }
      return ok([...latest.values()]);
    },
    async recordTrace(trace) {
      traces.set(trace.runId, trace);
      return ok(undefined);
    },
    async exportRun(runId, options) {
      return prepareRunExport(traces.get(runId), options?.includeAttachments === true);
    },
  };
}
