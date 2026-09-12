import type {
  GenerationEstimate,
  GenerationProvider,
  GenerationProviderDescriptor,
  GenerationRequest,
  GenerationResult,
} from "@tessera/generation";
import type { Result, TesseraError } from "@tessera/std";
import { err, ok } from "@tessera/std";
import { type GenerationHttp, requestJson } from "./http.js";
import { mapGenerationError } from "./map-provider-error.js";
import { mapState, readString } from "./rest-provider.js";

const DESCRIPTOR: GenerationProviderDescriptor = {
  id: "local-worker",
  displayName: "Local generation worker",
  auth: "none",
  capabilities: {
    textToMesh: true,
    imageToMesh: true,
    textToTexture: true,
    meshToTexture: true,
    textToImage: true,
    textToEnvironment: true,
  },
  outputLicense: "CC0-1.0",
  typicalSeconds: { mesh: 15, texture: 8 },
  docsUrl: "https://github.com/Elshayib/tessera/tree/main/bridges/generation-worker",
};

/**
 * Options for {@link createLocalWorkerProvider} (`07` §8.3).
 *
 * @public
 */
export interface LocalWorkerConfig {
  readonly baseUrl: string;
  readonly http: GenerationHttp;
  readonly bearerToken?: string;
}

/**
 * Local worker HTTP adapter (`07` §8.3).
 *
 * @example
 * ```ts
 * createLocalWorkerProvider({ baseUrl: "http://127.0.0.1:8090", http });
 * ```
 *
 * @public
 */
export function createLocalWorkerProvider(config: LocalWorkerConfig): GenerationProvider {
  const headers = (): Readonly<Record<string, string>> => {
    if (config.bearerToken === undefined) {
      return {};
    }
    return { authorization: `Bearer ${config.bearerToken}` };
  };
  const root = config.baseUrl.replace(/\/$/, "");
  return {
    descriptor: DESCRIPTOR,
    async estimate(request: GenerationRequest): Promise<Result<GenerationEstimate, TesseraError>> {
      const seconds =
        request.kind === "texture"
          ? DESCRIPTOR.typicalSeconds.texture
          : DESCRIPTOR.typicalSeconds.mesh;
      return ok({ seconds });
    },
    async submit(request, signal) {
      const posted = await requestJson(
        config.http,
        {
          method: "POST",
          url: `${root}/v1/jobs`,
          headers: { "content-type": "application/json", ...headers() },
          body: request,
        },
        signal,
      );
      if (!posted.ok) {
        return posted;
      }
      const id = readString(posted.value, "id");
      if (id === undefined) {
        return err(mapGenerationError({ kind: "network" }));
      }
      return ok({ remoteJobId: id });
    },
    async poll(remoteJobId, signal) {
      const polled = await requestJson(
        config.http,
        { method: "GET", url: `${root}/v1/jobs/${remoteJobId}`, headers: headers() },
        signal,
      );
      if (!polled.ok) {
        return polled;
      }
      const progress = readNumber(polled.value, "progress");
      const message = readString(polled.value, "message");
      return ok({
        state: mapState(readString(polled.value, "state")),
        ...(progress === undefined ? {} : { progress }),
        ...(message === undefined ? {} : { message }),
      });
    },
    async fetchResult(remoteJobId, blobs, signal) {
      const payload = await requestJson(
        config.http,
        { method: "GET", url: `${root}/v1/jobs/${remoteJobId}/result`, headers: headers() },
        signal,
      );
      if (!payload.ok) {
        return payload;
      }
      const fileBody = readString(payload.value, "file") ?? "glb";
      const written = await blobs.write(
        new TextEncoder().encode(fileBody),
        "model/gltf-binary",
        "generated.glb",
        signal,
      );
      if (!written.ok) {
        return written;
      }
      const result: GenerationResult = {
        kind: "mesh",
        blobs: [written.value],
        license: DESCRIPTOR.outputLicense === "per-plan" ? "CC0-1.0" : DESCRIPTOR.outputLicense,
        provenance: {
          source: "generated",
          importedAt: "2026-01-01T00:00:00.000Z",
          generator: {
            provider: DESCRIPTOR.id,
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
        { method: "DELETE", url: `${root}/v1/jobs/${remoteJobId}`, headers: headers() },
        new AbortController().signal,
      );
    },
  };
}

export const LOCAL_WORKER_DESCRIPTOR = DESCRIPTOR;

function readNumber(value: unknown, key: string): number | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const record: Record<string, unknown> = { ...value };
  const found = record[key];
  return typeof found === "number" ? found : undefined;
}
