import { MemoryBlobStore } from "@tessera/storage";
import { expect, test } from "vitest";
import { createMeshyProvider } from "./create-meshy-provider.js";
import { createMemoryGenerationHttp } from "./http.js";

test("Meshy estimate/submit/poll/fetchResult/cancel against fixtures", async () => {
  const http = createMemoryGenerationHttp((input) => {
    if (input.method === "POST") {
      return { status: 200, body: JSON.stringify({ result: "job-1" }) };
    }
    if (input.method === "GET" && input.url.includes("text-to-3d/job-1")) {
      return {
        status: 200,
        body: JSON.stringify({
          status: "SUCCEEDED",
          model_url: "https://api.meshy.ai/files/a.glb",
          kind: "mesh",
        }),
      };
    }
    if (input.url.includes("/files/a.glb")) {
      return { status: 200, body: "glb-bytes" };
    }
    if (input.method === "DELETE") {
      return { status: 204, body: "" };
    }
    return { status: 404, body: "{}" };
  });
  const provider = createMeshyProvider({ http, apiKey: "k" });
  const signal = new AbortController().signal;
  const estimated = await provider.estimate({ kind: "mesh", pbr: true, prompt: "barrel" });
  expect(estimated.ok).toBe(true);
  const submitted = await provider.submit({ kind: "mesh", pbr: true, prompt: "barrel" }, signal);
  expect(submitted.ok).toBe(true);
  if (!submitted.ok) {
    return;
  }
  const polled = await provider.poll(submitted.value.remoteJobId, signal);
  expect(polled.ok && polled.value.state === "succeeded").toBe(true);
  const blobs = new MemoryBlobStore();
  const result = await provider.fetchResult(submitted.value.remoteJobId, blobs, signal);
  expect(result.ok).toBe(true);
  await provider.cancel?.(submitted.value.remoteJobId);
});

test("missing key → PERMISSION_DENIED", async () => {
  const provider = createMeshyProvider({
    http: createMemoryGenerationHttp(() => ({ status: 200, body: "{}" })),
  });
  const submitted = await provider.submit(
    { kind: "mesh", pbr: true },
    new AbortController().signal,
  );
  expect(submitted.ok).toBe(false);
  if (submitted.ok) {
    return;
  }
  expect(submitted.error.code).toBe("PERMISSION_DENIED");
});
