import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import { createXai } from "@ai-sdk/xai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type {
  LlmClient,
  LlmMessage,
  LlmRequest,
  LlmResponse,
  LlmStreamEvent,
  ModelDescriptor,
  ProviderConfig,
  ProviderDescriptor,
  ProviderFailure,
  TextPart,
  ToolCallPart,
  ToolSpec,
} from "@tessera/llm";
import { mapProviderError } from "@tessera/llm";
import type { Result, TesseraError } from "@tessera/std";
import { abortError, err, isOk, ok, tesseraError } from "@tessera/std";
import type { LanguageModel, ModelMessage, ToolSet } from "ai";
import { APICallError, generateText, jsonSchema, Output, stepCountIs, streamText, tool } from "ai";
import {
  ANTHROPIC_BROWSER_HEADER,
  ANTHROPIC_DESCRIPTOR,
  DEEPSEEK_DESCRIPTOR,
  GOOGLE_DESCRIPTOR,
  OLLAMA_DESCRIPTOR,
  OPENAI_COMPATIBLE_DESCRIPTOR,
  OPENAI_DESCRIPTOR,
  OPENROUTER_DESCRIPTOR,
  XAI_DESCRIPTOR,
} from "../descriptors.js";
import type { LlmClientDeps } from "../llm-client-deps.js";
import { withProviderRetries } from "../retries.js";

/**
 * Built-in adapter kinds (`07` §4).
 *
 * @public
 */
export type BuiltinProviderKind =
  | "openai"
  | "anthropic"
  | "google"
  | "xai"
  | "deepseek"
  | "openrouter"
  | "ollama"
  | "openai-compatible";

const DESCRIPTORS: Record<BuiltinProviderKind, ProviderDescriptor> = {
  openai: OPENAI_DESCRIPTOR,
  anthropic: ANTHROPIC_DESCRIPTOR,
  google: GOOGLE_DESCRIPTOR,
  xai: XAI_DESCRIPTOR,
  deepseek: DEEPSEEK_DESCRIPTOR,
  openrouter: OPENROUTER_DESCRIPTOR,
  ollama: OLLAMA_DESCRIPTOR,
  "openai-compatible": OPENAI_COMPATIBLE_DESCRIPTOR,
};

function isLanguageModel(value: object): value is LanguageModelV3 {
  return "doGenerate" in value && "specificationVersion" in value;
}

function withRetryable(error: TesseraError, retryable: boolean): TesseraError {
  if (!retryable) {
    return error;
  }
  return {
    ...error,
    details: { ...error.details, retryable: true },
  };
}

function httpFailure(
  status: number | undefined,
  retryAfterMs: number | undefined,
  vendorBody: string | undefined,
): ProviderFailure {
  return {
    kind: "http",
    ...(status === undefined ? {} : { status }),
    ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
    ...(vendorBody === undefined ? {} : { vendorBody }),
  };
}

function failureFromUnknown(error: unknown, signal?: AbortSignal): ProviderFailure {
  if (signal?.aborted) {
    return { kind: "abort" };
  }
  if (APICallError.isInstance(error)) {
    const status = error.statusCode;
    const header = error.responseHeaders?.["retry-after"];
    let retryAfterMs: number | undefined;
    if (header !== undefined) {
      const seconds = Number(header);
      if (Number.isFinite(seconds)) {
        retryAfterMs = seconds * 1000;
      }
    }
    return httpFailure(status, retryAfterMs, error.responseBody);
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  ) {
    return { kind: "abort" };
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "TimeoutError"
  ) {
    return { kind: "timeout" };
  }
  return { kind: "network" };
}

function isTesseraError(value: unknown): value is TesseraError {
  if (typeof value !== "object" || value === null || !("code" in value) || !("message" in value)) {
    return false;
  }
  if (typeof value.message !== "string") {
    return false;
  }
  switch (value.code) {
    case "INVALID_INPUT":
    case "NOT_FOUND":
    case "CONFLICT":
    case "INVARIANT_VIOLATION":
    case "PERMISSION_DENIED":
    case "UNSUPPORTED":
    case "CANCELLED":
    case "TIMEOUT":
    case "PROVIDER_ERROR":
    case "IO_ERROR":
    case "BUDGET_EXCEEDED":
    case "RATE_LIMITED":
      return true;
    default:
      return false;
  }
}

