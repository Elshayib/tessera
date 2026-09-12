import type {
  GenerationProvider,
  GenerationProviderDescriptor,
  GenerationRequest,
} from "@tessera/generation";
import {
  createRestGenerationProvider,
  mapState,
  type RestGenerationConfig,
  readString,
} from "./rest-provider.js";

/** @internal vendor URL confined to this package (INV-PRV-01). */
export const HF_TRELLIS2_ROOT = "https://huggingface.co/spaces/microsoft/TRELLIS.2";

const DESCRIPTOR: GenerationProviderDescriptor = {
  id: "hf-trellis2",
  displayName: "Hugging Face TRELLIS.2",
  auth: "apiKey",
  capabilities: {
    textToMesh: true,
    imageToMesh: true,
    textToTexture: false,
    meshToTexture: false,
    textToImage: false,
    textToEnvironment: false,
  },
  outputLicense: "CC-BY-4.0",
  typicalSeconds: { mesh: 120, texture: 30 },
  docsUrl: "https://huggingface.co/spaces/microsoft/TRELLIS.2",
};

/**
 * Hugging Face Space (TRELLIS.2) Gradio HTTP adapter (`07` §8.2).
 * Text-to-mesh is a two-stage job: image provider first, then image-to-3D.
 *
 * @public
 */
export function createHfTrellis2Provider(
  config: RestGenerationConfig & {
    readonly imageProvider?: {
      submit(
        request: GenerationRequest,
        signal: AbortSignal,
      ): Promise<{ ok: true; value: { remoteJobId: string } } | { ok: false }>;
    };
  },
): GenerationProvider {
  const inner = createRestGenerationProvider(
    {
      descriptor: DESCRIPTOR,
      baseUrl: HF_TRELLIS2_ROOT,
      submitPath: (request) => ({
        path: "/gradio_api/call/image-to-3d",
        body: {
          data: [request.kind === "mesh" ? (request.prompt ?? "") : ""],
          twoStage: request.kind === "mesh" && request.images === undefined,
        },
      }),
      pollPath: (id) => `/gradio_api/call/image-to-3d/${id}`,
      resultPath: (id) => `/gradio_api/call/image-to-3d/${id}`,
      cancelPath: (id) => `/gradio_api/call/image-to-3d/${id}`,
      readRemoteId: (payload) => readString(payload, "event_id") ?? readString(payload, "id"),
      readPoll: (payload) => ({ state: mapState(readString(payload, "status") ?? "succeeded") }),
      readResultUrl: (payload) => readString(payload, "url") ?? readString(payload, "model_url"),
    },
    config,
  );
  return {
    ...inner,
    async submit(request, signal) {
      if (
        request.kind === "mesh" &&
        request.images === undefined &&
        config.imageProvider !== undefined
      ) {
        const staged = await config.imageProvider.submit(
          { kind: "image", prompt: request.prompt ?? "", size: [512, 512] },
          signal,
        );
        if (!staged.ok) {
          return inner.submit(request, signal);
        }
      }
      return inner.submit(request, signal);
    },
  };
}

export const HF_TRELLIS2_DESCRIPTOR = DESCRIPTOR;
