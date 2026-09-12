import { createCommandBus, createDocument, createJobQueue } from "@tessera/core";
import { ok } from "@tessera/std";
import { expect, test } from "vitest";
import { en } from "../i18n/en.js";

test("job strings exist", () => {
  expect(en.jobs.title).toBe("Jobs");
  expect(en.jobs.cancel).toBe("Cancel");
});

test("JobQueue.cancel is the cancel path", async () => {
  const { doc } = createDocument();
  const bus = createCommandBus(doc);
  const jobs = createJobQueue(bus, { logger: doc.logger });
  let release: (() => void) | undefined;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const handle = jobs.enqueue({
    kind: "import",
    label: "slow",
    author: { kind: "user", id: "u1" },
    async run({ signal }) {
      await blocked;
      if (signal.aborted) {
        return { ok: false, error: { code: "CANCELLED", message: "aborted" } };
      }
      return ok(undefined);
    },
  });
  jobs.cancel(handle.id);
  release?.();
  const done = await handle.result();
  expect(done.ok).toBe(false);
});
