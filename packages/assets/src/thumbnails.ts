import type { AssetId, BlobRef } from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import type { BlobStore } from "@tessera/storage";

/**
 * Offscreen WebP renderer injected by the editor (`08` §9, Q-0174).
 *
 * @public
 */
export interface ThumbnailRenderer {
  render(assetId: AssetId, signal?: AbortSignal): Promise<Result<Uint8Array, TesseraError>>;
  sourceHash(assetId: AssetId): string;
}

/**
 * Cached 256×256 WebP thumbnails (`08` §9).
 *
 * @public
 */
export interface ThumbnailService {
  get(assetId: AssetId, signal?: AbortSignal): Promise<BlobRef | null>;
}

/**
 * Cache key `derived:thumb:<assetId>:<hash>` (`08` §9).
 *
 * @public
 */
export function thumbnailCacheKey(assetId: AssetId, hash: string): string {
  return `derived:thumb:${assetId}:${hash}`;
}

/**
 * Creates a {@link ThumbnailService}. Headless (no renderer) always returns `null`.
 *
 * @example
 * ```ts
 * const thumbs = createThumbnailService({ blobs });
 * await thumbs.get("a_aaaaaaaaaa");
 * ```
 *
 * @public
 */
export function createThumbnailService(options: {
  readonly blobs: BlobStore;
  readonly renderer?: ThumbnailRenderer;
}): ThumbnailService {
  const cache = new Map<string, BlobRef>();
  return {
    async get(assetId, signal) {
      const renderer = options.renderer;
      if (renderer === undefined) {
        return null;
      }
      const hash = renderer.sourceHash(assetId);
      const key = thumbnailCacheKey(assetId, hash);
      const hit = cache.get(key);
      if (hit !== undefined) {
        return hit;
      }
      const rendered = await renderer.render(assetId, signal);
      if (!rendered.ok) {
        return null;
      }
      const written = await options.blobs.write(
        rendered.value,
        "image/webp",
        `${key}.webp`,
        signal,
      );
      if (!written.ok) {
        return null;
      }
      cache.set(key, written.value);
      return written.value;
    },
  };
}

/**
 * Always-null headless thumbs (no blob store required).
 *
 * @public
 */
export function nullThumbnailService(): ThumbnailService {
  return {
    async get() {
      return null;
    },
  };
}
