import {
  createIndexedDbTranscriptStore,
  createMemoryTranscriptStore,
  type TranscriptStore,
} from "@tessera/agent/observability";
import type { Result, TesseraError } from "@tessera/std";

/**
 * Inputs for {@link createBrowserTranscriptStore}.
 *
 * @public
 */
export interface BrowserTranscriptStoreInput {
  readonly open?: () => Promise<Result<TranscriptStore, TesseraError>>;
}

async function defaultOpen(): Promise<Result<TranscriptStore, TesseraError>> {
  return createIndexedDbTranscriptStore();
}

/**
 * Sync {@link TranscriptStore} that opens IndexedDB `tessera-transcripts` on first use (`06` §13, Q-0168).
 *
 * @example
 * ```ts
 * const transcripts = createBrowserTranscriptStore();
 * await transcripts.append("c_editor", entries);
 * ```
 *
 * @public
 */
export function createBrowserTranscriptStore(
  input: BrowserTranscriptStoreInput = {},
): TranscriptStore {
  let inner: TranscriptStore | undefined;
  let pending: Promise<TranscriptStore> | undefined;

  const resolve = (): Promise<TranscriptStore> => {
    if (inner !== undefined) {
      return Promise.resolve(inner);
    }
    if (pending === undefined) {
      pending = (async () => {
        const opener = input.open ?? defaultOpen;
        const opened = await opener();
        inner = opened.ok ? opened.value : createMemoryTranscriptStore();
        return inner;
      })();
    }
    return pending;
  };

  return {
    async append(conversationId, entries) {
      const store = await resolve();
      return store.append(conversationId, entries);
    },
    async recent(conversationId, tokenBudget) {
      const store = await resolve();
      return store.recent(conversationId, tokenBudget);
    },
    async listConversations(projectId) {
      const store = await resolve();
      return store.listConversations(projectId);
    },
    async recordTrace(trace) {
      const store = await resolve();
      return store.recordTrace(trace);
    },
    async exportRun(runId, options) {
      const store = await resolve();
      if (options === undefined) {
        return store.exportRun(runId);
      }
      return store.exportRun(runId, options);
    },
  };
}
