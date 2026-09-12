import { MemoryBlobStore } from "@tessera/storage";
import { expect, test } from "vitest";
import { createRodinProvider } from "./create-rodin-provider.js";
import { createMemoryGenerationHttp } from "./http.js";

test("Rodin recorded fixture round-trip", async () => {
  const http = createMemoryGenerationHttp((input) => {
    if (input.method === "POST") {
      return { status: 200, body: JSON.stringify({ uuid: "r1" }) };
    }
    if (input.url.includes("/status/r1")) {
      return {
        status: 200,
        body: JSON.stringify({ status: "completed", url: "https://api.hyper3d.com/m.glb" }),
      };
    }
    if (input.url.endsWith("m.glb")) {
      return { status: 200, body: "glb" };
    }
    return { status: 404, body: "{}" };
  });
  const provider = createRodinProvider({ http, apiKey: "k" });
  const signal = new AbortController().signal;
  const submitted = await provider.submit({ kind: "mesh", pbr: true, prompt: "rock" }, signal);
  expect(submitted.ok).toBe(true);
  if (!submitted.ok) {
    return;
  }
  const result = await provider.fetchResult(
    submitted.value.remoteJobId,
    new MemoryBlobStore(),
    signal,
  );
  expect(result.ok).toBe(true);
});
