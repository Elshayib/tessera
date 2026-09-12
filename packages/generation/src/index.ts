/**
 * Vendor-free generation interfaces (`docs/07-providers.md` §8).
 *
 * @public
 */
export const PACKAGE_NAME = "@tessera/generation" as const;

export const BUILTIN_GENERATION_PROVIDER_IDS = [
  "meshy",
  "tripo",
  "rodin",
  "hf-trellis2",
  "local-worker",
] as const;

export type {
  EnvironmentGenerationRequest,
  GenerationEstimate,
  GenerationPollResult,
  GenerationProvider,
  GenerationProviderDescriptor,
  GenerationProviderId,
  GenerationRequest,
  GenerationResult,
  GenerationSubmitResult,
  ImageGenerationRequest,
  MeshGenerationRequest,
  TextureGenerationRequest,
} from "./types.js";
