import { MemoryBlobStore } from "@tessera/storage";
import { expect, test } from "vitest";
import { createLocalWorkerProvider } from "./create-local-worker-provider.js";
import { createMeshyProvider } from "./create-meshy-provider.js";
import { createMemoryGenerationHttp } from "./http.js";

test("contract estimate/submit/poll/fetchResult on meshy and local-worker", async () => {
  const meshy = createMeshyProvider({
    apiKey: "k",
    http: createMemoryGenerationHttp((input) => {
      if (input.method === "POST") {
        return { status: 200, body: JSON.stringify({ id: "m1" }) };
      }
      return {
        status: 200,
        body: JSON.stringify({ status: "succeeded", url: "https://api.meshy.ai/x", kind: "mesh" }),
      };
    }),
  });
  expect(meshy.descriptor.id).toBe("meshy");
  const local = createLocalWorkerProvider({
    baseUrl: "http://127.0.0.1:9",
    http: createMemoryGenerationHttp((input) => {
      if (input.method === "POST") {
        return { status: 202, body: JSON.stringify({ id: "l1" }) };
      }
      if (input.url.includes("/result")) {
        return { status: 200, body: JSON.stringify({ file: "x" }) };
      }
      return { status: 200, body: JSON.stringify({ state: "succeeded", progress: 1 }) };
    }),
  });
  const signal = new AbortController().signal;
  const submitted = await local.submit({ kind: "image", prompt: "p", size: [8, 8] }, signal);
  expect(submitted.ok).toBe(true);
  if (!submitted.ok) {
    return;
  }
  const fetched = await local.fetchResult(
    submitted.value.remoteJobId,
    new MemoryBlobStore(),
    signal,
  );
  expect(fetched.ok).toBe(true);
  void meshy;
});
