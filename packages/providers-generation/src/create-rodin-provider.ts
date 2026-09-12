import type { GenerationProvider, GenerationProviderDescriptor } from "@tessera/generation";
import {
  createRestGenerationProvider,
  mapState,
  type RestGenerationConfig,
  readString,
} from "./rest-provider.js";

/** @internal vendor URL confined to this package (INV-PRV-01). */
export const RODIN_API_ROOT = "https://api.hyper3d.com/api/v2";

const DESCRIPTOR: GenerationProviderDescriptor = {
  id: "rodin",
  displayName: "Rodin (Hyper3D)",
  auth: "apiKey",
  capabilities: {
    textToMesh: true,
    imageToMesh: true,
    textToTexture: false,
    meshToTexture: false,
    textToImage: false,
    textToEnvironment: false,
  },
  outputLicense: "per-plan",
  typicalSeconds: { mesh: 90, texture: 30 },
  docsUrl: "https://developer.hyper3d.ai/",
};

/**
 * Rodin / Hyper3D REST adapter (`07` §8.2).
 *
 * @public
 */
export function createRodinProvider(config: RestGenerationConfig): GenerationProvider {
  return createRestGenerationProvider(
    {
      descriptor: DESCRIPTOR,
      baseUrl: RODIN_API_ROOT,
      submitPath: (request) => ({
        path: "/rodin",
        body: { prompt: "prompt" in request ? request.prompt : "" },
      }),
      pollPath: (id) => `/status/${id}`,
      resultPath: (id) => `/status/${id}`,
      cancelPath: (id) => `/status/${id}`,
      readRemoteId: (payload) => readString(payload, "uuid") ?? readString(payload, "id"),
      readPoll: (payload) => ({ state: mapState(readString(payload, "status")) }),
      readResultUrl: (payload) => readString(payload, "model_url") ?? readString(payload, "url"),
    },
    config,
  );
}

export const RODIN_DESCRIPTOR = DESCRIPTOR;