function mapCaught(error: unknown, signal?: AbortSignal): TesseraError {
  if (isTesseraError(error) && !APICallError.isInstance(error)) {
    return error;
  }
  const failure = failureFromUnknown(error, signal);
  const mapped = mapProviderError(failure);
  const retryable =
    failure.kind === "network" ||
    (failure.kind === "http" && failure.status !== undefined && failure.status >= 500);
  return withRetryable(mapped, retryable);
}

function mergeHeaders(
  extra: Readonly<Record<string, string>> | undefined,
  browserHeader: boolean,
): Record<string, string> {
  const headers: Record<string, string> = extra === undefined ? {} : { ...extra };
  if (browserHeader) {
    headers[ANTHROPIC_BROWSER_HEADER] = "true";
  }
  return headers;
}

function configProblem(
  kind: BuiltinProviderKind,
  config: ProviderConfig,
): TesseraError | undefined {
  if (config.providerId !== kind) {
    return tesseraError("INVALID_INPUT", "providerId does not match adapter");
  }
  const descriptor = DESCRIPTORS[kind];
  if (descriptor.browserDirect === "no" && config.proxyUrl === undefined) {
    return tesseraError("INVALID_INPUT", "proxyUrl required when browserDirect is no");
  }
  if (kind === "openai-compatible" && config.baseUrl === undefined) {
    return tesseraError("INVALID_INPUT", "openai-compatible requires baseUrl");
  }
  return undefined;
}

function effectiveBase(kind: BuiltinProviderKind, config: ProviderConfig): string {
  if (config.proxyUrl !== undefined) {
    return config.proxyUrl;
  }
  if (config.baseUrl !== undefined) {
    return config.baseUrl;
  }
  const fallback = DESCRIPTORS[kind].baseUrl.default;
  return fallback ?? "";
}

function toModelMessages(messages: readonly LlmMessage[]): ModelMessage[] {
  const out: ModelMessage[] = [];
  for (const message of messages) {
    if (message.role === "system") {
      out.push({ role: "system", content: message.content });
      continue;
    }
    if (message.role === "user") {
      const content = message.parts.map((part) => {
        if (part.kind === "text") {
          return { type: "text" as const, text: part.text };
        }
        return { type: "image" as const, image: part.data, mediaType: part.mime };
      });
      out.push({ role: "user", content });
      continue;
    }
    if (message.role === "assistant") {
      const content = message.parts.map((part) => {
        if (part.kind === "text") {
          return { type: "text" as const, text: part.text };
        }
        return {
          type: "tool-call" as const,
          toolCallId: part.callId,
          toolName: part.name,
          input: part.input,
        };
      });
      out.push({ role: "assistant", content });
      continue;
    }
    if (message.role === "tool") {
    }
  }
  return out;
}

function toolsFromSpec(specs: readonly ToolSpec[] | undefined): ToolSet | undefined {
  if (specs === undefined || specs.length === 0) {
    return undefined;
  }
  const tools: ToolSet = {};
  for (const spec of specs) {
    tools[spec.name] = tool({
      description: spec.description,
      inputSchema: jsonSchema(spec.inputSchema),
    });
  }
  return tools;
}

function mapFinishReason(reason: string): LlmResponse["finishReason"] {
  if (reason === "stop") {
    return "stop";
  }
  if (reason === "tool-calls") {
    return "tool_calls";
  }
  if (reason === "length") {
    return "length";
  }
  if (reason === "content-filter") {
    return "content_filter";
  }
  return "other";
}

