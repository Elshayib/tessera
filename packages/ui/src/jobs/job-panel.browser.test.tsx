import { createCommandBus, createDocument, createJobQueue } from "@tessera/core";
import { ok } from "@tessera/std";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";
import { JobPanel } from "./job-panel.js";

test("job panel renders progress and cancel invokes JobQueue.cancel", async () => {
  const { doc } = createDocument();
  const bus = createCommandBus(doc);
  const jobs = createJobQueue(bus, { logger: doc.logger });
  let cancelled = false;
  const original = jobs.cancel.bind(jobs);
  jobs.cancel = (id: string) => {
    cancelled = true;
    original(id);
  };
  let release: (() => void) | undefined;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  jobs.enqueue({
    kind: "generate",
    label: "barrel",
    author: { kind: "user", id: "u1" },
    async run({ progress }) {
      progress(0.4, "running");
      await blocked;
      return ok(undefined);
    },
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<JobPanel jobs={jobs} />);
  });
  expect(host.textContent?.includes("barrel")).toBe(true);
  const button = host.querySelector("button");
  expect(button !== null).toBe(true);
  await act(async () => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(cancelled).toBe(true);
  release?.();
  await act(async () => {
    root.unmount();
  });
});
