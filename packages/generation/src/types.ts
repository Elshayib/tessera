import type { BlobRef, License, Provenance } from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";

/**
 * Built-in generation adapter ids from `07` §8. Plugins may add further ids.
 *
 * @public
 */
export type GenerationProviderId =
  | "meshy"
  | "tripo"
  | "rodin"
  | "hf-trellis2"
  | "local-worker"
  | (string & {});

/**
 * Provider catalog row (`07` §8).
 *
 * @public
 */
export interface GenerationProviderDescriptor {
  readonly id: GenerationProviderId;
  readonly displayName: string;
  readonly auth: "apiKey" | "none";
  readonly capabilities: {
    readonly textToMesh: boolean;
    readonly imageToMesh: boolean;
    readonly textToTexture: boolean;
    readonly meshToTexture: boolean;
    readonly textToImage: boolean;
    readonly textToEnvironment: boolean;
  };
  readonly outputLicense: License | "per-plan";
  readonly typicalSeconds: { readonly mesh: number; readonly texture: number };
  readonly docsUrl: string;
}

/**
 * Mesh generation request (`07` §8).
 *
 * @public
 */
export interface MeshGenerationRequest {
  readonly kind: "mesh";
  readonly prompt?: string;
  readonly images?: readonly BlobRef[];
  readonly style?: "realistic" | "stylized" | "lowpoly";
  readonly targetTriangles?: number;
  readonly pbr: boolean;
  readonly seed?: number;
  readonly targetSizeMeters?: number;
}

/**
 * Texture generation request (`07` §8).
 *
 * @public
 */
export interface TextureGenerationRequest {
  readonly kind: "texture";
  readonly prompt: string;
  readonly mesh?: BlobRef;
  readonly resolution: 1024 | 2048 | 4096;
  readonly maps: readonly ("baseColor" | "normal" | "roughness" | "metallic" | "occlusion")[];
}

/**
 * Environment (HDRI) generation request (`07` §8).
 *
 * @public
 */
export interface EnvironmentGenerationRequest {
  readonly kind: "environment";
  readonly prompt: string;
  readonly resolution: 2048 | 4096;
}

/**
 * Image generation request (`07` §8).
 *
 * @public
 */
export interface ImageGenerationRequest {
  readonly kind: "image";
  readonly prompt: string;
  readonly size: readonly [number, number];
  readonly referenceImages?: readonly BlobRef[];
}

/**
 * Discriminated generation request (`07` §8).
 *
 * @public
 */
export type GenerationRequest =
  | MeshGenerationRequest
  | TextureGenerationRequest
  | EnvironmentGenerationRequest
  | ImageGenerationRequest;

/**
 * Estimate returned by {@link GenerationProvider.estimate}.
 *
 * @public
 */
export interface GenerationEstimate {
  readonly seconds: number;
  readonly credits?: number;
  readonly costUsd?: number;
}

/**
 * Remote job handle from {@link GenerationProvider.submit}.
 *
 * @public
 */
export interface GenerationSubmitResult {
  readonly remoteJobId: string;
}

/**
 * Remote poll payload (`07` §8).
 *
 * @public
 */
export interface GenerationPollResult {
  readonly state: "queued" | "running" | "succeeded" | "failed";
  readonly progress?: number;
  readonly message?: string;
}

/**
 * Successful generation output (`07` §8).
 *
 * @public
 */
export interface GenerationResult {
  readonly kind: GenerationRequest["kind"];
  readonly blobs: readonly BlobRef[];
  readonly preview?: BlobRef;
  readonly license: License;
  readonly provenance: Provenance;
  readonly stats?: {
    readonly triangles?: number;
    readonly seconds: number;
    readonly creditsUsed?: number;
  };
}

/**
 * Vendor-free generation adapter (`07` §8).
 *
 * @example
 * ```ts
 * const estimated = await provider.estimate({ kind: "image", prompt: "barrel", size: [256, 256] });
 * ```
 *
 * @public
 */
export interface GenerationProvider {
  readonly descriptor: GenerationProviderDescriptor;
  estimate(request: GenerationRequest): Promise<Result<GenerationEstimate, TesseraError>>;
  submit(
    request: GenerationRequest,
    signal: AbortSignal,
  ): Promise<Result<GenerationSubmitResult, TesseraError>>;
  poll(
    remoteJobId: string,
    signal: AbortSignal,
  ): Promise<Result<GenerationPollResult, TesseraError>>;
  fetchResult(
    remoteJobId: string,
    blobs: {
      write(
        bytes: Uint8Array,
        mime: string,
        fileName?: string,
        signal?: AbortSignal,
      ): Promise<Result<BlobRef, TesseraError>>;
    },
    signal: AbortSignal,
  ): Promise<Result<GenerationResult, TesseraError>>;
  cancel?(remoteJobId: string): Promise<void>;
}
