import type {
  Capabilities,
  LlmClient,
  LlmRequest,
  LlmResponse,
  LlmStreamEvent,
  ModelDescriptor,
  ProviderDescriptor,
  ToolCallPart,
} from "@tessera/llm";
import { assistantText, assistantToolCalls } from "@tessera/llm";
import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";

/**
 * One scripted generate/stream step (`13` §3).
 *
 * @public
 */
export interface FakeLlmStep {
  readonly expectPromptIncludes?: string;
  readonly respond: {
    readonly text?: string;
    readonly toolCalls?: readonly ToolCallPart[];
  };
}

/**
 * Capability presets on {@link FakeLlmClient} (`13` §3).
 *
 * @public
 */
export type FakeLlmPreset = "noTools" | "noVision" | "smallContext";

const FAKE_PROVIDER: ProviderDescriptor = {
  id: "fake",
  displayName: "Fake",
  auth: "none",
  baseUrl: { configurable: false },
  browserDirect: "yes",
  listsModels: true,
  docsUrl: "https://example.invalid",
};

/**
 * Scripted {@link LlmClient} that never touches the network (`13` §3).
 *
 * @example
 * ```ts
 * FakeLlmClient.script([{ expectPromptIncludes: "cube", respond: { text: "ok" } }]);
 * ```
 *
 * @public
 */
export class FakeLlmClient implements LlmClient {
  readonly provider: ProviderDescriptor = FAKE_PROVIDER;
  readonly requests: LlmRequest[] = [];
  private caps: Capabilities = {
    tools: "native",
    parallelTools: true,
    vision: true,
    structuredOutput: true,
    streaming: true,
    contextTokens: 128_000,
    maxTools: 64,
    needsExamples: false,
  };
  private steps: readonly FakeLlmStep[] = [];
  private cursor = 0;

  /**
   * Builds a client with a script.
   *
   * @public
   */
  static script(steps: readonly FakeLlmStep[]): FakeLlmClient {
    return new FakeLlmClient().script(steps);
  }

  /**
   * Current capability profile (presets mutate a copy).
   *
   * @public
   */
  get capabilities(): Capabilities {
    return this.caps;
  }

  /**
   * Replaces the script and rewinds.
   *
   * @public
   */
  script(steps: readonly FakeLlmStep[]): this {
    this.steps = steps;
    this.cursor = 0;
    return this;
  }

  /**
   * Applies a capability preset (`13` §3).
   *
   * @public
   */
  preset(name: FakeLlmPreset): this {
    if (name === "noTools") {
      this.caps = { ...this.caps, tools: "none" };
    }
    if (name === "noVision") {
      this.caps = { ...this.caps, vision: false };
    }
    if (name === "smallContext") {
      this.caps = { ...this.caps, contextTokens: 8_000 };
    }
    return this;
  }

  async listModels(): Promise<Result<readonly ModelDescriptor[], TesseraError>> {
    return ok([]);
  }

  async testConnection(): Promise<Result<{ latencyMs: number }, TesseraError>> {
    return ok({ latencyMs: 0 });
  }

  async generate(request: LlmRequest): Promise<Result<LlmResponse, TesseraError>> {
    this.requests.push(request);
    const step = this.steps[this.cursor];
    if (step === undefined) {
      return err(tesseraError("INVALID_INPUT", "fake script exhausted"));
    }
    this.cursor += 1;
    const prompt = promptBlob(request);
    if (step.expectPromptIncludes !== undefined && !prompt.includes(step.expectPromptIncludes)) {
      return err(tesseraError("INVALID_INPUT", "expectPromptIncludes missed"));
    }
    return ok(responseFrom(request, step));
  }

  async *stream(request: LlmRequest): AsyncIterable<LlmStreamEvent> {
    const generated = await this.generate(request);
    if (!generated.ok) {
      throw generated.error;
    }
    const text = stepText(generated.value);
    if (text.length > 0) {
      yield { type: "text.delta", text };
    }
    yield { type: "done", response: generated.value };
  }
}

function promptBlob(request: LlmRequest): string {
  return JSON.stringify(request.messages);
}

function responseFrom(request: LlmRequest, step: FakeLlmStep): LlmResponse {
  const calls = step.respond.toolCalls;
  const message =
    calls !== undefined && calls.length > 0
      ? assistantToolCalls(calls)
      : assistantText(step.respond.text ?? "");
  return {
    message,
    usage: { inputTokens: 1, outputTokens: 1 },
    finishReason: calls !== undefined && calls.length > 0 ? "tool_calls" : "stop",
    modelId: request.model.modelId,
  };
}

function stepText(response: LlmResponse): string {
  const parts = response.message.parts;
  const first = parts[0];
  if (first === undefined || first.kind !== "text") {
    return "";
  }
  return first.text;
}
