/**
 * Token and estimated-cost totals (`07` §7).
 *
 * @public
 */
export interface UsageTotals {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
}

/**
 * One ledger row (Q-0130: fields required by usage rollups).
 *
 * @public
 */
export interface UsageRecord {
  readonly runId: string;
  readonly conversationId: string;
  readonly projectId: string;
  readonly providerId: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
}

/**
 * In-memory usage rollups persisted conceptually with transcripts (`07` §7).
 *
 * @example
 * ```ts
 * createUsageLedger().record({ runId: "r_a", conversationId: "c_1", projectId: "p", providerId: "openai", inputTokens: 1, outputTokens: 2, costUsd: 0 });
 * ```
 *
 * @public
 */
export interface UsageLedger {
  record(entry: UsageRecord): void;
  forRun(runId: string): UsageTotals;
  forConversation(conversationId: string): UsageTotals;
  forProject(projectId: string): UsageTotals;
  monthlyByProvider(): Readonly<Record<string, UsageTotals>>;
}

const EMPTY: UsageTotals = { inputTokens: 0, outputTokens: 0, costUsd: 0 };

/**
 * Creates an in-memory {@link UsageLedger}.
 *
 * @public
 */
export function createUsageLedger(): UsageLedger {
  const rows: UsageRecord[] = [];
  return {
    record(entry) {
      rows.push(entry);
    },
    forRun(runId) {
      return sum(rows.filter((row) => row.runId === runId));
    },
    forConversation(conversationId) {
      return sum(rows.filter((row) => row.conversationId === conversationId));
    },
    forProject(projectId) {
      return sum(rows.filter((row) => row.projectId === projectId));
    },
    monthlyByProvider() {
      const byProvider: Record<string, UsageTotals> = {};
      for (const row of rows) {
        const previous = byProvider[row.providerId] ?? EMPTY;
        byProvider[row.providerId] = {
          inputTokens: previous.inputTokens + row.inputTokens,
          outputTokens: previous.outputTokens + row.outputTokens,
          costUsd: previous.costUsd + row.costUsd,
        };
      }
      return byProvider;
    },
  };
}

function sum(rows: readonly UsageRecord[]): UsageTotals {
  return rows.reduce(
    (acc, row) => ({
      inputTokens: acc.inputTokens + row.inputTokens,
      outputTokens: acc.outputTokens + row.outputTokens,
      costUsd: acc.costUsd + row.costUsd,
    }),
    EMPTY,
  );
}
