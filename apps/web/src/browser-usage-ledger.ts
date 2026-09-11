import {
  createIndexedDbUsageLedger,
  createUsageLedger,
  type IndexedDbUsageLedger,
  type UsageLedger,
} from "@tessera/agent/observability";
import type { Result, TesseraError } from "@tessera/std";

/**
 * Inputs for {@link createBrowserUsageLedger}.
 *
 * @public
 */
export interface BrowserUsageLedgerInput {
  readonly open?: () => Promise<Result<UsageLedger, TesseraError>>;
}

/**
 * Sync {@link UsageLedger} that hydrates IndexedDB usage rows on first use (`07` §7, Q-0171).
 *
 * @public
 */
export interface BrowserUsageLedger extends UsageLedger {
  readonly flushed: () => Promise<void>;
}

async function defaultOpen(): Promise<Result<UsageLedger, TesseraError>> {
  return createIndexedDbUsageLedger();
}

/**
 * Sync {@link UsageLedger} façade for editor bootstrap.
 *
 * @example
 * ```ts
 * const usage = createBrowserUsageLedger();
 * usage.record({ runId: "r_a", conversationId: "c", projectId: "p", providerId: "openai", inputTokens: 1, outputTokens: 0, costUsd: 0 });
 * ```
 *
 * @public
 */
export function createBrowserUsageLedger(input: BrowserUsageLedgerInput = {}): BrowserUsageLedger {
  let inner: UsageLedger | undefined;
  let pending: Promise<UsageLedger> | undefined;
  const session = createUsageLedger();

  const resolve = (): Promise<UsageLedger> => {
    if (inner !== undefined) {
      return Promise.resolve(inner);
    }
    if (pending === undefined) {
      pending = (async () => {
        const opener = input.open ?? defaultOpen;
        const opened = await opener();
        inner = opened.ok ? opened.value : createUsageLedger();
        return inner;
      })();
    }
    return pending;
  };

  return {
    record(entry) {
      session.record(entry);
      void resolve().then((ledger) => {
        ledger.record(entry);
      });
    },
    forRun(runId) {
      return inner === undefined ? session.forRun(runId) : inner.forRun(runId);
    },
    forConversation(conversationId) {
      return inner === undefined
        ? session.forConversation(conversationId)
        : inner.forConversation(conversationId);
    },
    forProject(projectId) {
      return inner === undefined ? session.forProject(projectId) : inner.forProject(projectId);
    },
    monthlyByProvider() {
      return inner === undefined ? session.monthlyByProvider() : inner.monthlyByProvider();
    },
    flushed() {
      return resolve().then((ledger) => flushLedger(ledger));
    },
  };
}

function flushLedger(ledger: UsageLedger): Promise<void> {
  if (isIndexedDbUsageLedger(ledger)) {
    return ledger.flushed();
  }
  return Promise.resolve();
}

function isIndexedDbUsageLedger(ledger: UsageLedger): ledger is IndexedDbUsageLedger {
  return "flushed" in ledger;
}
