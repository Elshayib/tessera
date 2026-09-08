import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import type {
  Capabilities,
  KeyVault,
  LlmClient,
  LlmClientFactory,
  LlmMessage,
  LlmRequest,
  LlmResponse,
  LlmStreamEvent,
  ModelDescriptor,
  ModelRef,
  ProviderConfig,
  ProviderDescriptor,
  ProviderRegistry,
  ToolSpec,
  Usage,
} from "./types.js";

function dependencyNames(pkg: unknown): readonly string[] {
  if (typeof pkg !== "object" || pkg === null) {
    return [];
  }
  const names: string[] = [];
  for (const [key, value] of Object.entries(pkg)) {
    if (key !== "dependencies" && key !== "devDependencies") {
      continue;
    }
    if (typeof value !== "object" || value === null) {
      continue;
    }
    names.push(...Object.keys(value));
  }
  return names;
}

test("INV-PRV-01 llm has no ai / @ai-sdk / @openrouter dependency", () => {
  const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "../package.json");
  const pkg: unknown = JSON.parse(readFileSync(pkgPath, "utf8"));
  for (const name of dependencyNames(pkg)) {
    expect(name === "ai" || name.startsWith("@ai-sdk/") || name.startsWith("@openrouter/")).toBe(
      false,
    );
  }
  const sources = import.meta.glob("./**/*.ts", {
    eager: true,
    query: "?raw",
    import: "default",
  });
  for (const [path, source] of Object.entries(sources)) {
    if (path.includes(".test.")) {
      continue;
    }
    expect(typeof source).toBe("string");
    if (typeof source !== "string") {
      continue;
    }
    expect(source.includes('from "ai"'), path).toBe(false);
    expect(source.includes('from "@ai-sdk'), path).toBe(false);
    expect(source.includes('from "@openrouter/'), path).toBe(false);
  }
});

test("07 §2 public types are exported (type-level)", () => {
  const ref: ModelRef = { providerId: "openai", modelId: "gpt-test" };
  const descriptor: ProviderDescriptor = {
    id: "openai",
    displayName: "OpenAI",
    auth: "apiKey",
    baseUrl: { configurable: true },
    browserDirect: "yes",
    listsModels: true,
    docsUrl: "https://example.invalid",
  };
  const capabilities: Capabilities = {
    tools: "native",
    parallelTools: true,
    vision: false,
    structuredOutput: true,
    streaming: true,
    contextTokens: 32_000,
    maxTools: 64,
    needsExamples: false,
  };
  const model: ModelDescriptor = { ref, displayName: "test", declared: {} };
  const message: LlmMessage = { role: "system", content: "hi" };
  const spec: ToolSpec = { name: "echo", description: "echo", inputSchema: { type: "object" } };
  const request: LlmRequest = { model: ref, messages: [message] };
  const usage: Usage = { inputTokens: 1, outputTokens: 1 };
  const response: LlmResponse = {
    message: { role: "assistant", parts: [{ kind: "text", text: "ok" }] },
    usage,
    finishReason: "stop",
    modelId: "gpt-test",
  };
  const stream: LlmStreamEvent = { type: "done", response };
  const config: ProviderConfig = { providerId: "openai" };
  void descriptor;
  void capabilities;
  void model;
  void spec;
  void request;
  void stream;
  void config;
  type _Client = LlmClient;
  type _Vault = KeyVault;
  type _Registry = ProviderRegistry;
  type _Factory = LlmClientFactory;
  expect(ref.providerId).toBe("openai");
});
