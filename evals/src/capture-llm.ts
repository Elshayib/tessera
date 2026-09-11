import type {
  LlmClient,
  LlmRequest,
  LlmResponse,
  LlmStreamEvent,
  ModelDescriptor,
} from "@tessera/llm";
import type { Result, TesseraError } from "@tessera/std";
import { hashLlmRequest, type LlmRecording, stripVolatileFields } from "@tessera/testing";

/**
 * Records every generate/stream exchange for fixture writes.
 *
 * @public
 */
export class CaptureLlmClient implements LlmClient {
  readonly provider;
  readonly recordings: LlmRecording[] = [];
  private readonly inner: LlmClient;

  constructor(inner: LlmClient) {
    this.inner = inner;
    this.provider = inner.provider;
  }

  listModels(signal?: AbortSignal): Promise<Result<readonly ModelDescriptor[], TesseraError>> {
    return this.inner.listModels(signal);
  }

  testConnection(signal?: AbortSignal): Promise<Result<{ latencyMs: number }, TesseraError>> {
    return this.inner.testConnection(signal);
  }

  async generate(
    request: LlmRequest,
    signal?: AbortSignal,
  ): Promise<Result<LlmResponse, TesseraError>> {
    const result = await this.inner.generate(request, signal);
    if (result.ok) {
      this.recordings.push({
        requestHash: hashLlmRequest(request),
        request: {
          model: request.model,
          systemPromptHash: hashLlmRequest(request),
          messages: stripVolatileFields(request.messages),
          toolNames: request.tools?.map((tool) => tool.name) ?? [],
        },
        response: result.value,
        usage: result.value.usage,
      });
    }
    return result;
  }

  async *stream(request: LlmRequest, signal?: AbortSignal): AsyncIterable<LlmStreamEvent> {
    const generated = await this.generate(request, signal);
    if (!generated.ok) {
      throw generated.error;
    }
    yield { type: "done", response: generated.value };
  }
}
