import { createHash } from "node:crypto";
import type {
  LlmClient,
  LlmMessage,
  LlmRequest,
  LlmResponse,
  LlmStreamEvent,
  ModelDescriptor,
  ModelRef,
  ProviderDescriptor,
} from "@tessera/llm";
import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";

const ISO_DATE = /\d{4}-\d{2}-\d{2}T[0-9:.]+Z?/g;
const REQUEST_ID = /\breq_[A-Za-z0-9]+\b/g;

const REPLAY_PROVIDER: ProviderDescriptor = {
  id: "replay",
  displayName: "Replay",
  auth: "none",
  baseUrl: { configurable: false },
  browserDirect: "yes",
  listsModels: false,
  docsUrl: "https://example.invalid",
};

/**
 * One recorded generate exchange (`13` §4).
 *
 * @public
 */
export interface LlmRecording {
  readonly requestHash: string;
  readonly request: {
    readonly model: ModelRef;
    readonly systemPromptHash: string;
    readonly messages: unknown;
    readonly toolNames: readonly string[];
  };
  readonly response: LlmResponse;
  readonly usage: LlmResponse["usage"];
}

/**
 * Strips ISO timestamps and `req_…` ids from a JSON-like value (`13` §4).
 *
 * @public
 */
export function stripVolatileFields(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(ISO_DATE, "<ts>").replace(REQUEST_ID, "<id>");
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripVolatileFields(item));
  }
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = stripVolatileFields(nested);
    }
    return out;
  }
  return value;
}

/**
 * Messages with images reduced to mime + byte length (stable JSON).
 *
 * @example
 * ```ts
 * messagesForHash([{ role: "user", parts: [{ kind: "text", text: "hi" }] }]);
 * ```
 *
 * @public
 */
export function messagesForHash(messages: readonly LlmMessage[]): unknown {
  return messages.map((message) => {
    if (message.role === "user") {
      return {
        role: "user",
        parts: message.parts.map((part) => {
          if (part.kind === "image") {
            return { kind: "image", mime: part.mime, bytes: part.data.byteLength };
          }
          return part;
        }),
      };
    }
    return message;
  });
}

function toolNamesOf(request: LlmRequest): readonly string[] {
  if (request.tools === undefined) {
    return [];
  }
  return request.tools.map((tool) => tool.name);
}

/**
 * Stable hash of `(model, messages without volatile fields, tool names)` (`13` §4).
 *
 * @public
 */
export function hashLlmRequest(request: LlmRequest): string {
  const payload = {
    model: request.model,
    messages: stripVolatileFields(messagesForHash(request.messages)),
    toolNames: toolNamesOf(request),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function hashSystemPrompt(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * SHA-256 of the first system message, or of `""`.
 *
 * @public
 */
export function systemPromptHashOf(messages: readonly LlmMessage[]): string {
  const first = messages.find((message) => message.role === "system");
  if (first === undefined || first.role !== "system") {
    return hashSystemPrompt("");
  }
  return hashSystemPrompt(first.content);
}

/**
 * Replay {@link LlmClient} that never networks (`13` §4).
 *
 * @example
 * ```ts
 * new ReplayLlmClient({ recordings: [] });
 * ```
 *
 * @public
 */
export class ReplayLlmClient implements LlmClient {
  readonly provider: ProviderDescriptor;
  private readonly byHash: ReadonlyMap<string, LlmRecording>;

  constructor(options: {
    readonly recordings: readonly LlmRecording[];
    readonly provider?: ProviderDescriptor;
  }) {
    this.provider = options.provider ?? REPLAY_PROVIDER;
    const map = new Map<string, LlmRecording>();
    for (const recording of options.recordings) {
      map.set(recording.requestHash, recording);
    }
    this.byHash = map;
  }

  async listModels(): Promise<Result<readonly ModelDescriptor[], TesseraError>> {
    return ok([]);
  }

  async testConnection(): Promise<Result<{ latencyMs: number }, TesseraError>> {
    return ok({ latencyMs: 0 });
  }

  async generate(request: LlmRequest): Promise<Result<LlmResponse, TesseraError>> {
    const hash = hashLlmRequest(request);
    const recording = this.byHash.get(hash);
    if (recording === undefined) {
      return err(
        tesseraError(
          "NOT_FOUND",
          `no recording for request hash ${hash} — run with TESSERA_RECORD=1`,
        ),
      );
    }
    return ok(recording.response);
  }

  async *stream(request: LlmRequest): AsyncIterable<LlmStreamEvent> {
    const generated = await this.generate(request);
    if (!generated.ok) {
      throw generated.error;
    }
    yield { type: "done", response: generated.value };
  }
}
