import type { Document as GltfDocument, Texture as GltfTexture } from "@gltf-transform/core";
import { KHRTextureBasisu } from "@gltf-transform/extensions";
import { type Ktx2Scheme, stubEncodeKtx2, type TextureCompressEncoder } from "./encoders.js";

/**
 * Optional import encode flags (`08` §7.1).
 *
 * @public
 */
export interface ImportEncodeOptions {
  readonly compress?: boolean;
  readonly textureCompress?: boolean;
  readonly targetTriangles?: number;
  readonly textureEncoder?: TextureCompressEncoder;
}

/**
 * Applies KTX2 encode options to a glTF-Transform document.
 * Draco is stamped onto the written GLB in the import worker (Q-0181).
 *
 * @example
 * ```ts
 * applyImportEncode(document, { compress: true, textureCompress: true });
 * ```
 *
 * @public
 */
export function applyImportEncode(document: GltfDocument, options: ImportEncodeOptions): void {
  if (options.textureCompress === true) {
    document.createExtension(KHRTextureBasisu).setRequired(true);
    const encoder = options.textureEncoder ?? { encodeKtx2: stubEncodeKtx2 };
    for (const texture of document.getRoot().listTextures()) {
      maybeCompressTexture(texture, encoder);
    }
  }
}

function maybeCompressTexture(texture: GltfTexture, encoder: TextureCompressEncoder): void {
  const image = texture.getImage();
  if (image === null) {
    return;
  }
  const size = texture.getSize();
  const width = size?.[0] ?? 0;
  const height = size?.[1] ?? 0;
  if (width * height <= 1024 * 1024) {
    return;
  }
  const isNormal = (texture.getName() ?? "").toLowerCase().includes("normal");
  const scheme: Ktx2Scheme = isNormal ? "uastc" : "etc1s";
  const encoded = encoder.encodeKtx2({ bytes: image, scheme, width, height });
  texture.setImage(encoded).setMimeType("image/ktx2");
}
