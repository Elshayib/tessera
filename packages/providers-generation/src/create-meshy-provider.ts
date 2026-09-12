import type { GenerationProvider, GenerationProviderDescriptor } from "@tessera/generation";
import {
  createRestGenerationProvider,
  mapState,
  type RestGenerationConfig,
  readString,
} from "./rest-provider.js";

/** @internal vendor URL confined to this package (INV-PRV-01). */
export const MESHY_API_ROOT = "https://api.meshy.ai/openapi/v2";

const DESCRIPTOR: GenerationProviderDescriptor = {
  id: "meshy",
  displayName: "Meshy",
  auth: "apiKey",
  capabilities: {
    textToMesh: true,
    imageToMesh: true,
    textToTexture: true,
    meshToTexture: true,
    textToImage: false,
    textToEnvironment: false,
  },
  outputLicense: "per-plan",
  typicalSeconds: { mesh: 60, texture: 30 },
  docsUrl: "https://docs.meshy.ai/",
};

/**
 * Meshy REST adapter (`07` §8.2).
 *
 * @example
 * ```ts
 * createMeshyProvider({ http, apiKey: "sk" });
 * ```
 *
 * @public
 */
export function createMeshyProvider(config: RestGenerationConfig): GenerationProvider {
  return createRestGenerationProvider(
    {
      descriptor: DESCRIPTOR,
      baseUrl: MESHY_API_ROOT,
      submitPath: (request) => ({
        path: request.kind === "texture" ? "/text-to-texture" : "/text-to-3d",
        body: { prompt: "prompt" in request ? request.prompt : "" },
      }),
      pollPath: (id) => `/text-to-3d/${id}`,
      resultPath: (id) => `/text-to-3d/${id}`,
      cancelPath: (id) => `/text-to-3d/${id}`,
      readRemoteId: (payload) => readString(payload, "result") ?? readString(payload, "id"),
      readPoll: (payload) => ({
        state: mapState(readString(payload, "status")),
        progress: 0.5,
      }),
      readResultUrl: (payload) => readString(payload, "model_url") ?? readString(payload, "url"),
    },
    config,
  );
}

export const MESHY_DESCRIPTOR = DESCRIPTOR;
