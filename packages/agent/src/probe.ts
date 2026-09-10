import type {
  LlmClient,
  LlmMessage,
  LlmRequest,
  LlmResponse,
  ModelDescriptor,
  ModelRef,
  ToolCallPart,
  ToolSpec,
} from "@tessera/llm";
import { resolveContextLimits, userImage, userText, withDefaultMaxTools } from "@tessera/llm";
import type { Clock, Result, TesseraError } from "@tessera/std";
import { ok } from "@tessera/std";
import type { ProbeCache } from "./probe-cache.js";
import type { CapabilityProfile } from "./types.js";

const ECHO_TOOL: ToolSpec = {
  name: "echo",
  description: "Echo a string value",
  inputSchema: {
    type: "object",
    properties: { value: { type: "string" } },
    required: ["value"],
  },
};

const STRUCTURED_SCHEMA = {
  type: "object",
  properties: { a: { type: "number" }, b: { type: "number" } },
};

const RED_SQUARE_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAb0lEQVR4nO3PAQkAAAyEwO9feoshgnABdLep8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3IPanc8OLDQitxAAAAAElFTkSuQmCC";

const JSON_MODE_PROMPT =
  'Reply with a JSON object {"name":"echo","input":{"value":"ok"}} and nothing else.';

function decodeBase64(value: string): Uint8Array {
  const decoded = globalThis.atob(value);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index++) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}

function assistantTextOf(response: LlmResponse): string {
  let text = "";
  for (const part of response.message.parts) {
    if (part.kind === "text") {
      text += part.text;
    }
  }
  return text;
}

function toolCallsOf(response: LlmResponse): readonly ToolCallPart[] {
  return response.message.parts.filter((part): part is ToolCallPart => part.kind === "toolCall");
}

function looksLikePair(text: string): boolean {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return false;
  }
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    if (typeof parsed !== "object" || parsed === null) {
      return false;
    }
    return "a" in parsed && "b" in parsed;
  } catch {
    return false;
  }
}

function looksLikeJsonTool(text: string): boolean {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return false;
  }
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    if (typeof parsed !== "object" || parsed === null || !("name" in parsed)) {
      return false;
    }
    return parsed.name === "echo";
  } catch {
    return false;
  }
}

async function generate(
  client: LlmClient,
  request: LlmRequest,
  signal: AbortSignal | undefined,
): Promise<Result<LlmResponse, TesseraError>> {
  return client.generate(request, signal);
}

function userPrompt(text: string): LlmMessage {
  return userText(text);
}

/**
 * Probes a model with ≤ 4 `LlmClient.generate` calls (`07` §3).
 *
 * @example
 * ```ts
 * const profile = await probeModel({ client, ref, cache, clock });
 * ```
 *
 * @public
 */
export async function probeModel(input: {
  readonly client: LlmClient;
  readonly ref: ModelRef;
  readonly descriptor?: ModelDescriptor;
  readonly cache: ProbeCache;
  readonly clock: Clock;
  readonly signal?: AbortSignal;
}): Promise<Result<CapabilityProfile, TesseraError>> {
  const cached = input.cache.get(input.ref, input.clock.now());
  if (cached !== undefined) {
    return ok(cached);
  }
  const limits = resolveContextLimits({
    ...(input.descriptor?.contextTokens === undefined
      ? {}
      : { contextTokens: input.descriptor.contextTokens }),
    ...(input.descriptor?.maxOutputTokens === undefined
      ? {}
      : { maxOutputTokens: input.descriptor.maxOutputTokens }),
  });
  const maxTools = withDefaultMaxTools(input.descriptor?.declared.maxTools);
  let tools: CapabilityProfile["tools"] = "none";
  let parallelTools = false;
  let vision = false;
  let structuredOutput = false;
  let calls = 0;

  const native = await generate(
    input.client,
    {
      model: input.ref,
      messages: [userPrompt("Call echo with value 'ok'.")],
      tools: [ECHO_TOOL],
      toolChoice: "required",
    },
    input.signal,
  );
  calls += 1;
  if (!native.ok) {
    return native;
  }
  if (toolCallsOf(native.value).length > 0) {
    tools = "native";
  } else {
    const json = await generate(
      input.client,
      {
        model: input.ref,
        messages: [userPrompt(JSON_MODE_PROMPT)],
      },
      input.signal,
    );
    calls += 1;
    if (!json.ok) {
      return json;
    }
    if (looksLikeJsonTool(assistantTextOf(json.value))) {
      tools = "json";
    }
  }

  if (tools !== "none" && calls < 4) {
    const parallel = await generate(
      input.client,
      {
        model: input.ref,
        messages: [userPrompt("Call echo twice with two echo calls.")],
        tools: [ECHO_TOOL],
        toolChoice: "required",
      },
      input.signal,
    );
    calls += 1;
    if (!parallel.ok) {
      return parallel;
    }
    if (
      toolCallsOf(parallel.value).length >= 2 ||
      looksLikeJsonTool(assistantTextOf(parallel.value))
    ) {
      parallelTools = toolCallsOf(parallel.value).length >= 2;
    }
  }

  if (calls < 4) {
    const visionResult = await generate(
      input.client,
      {
        model: input.ref,
        messages: [
          userImage("image/png", decodeBase64(RED_SQUARE_PNG_B64)),
          userPrompt("What color is the square? One word."),
        ],
      },
      input.signal,
    );
    calls += 1;
    if (!visionResult.ok) {
      return visionResult;
    }
    vision = /red/i.test(assistantTextOf(visionResult.value));
  }

  if (calls < 4) {
    const structured = await generate(
      input.client,
      {
        model: input.ref,
        messages: [userPrompt("Return a and b.")],
        responseFormat: {
          kind: "json_schema",
          name: "pair",
          schema: STRUCTURED_SCHEMA,
        },
      },
      input.signal,
    );
    calls += 1;
    if (!structured.ok) {
      return structured;
    }
    structuredOutput = looksLikePair(assistantTextOf(structured.value));
  }

  const profile: CapabilityProfile = {
    ref: input.ref,
    tools,
    parallelTools,
    vision,
    structuredOutput,
    streaming: input.descriptor?.declared.streaming === true,
    contextTokens: limits.contextTokens,
    maxOutputTokens: limits.maxOutputTokens,
    maxTools,
    needsExamples: false,
  };
  input.cache.set(input.ref, profile, input.clock.now());
  return ok(profile);
}
