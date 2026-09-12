import type {
  GenerationPollResult,
  GenerationProvider,
  GenerationProviderDescriptor,
  GenerationRequest,
  GenerationResult,
} from "@tessera/generation";
import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import { type GenerationHttp, requestJson } from "./http.js";
import { mapGenerationError } from "./map-provider-error.js";

/**
 * Config for a REST generation adapter.
 *
 * @public
 */
export interface RestGenerationConfig {
  readonly apiKey?: string;
  readonly http: GenerationHttp;
}

/**
 * Per-vendor REST mapping.
 *
 * @internal
 */
interface RestGenerationSpec {
  readonly descriptor: GenerationProviderDescriptor;
  readonly baseUrl: string;
  submitPath(request: GenerationRequest): { readonly path: string; readonly body: unknown };
  pollPath(remoteJobId: string): string;
  resultPath(remoteJobId: string): string;
  cancelPath(remoteJobId: string): string;
  readRemoteId(payload: unknown): string | undefined;
  readPoll(payload: unknown): GenerationPollResult;
  readResultUrl(payload: unknown): string | undefined;
}

/**
 * Shared REST {@link GenerationProvider}.
 *
 * @public
 */
export function createRestGenerationProvider(
  spec: RestGenerationSpec,
  config: RestGenerationConfig,
): GenerationProvider {
  const authHeaders = (): Readonly<Record<string, string>> => {
    if (config.apiKey === undefined || config.apiKey.length === 0) {
      return {};
    }
    return { authorization: `Bearer ${config.apiKey}` };
  };
  const requireKey = (): Result<void, TesseraError> => {
    if (
      spec.descriptor.auth === "apiKey" &&
      (config.apiKey === undefined || config.apiKey.length === 0)
    ) {
      return err(tesseraError("PERMISSION_DENIED", "generation api key missing"));
    }
    return ok(undefined);
  };
  return {
    descriptor: spec.descriptor,
    async estimate(request) {
      const seconds =
        request.kind === "texture"
          ? spec.descriptor.typicalSeconds.texture
          : spec.descriptor.typicalSeconds.mesh;
      return ok({ seconds });
    },
    async submit(request, signal) {
      const key = requireKey();
      if (!key.ok) {
        return key;
      }
      const mapped = spec.submitPath(request);
      const posted = await requestJson(
        config.http,
        {
          method: "POST",
          url: `${spec.baseUrl}${mapped.path}`,
          headers: { "content-type": "application/json", ...authHeaders() },
          body: mapped.body,
        },
        signal,
      );
      if (!posted.ok) {
        return posted;
      }
      const remoteJobId = spec.readRemoteId(posted.value);
      if (remoteJobId === undefined) {
        return err(mapGenerationError({ kind: "network" }));
      }
      return ok({ remoteJobId });
    },
    async poll(remoteJobId, signal) {
      const polled = await requestJson(
        config.http,
        {
          method: "GET",
          url: `${spec.baseUrl}${spec.pollPath(remoteJobId)}`,
          headers: authHeaders(),
        },
        signal,
      );
      if (!polled.ok) {
        return polled;
      }
      return ok(spec.readPoll(polled.value));
    },
    async fetchResult(remoteJobId, blobs, signal) {
      const payload = await requestJson(
        config.http,
        {
          method: "GET",
          url: `${spec.baseUrl}${spec.resultPath(remoteJobId)}`,
          headers: authHeaders(),
        },
        signal,
      );
      if (!payload.ok) {
        return payload;
      }
      const url = spec.readResultUrl(payload.value);
      if (url === undefined) {
        return err(tesseraError("PROVIDER_ERROR", "generation result missing url"));
      }
      const downloaded = await config.http.request(
        { method: "GET", url, headers: authHeaders() },
        signal,
      );
      if (!downloaded.ok) {
        return downloaded;
      }
      const bytes = new TextEncoder().encode(downloaded.value.body);
      const written = await blobs.write(
        bytes,
        mimeFor(payloadKind(payload.value)),
        "generated.bin",
        signal,
      );
      if (!written.ok) {
        return written;
      }
      const result: GenerationResult = {
        kind: payloadKind(payload.value),
        blobs: [written.value],
        license:
          spec.descriptor.outputLicense === "per-plan"
            ? "CC-BY-4.0"
            : spec.descriptor.outputLicense,
        provenance: {
          source: "generated",
          importedAt: "2026-01-01T00:00:00.000Z",
          generator: {
            provider: spec.descriptor.id,
            promptHash: "sha256-0000000000000000000000000000000000000000000000000000000000000000",
            jobId: remoteJobId,
          },
        },
      };
      return ok(result);
    },
    async cancel(remoteJobId) {
      await requestJson(
        config.http,
        {
          method: "DELETE",
          url: `${spec.baseUrl}${spec.cancelPath(remoteJobId)}`,
          headers: authHeaders(),
        },
        new AbortController().signal,
      );
    },
  };
}

function payloadKind(payload: unknown): GenerationResult["kind"] {
  const kind = readString(payload, "kind");
  if (kind === "mesh" || kind === "texture" || kind === "environment" || kind === "image") {
    return kind;
  }
  return "mesh";
}

function mimeFor(kind: GenerationResult["kind"]): string {
  if (kind === "mesh") {
    return "model/gltf-binary";
  }
  if (kind === "environment") {
    return "image/vnd.radiance";
  }
  return "image/png";
}

export function readString(value: unknown, key: string): string | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const record: Record<string, unknown> = { ...value };
  const found = record[key];
  return typeof found === "string" ? found : undefined;
}

export function mapState(raw: string | undefined): GenerationPollResult["state"] {
  const lower = (raw ?? "").toLowerCase();
  if (lower === "queued" || lower === "pending") {
    return "queued";
  }
  if (lower === "running" || lower === "processing" || lower === "in_progress") {
    return "running";
  }
  if (lower === "succeeded" || lower === "success" || lower === "completed") {
    return "succeeded";
  }
  return "failed";
}