function usageFrom(usage: unknown): LlmResponse["usage"] {
  if (typeof usage !== "object" || usage === null) {
    return { inputTokens: 0, outputTokens: 0 };
  }
  const inputTokens =
    "inputTokens" in usage && typeof usage.inputTokens === "number" ? usage.inputTokens : 0;
  const outputTokens =
    "outputTokens" in usage && typeof usage.outputTokens === "number" ? usage.outputTokens : 0;
  const cachedInputTokens =
    "cachedInputTokens" in usage && typeof usage.cachedInputTokens === "number"
      ? usage.cachedInputTokens
      : 0;
  return { inputTokens, outputTokens, cachedInputTokens };
}

function assistantFromGenerate(
  text: string,
  calls: readonly ToolCallPart[],
): LlmResponse["message"] {
  const parts: Array<TextPart | ToolCallPart> = [];
  if (text.length > 0) {
    parts.push({ kind: "text", text });
  }
  for (const call of calls) {
    parts.push(call);
  }
  if (parts.length === 0) {
    parts.push({ kind: "text", text: "" });
  }
  return { role: "assistant", parts };
}

async function readApiKey(
  descriptor: ProviderDescriptor,
  config: ProviderConfig,
  deps: LlmClientDeps,
): Promise<Result<string | undefined, TesseraError>> {
  if (descriptor.auth === "none") {
    return ok(undefined);
  }
  if (config.apiKeyRef === undefined) {
    return err(tesseraError("PERMISSION_DENIED", "apiKeyRef is missing"));
  }
  const secret = await deps.vault.get(config.apiKeyRef);
  if (!isOk(secret)) {
    return secret;
  }
  return ok(secret.value);
}

async function createSdkModel(
  kind: BuiltinProviderKind,
  config: ProviderConfig,
  deps: LlmClientDeps,
  modelId: string,
  apiKey: string | undefined,
): Promise<LanguageModel> {
  if (deps.languageModel !== undefined && isLanguageModel(deps.languageModel)) {
    return deps.languageModel;
  }
  const settings = {
    apiKey: apiKey ?? "",
    baseURL: effectiveBase(kind, config) || "http://localhost:11434/v1",
    headers: mergeHeaders(config.headers, kind === "anthropic"),
    fetch: deps.fetch ?? globalThis.fetch,
  };
  if (kind === "openai") {
    return createOpenAI(settings)(modelId);
  }
  if (kind === "anthropic") {
    return createAnthropic(settings)(modelId);
  }
  if (kind === "google") {
    return createGoogleGenerativeAI(settings)(modelId);
  }
  if (kind === "xai") {
    return createXai(settings)(modelId);
  }
  if (kind === "deepseek") {
    return createDeepSeek(settings)(modelId);
  }
  if (kind === "openrouter") {
    return createOpenRouter(settings)(modelId);
  }
  return createOpenAICompatible({
    name: kind === "ollama" ? "ollama" : "openai-compatible",
    ...settings,
  })(modelId);
}

function parseOpenAiStyleModels(refProvider: string, body: unknown): readonly ModelDescriptor[] {
  if (typeof body !== "object" || body === null || !("data" in body)) {
    return [];
  }
  const data = body.data;
  if (!Array.isArray(data)) {
    return [];
  }
  const models: ModelDescriptor[] = [];
  for (const row of data) {
    if (typeof row !== "object" || row === null || !("id" in row) || typeof row.id !== "string") {
      continue;
    }
    models.push({
      ref: { providerId: refProvider, modelId: row.id },
      displayName: row.id,
      declared: {},
    });
  }
  return models;
}

function parseOllamaTags(body: unknown): readonly ModelDescriptor[] {
  if (typeof body !== "object" || body === null || !("models" in body)) {
    return [];
  }
  const modelsField = body.models;
  if (!Array.isArray(modelsField)) {
    return [];
  }
  const models: ModelDescriptor[] = [];
  for (const row of modelsField) {
    if (typeof row !== "object" || row === null) {
      continue;
    }
    const name = "name" in row && typeof row.name === "string" ? row.name : undefined;
    if (name === undefined) {
      continue;
    }
    models.push({
      ref: { providerId: "ollama", modelId: name },
      displayName: name,
      declared: {},
    });
  }
  return models;
}

