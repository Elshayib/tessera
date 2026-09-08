import { isErr, isOk, ok } from "@tessera/std";
import { expect, test } from "vitest";
import { createCommandBus } from "./command-bus.js";
import { createDocument } from "./create-document.js";
import { createJobQueue } from "./job-queue.js";

const author = { kind: "user" as const, id: "tester" };

test("job commit is the only document write and cancel returns CANCELLED", async () => {
  const { doc, reader } = createDocument();
  const bus = createCommandBus(doc);
  const jobs = createJobQueue(bus, { logger: doc.logger });
  const committed = jobs.enqueue({
    kind: "bake",
    label: "create entity",
    author,
    async run() {
      expect([...reader.entities()]).toHaveLength(0);
      return ok({ name: "baked" });
    },
    commit(result, jobBus) {
      const executed = jobBus.execute("entity.create", { name: result.name }, { author });
      if (!executed.ok) {
        return executed;
      }
      return ok(undefined);
    },
  });
  const done = await committed.result();
  expect(isOk(done)).toBe(true);
  expect([...reader.entities()].map((entity) => entity.name)).toEqual(["baked"]);

  let continueRun: (() => void) | undefined;
  const blocked = new Promise<void>((resolve) => {
    continueRun = resolve;
  });
  const cancellable = jobs.enqueue({
    kind: "export",
    label: "slow",
    author,
    async run({ signal }) {
      await blocked;
      if (signal.aborted) {
        return { ok: false, error: { code: "CANCELLED", message: "aborted" } };
      }
      return ok(undefined);
    },
  });
  jobs.cancel(cancellable.id);
  continueRun?.();
  const cancelled = await cancellable.result();
  expect(isErr(cancelled) && cancelled.error.code === "CANCELLED").toBe(true);
  expect(jobs.get(cancellable.id)?.state).toBe("cancelled");
});

test("job concurrency is at most 2 running per kind", async () => {
  const { doc } = createDocument();
  const bus = createCommandBus(doc);
  const jobs = createJobQueue(bus, { logger: doc.logger });
  const gates: (() => void)[] = [];
  const waits = [0, 1, 2].map(
    () =>
      new Promise<void>((resolve) => {
        gates.push(resolve);
      }),
  );
  let running = 0;
  let maxRunning = 0;
  const handles = waits.map((wait, index) => {
    const gate = wait;
    return jobs.enqueue({
      kind: "generate",
      label: `job-${String(index)}`,
      author,
      async run() {
        running += 1;
        maxRunning = Math.max(maxRunning, running);
        await gate;
        running -= 1;
        return ok(undefined);
      },
    });
  });
  await Promise.resolve();
  await Promise.resolve();
  expect(maxRunning).toBe(2);
  expect(jobs.list({ kind: "generate", state: "running" })).toHaveLength(2);
  expect(jobs.list({ kind: "generate", state: "queued" })).toHaveLength(1);
  const first = gates[0];
  expect(first !== undefined).toBe(true);
  if (first !== undefined) {
    first();
  }
  await Promise.resolve();
  await Promise.resolve();
  expect(jobs.list({ kind: "generate", state: "running" }).length).toBeGreaterThanOrEqual(2);
  for (const gate of gates) {
    gate();
  }
  await Promise.all(handles.map((handle) => handle.result()));
  expect(maxRunning).toBe(2);
});
