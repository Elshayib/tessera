/**
 * Generation vendor adapters (`docs/07-providers.md` §8.2).
 *
 * @public
 */
export const PACKAGE_NAME = "@tessera/providers-generation" as const;

export { createHfTrellis2Provider, HF_TRELLIS2_DESCRIPTOR } from "./create-hf-trellis2-provider.js";
export type { LocalWorkerConfig } from "./create-local-worker-provider.js";
export {
  createLocalWorkerProvider,
  LOCAL_WORKER_DESCRIPTOR,
} from "./create-local-worker-provider.js";
export { createMeshyProvider, MESHY_DESCRIPTOR } from "./create-meshy-provider.js";
export { createRodinProvider, RODIN_DESCRIPTOR } from "./create-rodin-provider.js";
export { createTripoProvider, TRIPO_DESCRIPTOR } from "./create-tripo-provider.js";
export type { GenerationHttp } from "./http.js";
export { createFetchGenerationHttp, createMemoryGenerationHttp } from "./http.js";
export type { GenerationFailure } from "./map-provider-error.js";
export { mapGenerationError } from "./map-provider-error.js";
export type { RestGenerationConfig } from "./rest-provider.js";