function parseOpenRouterCatalog(body: unknown): readonly ModelDescriptor[] {
  if (typeof body !== "object" || body === null || !("data" in body)) {
    return [];
  }
  const data = body.data;
  if (!Array.isArray(data)) {
    return [];
  }
  const models: ModelDescriptor[] = [];
  for (const row of data) {
    if (typeof row !== "object" || row === null || !("id" in row) || typeof row.id !== "string") {
      continue;
    }
    const contextTokens =
      "context_length" in row && typeof row.context_length === "number"
        ? row.context_length
        : undefined;
    const name = "name" in row && typeof row.name === "string" ? row.name : row.id;
    let pricing: ModelDescriptor["pricing"];
    if ("pricing" in row && typeof row.pricing === "object" && row.pricing !== null) {
      const pricingRow = row.pricing;
      const prompt =
        "prompt" in pricingRow && typeof pricingRow.prompt === "string"
          ? Number(pricingRow.prompt)
          : undefined;
      const completion =
        "completion" in pricingRow && typeof pricingRow.completion === "string"
          ? Number(pricingRow.completion)
          : undefined;
      if (
        prompt !== undefined &&
        completion !== undefined &&
        Number.isFinite(prompt) &&
        Number.isFinite(completion)
      ) {
        pricing = {
          inputPerMTokUsd: prompt * 1_000_000,
          outputPerMTokUsd: completion * 1_000_000,
        };
      }
    }
    models.push({
      ref: { providerId: "openrouter", modelId: row.id },
      displayName: name,
      ...(contextTokens !== undefined ? { contextTokens } : {}),
      ...(pricing !== undefined ? { pricing } : {}),
      declared: {},
    });
  }
  return models;
}

