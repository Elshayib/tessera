import { MemoryBlobStore } from "@tessera/storage";
import { expect, test } from "vitest";
import { createTripoProvider } from "./create-tripo-provider.js";
import { createMemoryGenerationHttp } from "./http.js";

test("Tripo recorded fixture round-trip", async () => {
  const http = createMemoryGenerationHttp((input) => {
    if (input.method === "POST") {
      return { status: 200, body: JSON.stringify({ task_id: "t1" }) };
    }
    if (input.url.includes("/task/t1")) {
      return {
        status: 200,
        body: JSON.stringify({ status: "success", url: "https://api.tripo3d.ai/f.glb" }),
      };
    }
    if (input.url.endsWith("f.glb")) {
      return { status: 200, body: "glb" };
    }
    return { status: 404, body: "{}" };
  });
  const provider = createTripoProvider({ http, apiKey: "k" });
  const signal = new AbortController().signal;
  const submitted = await provider.submit({ kind: "mesh", pbr: true, prompt: "cup" }, signal);
  expect(submitted.ok).toBe(true);
  if (!submitted.ok) {
    return;
  }
  await provider.poll(submitted.value.remoteJobId, signal);
  const result = await provider.fetchResult(
    submitted.value.remoteJobId,
    new MemoryBlobStore(),
    signal,
  );
  expect(result.ok).toBe(true);
});
