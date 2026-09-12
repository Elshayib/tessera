import { tesseraError } from "@tessera/std";
import { MemoryBlobStore } from "@tessera/storage";
import { expect, test } from "vitest";
import { FakeGenerationProvider } from "./fake-generation-provider.js";

test("FakeGenerationProvider estimate/submit/poll/fetchResult/cancel", async () => {
  const provider = new FakeGenerationProvider({ pollStates: ["queued", "running", "succeeded"] });
  const request = {
    kind: "mesh" as const,
    pbr: true,
    prompt: "low-poly barrel",
    style: "lowpoly" as const,
  };
  const estimated = await provider.estimate(request);
  expect(estimated.ok).toBe(true);
  const signal = new AbortController().signal;
  const submitted = await provider.submit(request, signal);
  expect(submitted.ok).toBe(true);
  if (!submitted.ok) {
    return;
  }
  const queued = await provider.poll(submitted.value.remoteJobId, signal);
  expect(queued.ok && queued.value.state === "queued").toBe(true);
  const running = await provider.poll(submitted.value.remoteJobId, signal);
  expect(running.ok && running.value.state === "running").toBe(true);
  const done = await provider.poll(submitted.value.remoteJobId, signal);
  expect(done.ok && done.value.state === "succeeded").toBe(true);
  const blobs = new MemoryBlobStore();
  const result = await provider.fetchResult(submitted.value.remoteJobId, blobs, signal);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(result.value.license).not.toBe("unknown");
  expect(result.value.provenance.source).toBe("generated");
  expect(result.value.provenance.generator?.provider).toBe("fake");
  expect(result.value.blobs).toHaveLength(1);
  await provider.cancel(submitted.value.remoteJobId);
  expect(provider.cancelled).toEqual([submitted.value.remoteJobId]);
});

test("FakeGenerationProvider configurable failure maps to TesseraError", async () => {
  const provider = new FakeGenerationProvider({
    failSubmit: tesseraError("RATE_LIMITED", "slow down", { retryAfterMs: 500 }),
  });
  const submitted = await provider.submit(
    { kind: "image", prompt: "x", size: [64, 64] },
    new AbortController().signal,
  );
  expect(submitted.ok).toBe(false);
  if (submitted.ok) {
    return;
  }
  expect(submitted.error.code).toBe("RATE_LIMITED");
});
