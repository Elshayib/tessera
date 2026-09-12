import { MemoryBlobStore } from "@tessera/storage";
import { expect, test } from "vitest";
import { createLocalWorkerProvider } from "./create-local-worker-provider.js";
import { createMemoryGenerationHttp } from "./http.js";

test("local worker 07 §8.3 contract against in-process fake", async () => {
  const jobs = new Map<string, { state: string; progress: number }>();
  const http = createMemoryGenerationHttp((input) => {
    if (input.method === "POST" && input.url.endsWith("/v1/jobs")) {
      jobs.set("w1", { state: "running", progress: 0.2 });
      return { status: 202, body: JSON.stringify({ id: "w1" }) };
    }
    if (input.method === "GET" && input.url.endsWith("/v1/jobs/w1")) {
      return {
        status: 200,
        body: JSON.stringify({ state: "succeeded", progress: 1, message: "done" }),
      };
    }
    if (input.url.endsWith("/v1/jobs/w1/result")) {
      return { status: 200, body: JSON.stringify({ file: "glb-bytes" }) };
    }
    if (input.method === "DELETE" && input.url.endsWith("/v1/jobs/w1")) {
      return { status: 204, body: "" };
    }
    if (input.url.endsWith("/v1/capabilities")) {
      return { status: 200, body: JSON.stringify({ id: "local-worker" }) };
    }
    return { status: 404, body: "{}" };
  });
  const provider = createLocalWorkerProvider({ baseUrl: "http://127.0.0.1:8090", http });
  const signal = new AbortController().signal;
  const submitted = await provider.submit({ kind: "mesh", pbr: true, prompt: "crate" }, signal);
  expect(submitted.ok).toBe(true);
  if (!submitted.ok) {
    return;
  }
  const polled = await provider.poll("w1", signal);
  expect(polled.ok && polled.value.state === "succeeded").toBe(true);
  const result = await provider.fetchResult("w1", new MemoryBlobStore(), signal);
  expect(result.ok).toBe(true);
  await provider.cancel?.("w1");
});
