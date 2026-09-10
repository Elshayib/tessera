import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  LlmClient,
  LlmRequest,
  LlmResponse,
  LlmStreamEvent,
  ModelDescriptor,
} from "@tessera/llm";
import type { Result, TesseraError } from "@tessera/std";
import { redact } from "@tessera/std";
import {
  hashLlmRequest,
  type LlmRecording,
  messagesForHash,
  stripVolatileFields,
  systemPromptHashOf,
} from "./replay-llm-client.js";

/**
 * Recordings older than this should warn (`13` §4).
 *
 * @public
 */
export const RECORDING_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

const SECRET_PATTERNS: readonly RegExp[] = [
  /sk-[A-Za-z0-9]{8,}/,
  /sk-ant-[A-Za-z0-9_-]{8,}/,
  /AIza[0-9A-Za-z_-]{20,}/,
  /Bearer\s+[A-Za-z0-9._~+/-]+=*/,
];

/**
 * Options for {@link RecordingLlmClient}.
 *
 * @public
 */
export interface RecordingLlmClientOptions {
  readonly suite: string;
  readonly caseId: string;
  readonly fixturesRoot: string;
  readonly env?: { readonly TESSERA_RECORD?: string };
  readonly writeFile?: (path: string, json: string) => Promise<void>;
  readonly mkdir?: (path: string) => Promise<void>;
}

/**
 * Wraps an {@link LlmClient} and writes redacted fixtures when `TESSERA_RECORD=1` (`13` §4).
 *
 * @example
 * ```ts
 * new RecordingLlmClient(inner, { suite: "core", caseId: "table", fixturesRoot: "fixtures/recordings" });
 * ```
 *
 * @public
 */
export class RecordingLlmClient implements LlmClient {
  readonly provider;
  private readonly inner: LlmClient;
  private readonly options: RecordingLlmClientOptions;

  constructor(inner: LlmClient, options: RecordingLlmClientOptions) {
    this.inner = inner;
    this.provider = inner.provider;
    this.options = options;
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
      await this.maybeWrite(request, result.value);
    }
    return result;
  }

  async *stream(request: LlmRequest, signal?: AbortSignal): AsyncIterable<LlmStreamEvent> {
    for await (const event of this.inner.stream(request, signal)) {
      if (event.type === "done") {
        await this.maybeWrite(request, event.response);
      }
      yield event;
    }
  }

  private async maybeWrite(request: LlmRequest, response: LlmResponse): Promise<void> {
    const flag = this.options.env?.TESSERA_RECORD ?? process.env["TESSERA_RECORD"];
    if (flag !== "1") {
      return;
    }
    const recording = toRecording(request, response);
    const json = `${JSON.stringify(redactRecording(recording), null, 2)}\n`;
    const path = recordingPath(this.inner.provider.id, this.options, request.model.modelId);
    const dir = dirname(path);
    if (this.options.mkdir !== undefined) {
      await this.options.mkdir(dir);
    } else {
      await mkdir(dir, { recursive: true });
    }
    if (this.options.writeFile !== undefined) {
      await this.options.writeFile(path, json);
      return;
    }
    await writeFile(path, json, "utf8");
  }
}

function toRecording(request: LlmRequest, response: LlmResponse): LlmRecording {
  return {
    requestHash: hashLlmRequest(request),
    request: {
      model: request.model,
      systemPromptHash: systemPromptHashOf(request.messages),
      messages: stripVolatileFields(messagesForHash(request.messages)),
      toolNames: request.tools?.map((tool) => tool.name) ?? [],
    },
    response,
    usage: response.usage,
  };
}

function redactRecording(recording: LlmRecording): unknown {
  return stripVolatileFields(redact(recording));
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_");
}

function recordingPath(
  providerId: string,
  options: RecordingLlmClientOptions,
  modelId: string,
): string {
  const file = `${sanitizeSegment(options.caseId)}.${sanitizeSegment(modelId)}.json`;
  return join(
    options.fixturesRoot,
    sanitizeSegment(providerId),
    sanitizeSegment(options.suite),
    file,
  );
}

/**
 * Warns when recording files are older than {@link RECORDING_MAX_AGE_MS} (`13` §4).
 *
 * Age uses filesystem mtime because payload dates are already `<ts>` (Q-0146).
 *
 * @public
 */
export function warnStaleRecordings(
  entries: readonly { readonly path: string; readonly mtimeMs: number }[],
  nowMs: number,
  warn: (message: string) => void,
): void {
  for (const entry of entries) {
    if (nowMs - entry.mtimeMs > RECORDING_MAX_AGE_MS) {
      warn(`recording older than 180 days: ${entry.path}`);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function walkStrings(value: unknown, visit: (text: string) => void): void {
  if (typeof value === "string") {
    visit(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      walkStrings(item, visit);
    }
    return;
  }
  if (isRecord(value)) {
    for (const nested of Object.values(value)) {
      walkStrings(nested, visit);
    }
  }
}

/**
 * Scans JSON recordings for secret-looking strings (`INV-TST-04`).
 *
 * @public
 */
export function scanRecordingsForSecrets(
  texts: readonly { readonly path: string; readonly text: string }[],
): readonly string[] {
  const hits: string[] = [];
  for (const file of texts) {
    if (file.text.includes("[redacted]")) {
      // Keys already redacted; still scan remaining string values.
    }
    const parsed: unknown = JSON.parse(file.text);
    walkStrings(parsed, (text) => {
      if (text === "[redacted]" || text === "<ts>" || text === "<id>") {
        return;
      }
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.test(text)) {
          hits.push(`${file.path}: secret-like string`);
        }
      }
    });
  }
  return hits;
}

/**
 * Reads JSON files under `root` (non-recursive one level of provider/suite is walked).
 *
 * @public
 */
export async function loadRecordingTexts(
  root: string,
): Promise<readonly { readonly path: string; readonly text: string }[]> {
  const out: { path: string; text: string }[] = [];
  await walkDir(root, out);
  return out;
}

async function walkDir(dir: string, out: { path: string; text: string }[]): Promise<void> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walkDir(path, out);
        continue;
      }
      if (entry.name.endsWith(".json")) {
        out.push({ path, text: await readFile(path, "utf8") });
      }
    }
  } catch {
    return;
  }
}
