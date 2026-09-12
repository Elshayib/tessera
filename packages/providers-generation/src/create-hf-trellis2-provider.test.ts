import { MemoryBlobStore } from "@tessera/storage";
import { expect, test } from "vitest";
import { createHfTrellis2Provider } from "./create-hf-trellis2-provider.js";
import { createMemoryGenerationHttp } from "./http.js";

test("HF TRELLIS.2 two-stage text-to-mesh job", async () => {
  let imageStage = 0;
  const http = createMemoryGenerationHttp((input) => {
    if (input.method === "POST") {
      return { status: 200, body: JSON.stringify({ event_id: "e1" }) };
    }
    if (input.url.includes("e1")) {
      return {
        status: 200,
        body: JSON.stringify({ status: "succeeded", url: "https://huggingface.co/x.glb" }),
      };
    }
    if (input.url.endsWith("x.glb")) {
      return { status: 200, body: "glb" };
    }
    return { status: 404, body: "{}" };
  });
  const provider = createHfTrellis2Provider({
    http,
    apiKey: "hf_x",
    imageProvider: {
      async submit() {
        imageStage += 1;
        return { ok: true, value: { remoteJobId: "img-1" } };
      },
    },
  });
  const signal = new AbortController().signal;
  const submitted = await provider.submit({ kind: "mesh", pbr: true, prompt: "barrel" }, signal);
  expect(submitted.ok).toBe(true);
  expect(imageStage).toBe(1);
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
