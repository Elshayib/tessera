import type { ChangeSet, TransactionRecord } from "@tessera/core";

const EMPTY: ChangeSet = {
  entities: { created: [], deleted: [], updated: [] },
  assets: { created: [], deleted: [], updated: [] },
  behaviors: { created: [], deleted: [], updated: [] },
  summary: "No changes",
};

/**
 * One agent run in the review panel (`06` §9).
 *
 * @public
 */
export interface RunGroup {
  readonly runId: string;
  readonly steps: readonly TransactionRecord[];
  readonly changeSet: ChangeSet;
}

/**
 * Groups committed agent transactions by `runId` without writing the document.
 *
 * @example
 * ```ts
 * groupAgentRuns(committed);
 * ```
 *
 * @public
 */
export function groupAgentRuns(transactions: readonly TransactionRecord[]): readonly RunGroup[] {
  const order: string[] = [];
  const buckets = new Map<string, TransactionRecord[]>();
  for (const record of transactions) {
    if (record.author.kind !== "agent" || record.runId === undefined) {
      continue;
    }
    const runId = record.runId;
    const existing = buckets.get(runId);
    if (existing === undefined) {
      order.push(runId);
      buckets.set(runId, [record]);
    } else {
      existing.push(record);
    }
  }
  return order.map((runId) => {
    const steps = buckets.get(runId) ?? [];
    let merged = EMPTY;
    for (const step of steps) {
      merged = mergeChangeSets(merged, step.changeSet);
    }
    return { runId, steps, changeSet: merged };
  });
}

function mergeChangeSets(left: ChangeSet, right: ChangeSet): ChangeSet {
  return {
    entities: {
      created: [...left.entities.created, ...right.entities.created],
      deleted: [...left.entities.deleted, ...right.entities.deleted],
      updated: [...left.entities.updated, ...right.entities.updated],
    },
    assets: {
      created: [...left.assets.created, ...right.assets.created],
      deleted: [...left.assets.deleted, ...right.assets.deleted],
      updated: [...left.assets.updated, ...right.assets.updated],
    },
    behaviors: {
      created: [...left.behaviors.created, ...right.behaviors.created],
      deleted: [...left.behaviors.deleted, ...right.behaviors.deleted],
      updated: [...left.behaviors.updated, ...right.behaviors.updated],
    },
    summary: right.summary,
  };
}