function parseGoogleModels(body: unknown): readonly ModelDescriptor[] {
  if (typeof body !== "object" || body === null || !("models" in body)) {
    return [];
  }
  const modelsField = body.models;
  if (!Array.isArray(modelsField)) {
    return [];
  }
  const models: ModelDescriptor[] = [];
  for (const row of modelsField) {
    if (
      typeof row !== "object" ||
      row === null ||
      !("name" in row) ||
      typeof row.name !== "string"
    ) {
      continue;
    }
    const modelId = row.name.replace(/^models\//, "");
    models.push({
      ref: { providerId: "google", modelId },
      displayName: modelId,
      declared: {},
    });
  }
  return models;
}

function jsonRequestInit(
  headers: Record<string, string>,
  signal: AbortSignal | undefined,
): RequestInit {
  if (signal === undefined) {
    return { headers };
  }
  return { headers, signal };
}

async function fetchJson(
  deps: LlmClientDeps,
  url: string,
  init: RequestInit,
): Promise<Result<unknown, TesseraError>> {
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  try {
    const response = await fetchImpl(url, init);
    const text = await response.text();
    if (!response.ok) {
      return err(
        withRetryable(
          mapProviderError({
            kind: "http",
            status: response.status,
            vendorBody: text,
          }),
          response.status >= 500,
        ),
      );
    }
    if (text.length === 0) {
      return ok(undefined);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return err(tesseraError("PROVIDER_ERROR", "provider returned invalid json"));
    }
    return ok(parsed);
  } catch (error) {
    return err(mapCaught(error));
  }
}

async function listModelsForKind(
  kind: BuiltinProviderKind,
  config: ProviderConfig,
  deps: LlmClientDeps,
  signal?: AbortSignal,
): Promise<Result<readonly ModelDescriptor[], TesseraError>> {
  const key = await readApiKey(DESCRIPTORS[kind], config, deps);
  if (!isOk(key)) {
    return key;
  }
  const headers: Record<string, string> = { ...(config.headers ?? {}) };
  if (kind === "anthropic") {
    headers[ANTHROPIC_BROWSER_HEADER] = "true";
    if (key.value !== undefined) {
      headers["x-api-key"] = key.value;
      headers["anthropic-version"] = "2023-06-01";
    }
  } else if (key.value !== undefined) {
    headers["Authorization"] = `Bearer ${key.value}`;
  }
  const base = effectiveBase(kind, config);
  if (kind === "ollama") {
    const origin = base.replace(/\/v1\/?$/, "");
    const listed = await fetchJson(deps, `${origin}/api/tags`, jsonRequestInit(headers, signal));
    if (!isOk(listed)) {
      return listed;
    }
    return ok(parseOllamaTags(listed.value));
  }
  if (kind === "openrouter") {
    const listed = await fetchJson(deps, `${base}/models`, jsonRequestInit(headers, signal));
    if (!isOk(listed)) {
      return listed;
    }
    return ok(parseOpenRouterCatalog(listed.value));
  }
  if (kind === "google") {
    const query = key.value === undefined ? "" : `?key=${encodeURIComponent(key.value)}`;
    const listed = await fetchJson(
      deps,
      `${base}/models${query}`,
      jsonRequestInit(headers, signal),
    );
    if (!isOk(listed)) {
      return listed;
    }
    return ok(parseGoogleModels(listed.value));
  }
  const listed = await fetchJson(deps, `${base}/models`, jsonRequestInit(headers, signal));
  if (!isOk(listed)) {
    return listed;
  }
  return ok(parseOpenAiStyleModels(kind, listed.value));
}

function toolCallsFromUnknown(value: unknown): readonly ToolCallPart[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const calls: ToolCallPart[] = [];
  for (const row of value) {
    if (typeof row !== "object" || row === null) {
      continue;
    }
    const callId =
      "toolCallId" in row && typeof row.toolCallId === "string" ? row.toolCallId : undefined;
    const name = "toolName" in row && typeof row.toolName === "string" ? row.toolName : undefined;
    if (callId === undefined || name === undefined) {
      continue;
    }
    const input = "input" in row ? row.input : undefined;
    calls.push({ kind: "toolCall", callId, name, input });
  }
  return calls;
}

/**
 * Shared AI SDK mapping. The only module that imports `ai` / `@ai-sdk/*` / `@openrouter/*`.
 *
 * @example
 * ```ts
 * createAiSdkLlmClient("openai", { providerId: "openai", apiKeyRef: "k" }, deps);
 * ```
 *
 * @public
 */
export function createAiSdkLlmClient(
  kind: BuiltinProviderKind,
  config: ProviderConfig,
  deps: LlmClientDeps,
): LlmClient {
  const provider = DESCRIPTORS[kind];
  const invalid = configProblem(kind, config);

  const generateOnce = async (
    request: LlmRequest,
    signal?: AbortSignal,
  ): Promise<Result<LlmResponse, TesseraError>> => {
    if (invalid !== undefined) {
      return err(invalid);
    }
    if (signal?.aborted) {
      return err(abortError());
    }
    const key = await readApiKey(provider, config, deps);
    if (!isOk(key)) {
      return key;
    }
    deps.logger.info("providers_llm.generate.start", {
      providerId: kind,
      modelId: request.model.modelId,
    });
    try {
      const model = await createSdkModel(kind, config, deps, request.model.modelId, key.value);
      const tools = toolsFromSpec(request.tools);
      const result = await generateText({
        model,
        messages: toModelMessages(request.messages),
        maxRetries: 0,
        stopWhen: stepCountIs(1),
        abortSignal: signal ?? new AbortController().signal,
        temperature: request.temperature ?? 0,
        maxOutputTokens: request.maxOutputTokens ?? 4096,
        ...(tools === undefined ? {} : { tools }),
        ...(request.responseFormat === undefined
          ? {}
          : {
              output: Output.object({
                schema: jsonSchema(request.responseFormat.schema),
                name: request.responseFormat.name,
              }),
            }),
        toolChoice:
          request.toolChoice === undefined
            ? "auto"
            : typeof request.toolChoice === "string"
              ? request.toolChoice
              : { type: "tool", toolName: request.toolChoice.name },
      });
      const calls = toolCallsFromUnknown(result.toolCalls);
      const response: LlmResponse = {
        message: assistantFromGenerate(result.text, calls),
        usage: usageFrom(result.usage),
        finishReason: mapFinishReason(result.finishReason),
        modelId: result.response.modelId ?? request.model.modelId,
      };
      return ok(response);
    } catch (error) {
      const mapped = mapCaught(error, signal);
      deps.logger.info("providers_llm.generate.failed", {
        providerId: kind,
        code: mapped.code,
      });
      return err(mapped);
    }
  };

  const client: LlmClient = {
    provider,
    async listModels(signal) {
      if (invalid !== undefined) {
        return err(invalid);
      }
      return withProviderRetries(deps.clock, deps.sleep, signal, () =>
        listModelsForKind(kind, config, deps, signal),
      );
    },
    async generate(request, signal) {
      return withProviderRetries(deps.clock, deps.sleep, signal, () =>
        generateOnce(request, signal),
      );
    },
    async *stream(request, signal): AsyncIterable<LlmStreamEvent> {
      if (invalid !== undefined) {
        throw invalid;
      }
      const key = await readApiKey(provider, config, deps);
      if (!isOk(key)) {
        throw key.error;
      }
      let lastError: TesseraError | undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (signal?.aborted) {
          throw abortError();
        }
        try {
          const model = await createSdkModel(kind, config, deps, request.model.modelId, key.value);
          const tools = toolsFromSpec(request.tools);
          const result = streamText({
            model,
            messages: toModelMessages(request.messages),
            maxRetries: 0,
            stopWhen: stepCountIs(1),
            abortSignal: signal ?? new AbortController().signal,
            temperature: request.temperature ?? 0,
            maxOutputTokens: request.maxOutputTokens ?? 4096,
            ...(tools === undefined ? {} : { tools }),
          });
          let text = "";
          const calls: ToolCallPart[] = [];
          let finish: LlmResponse["finishReason"] = "other";
          let usage: LlmResponse["usage"] = { inputTokens: 0, outputTokens: 0 };
          let modelId = request.model.modelId;
          for await (const part of result.fullStream) {
            if (part.type === "text-delta") {
              text += part.text;
              yield { type: "text.delta", text: part.text };
              continue;
            }
            if (part.type === "tool-call") {
              const call: ToolCallPart = {
                kind: "toolCall",
                callId: part.toolCallId,
                name: part.toolName,
                input: part.input,
              };
              calls.push(call);
              yield { type: "tool.call", call };
              continue;
            }
            if (part.type === "finish") {
              finish = mapFinishReason(part.finishReason);
              usage = usageFrom(part.totalUsage);
              continue;
            }
            if (part.type === "error") {
              throw part.error;
            }
            if (part.type === "abort") {
              throw abortError();
            }
            if (part.type === "finish-step" && part.response.modelId !== undefined) {
              modelId = part.response.modelId;
            }
          }
          const response: LlmResponse = {
            message: assistantFromGenerate(text, calls),
            usage,
            finishReason: finish,
            modelId,
          };
          yield { type: "done", response };
          return;
        } catch (error) {
          lastError = mapCaught(error, signal);
          if (lastError.code === "CANCELLED" || lastError.code === "PERMISSION_DENIED") {
            throw lastError;
          }
          const retryable =
            lastError.code === "RATE_LIMITED" || lastError.details?.["retryable"] === true;
          if (!retryable || attempt === 2) {
            throw lastError;
          }
          if (deps.sleep !== undefined) {
            await deps.sleep(500 * 2 ** attempt, signal);
          }
        }
      }
      throw lastError ?? abortError();
    },
    async testConnection(signal) {
      const started = deps.clock.now();
      const listed = await client.listModels(signal);
      if (!isOk(listed)) {
        return listed;
      }
      return ok({ latencyMs: deps.clock.now() - started });
    },
  };
  return client;
}
