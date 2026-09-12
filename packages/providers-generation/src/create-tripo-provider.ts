import type { GenerationProvider, GenerationProviderDescriptor } from "@tessera/generation";
import {
  createRestGenerationProvider,
  mapState,
  type RestGenerationConfig,
  readString,
} from "./rest-provider.js";

/** @internal vendor URL confined to this package (INV-PRV-01). */
export const TRIPO_API_ROOT = "https://api.tripo3d.ai/v2/openapi";

const DESCRIPTOR: GenerationProviderDescriptor = {
  id: "tripo",
  displayName: "Tripo",
  auth: "apiKey",
  capabilities: {
    textToMesh: true,
    imageToMesh: true,
    textToTexture: true,
    meshToTexture: false,
    textToImage: false,
    textToEnvironment: false,
  },
  outputLicense: "per-plan",
  typicalSeconds: { mesh: 45, texture: 20 },
  docsUrl: "https://platform.tripo3d.ai/",
};

/**
 * Tripo REST adapter (`07` §8.2).
 *
 * @public
 */
export function createTripoProvider(config: RestGenerationConfig): GenerationProvider {
  return createRestGenerationProvider(
    {
      descriptor: DESCRIPTOR,
      baseUrl: TRIPO_API_ROOT,
      submitPath: (request) => ({
        path: "/task",
        body: { type: request.kind, prompt: "prompt" in request ? request.prompt : "" },
      }),
      pollPath: (id) => `/task/${id}`,
      resultPath: (id) => `/task/${id}`,
      cancelPath: (id) => `/task/${id}`,
      readRemoteId: (payload) => readString(payload, "task_id") ?? readString(payload, "id"),
      readPoll: (payload) => ({ state: mapState(readString(payload, "status")) }),
      readResultUrl: (payload) => readString(payload, "model_url") ?? readString(payload, "url"),
    },
    config,
  );
}

export const TRIPO_DESCRIPTOR = DESCRIPTOR;
