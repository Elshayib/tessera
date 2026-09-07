import { emptyDocument } from "@tessera/schema";
import { isOk } from "@tessera/std";
import { expect, test } from "vitest";
import { createCommandBus } from "./command-bus.js";
import { createDocument } from "./create-document.js";

const author = { kind: "user" as const, id: "tester" };

/**
 * Laptop budgets from `docs/01` §8: 0.5 ms primitive / 16 ms 100-command txn.
 * CI thresholds below include process warmup on Windows CI agents.
 * Measured after a warmup execute so the first cold call is not the sample.
 */
const PRIMITIVE_MS = 100;
const TXN_100_MS = 2000;

function expectBench(name: string, elapsedMs: number, budgetMs: number): void {
  expect(elapsedMs, name).toBeLessThanOrEqual(budgetMs);
}

test("command bus CI budgets", () => {
  const { doc } = createDocument({ snapshot: emptyDocument() });
  const bus = createCommandBus(doc);
  const warmup = bus.execute("entity.create", { name: "warmup" }, { author });
  expect(isOk(warmup)).toBe(true);

  const primitiveStart = performance.now();
  const created = bus.execute("entity.create", { name: "bench" }, { author });
  expect(isOk(created)).toBe(true);
  expectBench("primitive command", performance.now() - primitiveStart, PRIMITIVE_MS);

  const txnStart = performance.now();
  const txn = bus.transaction({ author }, (tx) => {
    for (let index = 0; index < 100; index += 1) {
      const ran = tx.run("entity.create", {});
      if (!ran.ok) {
        return ran;
      }
    }
    return { ok: true, value: undefined };
  });
  expect(isOk(txn)).toBe(true);
  expectBench("100-command txn", performance.now() - txnStart, TXN_100_MS);
});
