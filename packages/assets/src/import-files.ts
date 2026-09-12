import type { Clock, Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import type { BlobStore } from "@tessera/storage";
import type { AssetInput, ImportPlan } from "./import-plan.js";
import { HARD_BLOB_LIMIT_BYTES } from "./import-plan.js";
import { importGltf } from "./import-worker.js";

const UNSUPPORTED_HINT = "Convert through the Blender bridge (phase 4) or an external converter";

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".ktx2"]);
const HDR_EXT = new Set([".hdr", ".exr"]);
const GLTF_EXT = new Set([".glb", ".gltf"]);
const UNSUPPORTED_EXT = new Set([".fbx", ".obj", ".usd", ".usda", ".usdc", ".usdz", ".blend"]);

/**
 * Duck-typed upload (`File` in the browser).
 *
 * @public
 */
export interface ImportFile {
  readonly name: string;
  readonly type: string;
  readonly size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/**
 * Builds an {@link ImportPlan} from a local file (`08` §6 Uploads, §7).
 *
 * @example
 * ```ts
 * await planFromFile({ file, blobs, clock });
 * ```
 *
 * @public
 */
export async function planFromFile(input: {
  readonly file: ImportFile;
  readonly blobs: BlobStore;
  readonly clock: Clock;
  readonly signal?: AbortSignal;
  readonly license?: string;
}): Promise<Result<ImportPlan, TesseraError>> {
  if (input.file.size > HARD_BLOB_LIMIT_BYTES) {
    return err(tesseraError("INVALID_INPUT", "file exceeds hard blob limit"));
  }
  const ext = extension(input.file.name);
  if (UNSUPPORTED_EXT.has(ext)) {
    return err(tesseraError("UNSUPPORTED", UNSUPPORTED_HINT, { fileName: input.file.name }));
  }
  const buffer = await input.file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (GLTF_EXT.has(ext)) {
    return importGltf({
      bytes,
      fileName: input.file.name,
      blobs: input.blobs,
      clock: input.clock,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
  }
  const mime = mimeFor(ext, input.file.type);
  const written = await input.blobs.write(bytes, mime, input.file.name, input.signal);
  if (!written.ok) {
    return written;
  }
  const license = input.license ?? "unknown";
  const importedAt = input.clock.nowIso();
  if (HDR_EXT.has(ext)) {
    const asset: AssetInput = {
      id: "a_0000000000",
      kind: "environment",
      name: baseName(input.file.name),
      license,
      provenance: { source: "upload", importedAt },
      source: { kind: "hdri", blob: written.value },
      rotation: 0,
      intensity: 1,
    };
    return ok({
      blobs: [written.value],
      assets: [asset],
      warnings: [],
    });
  }
  if (IMAGE_EXT.has(ext)) {
    const size = readImageSize(bytes) ?? ([1, 1] as const);
    const asset: AssetInput = {
      id: "a_0000000000",
      kind: "texture",
      name: baseName(input.file.name),
      license,
      provenance: { source: "upload", importedAt },
      blob: written.value,
      colorSpace: "srgb",
      wrapS: "repeat",
      wrapT: "repeat",
      size: [size[0], size[1]],
      hasAlpha: ext === ".png" || ext === ".webp",
    };
    return ok({
      blobs: [written.value],
      assets: [asset],
      warnings: size[0] === 1 && size[1] === 1 ? ["image size unknown; stored original bytes"] : [],
    });
  }
  return err(tesseraError("UNSUPPORTED", UNSUPPORTED_HINT, { fileName: input.file.name }));
}

function extension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot === -1) {
    return "";
  }
  return fileName.slice(dot).toLowerCase();
}

function baseName(fileName: string): string {
  const slash = Math.max(fileName.lastIndexOf("/"), fileName.lastIndexOf("\\"));
  const base = slash === -1 ? fileName : fileName.slice(slash + 1);
  const dot = base.lastIndexOf(".");
  return dot === -1 ? base : base.slice(0, dot);
}

function mimeFor(ext: string, type: string): string {
  if (type.length > 0) {
    return type;
  }
  if (ext === ".png") {
    return "image/png";
  }
  if (ext === ".jpg" || ext === ".jpeg") {
    return "image/jpeg";
  }
  if (ext === ".webp") {
    return "image/webp";
  }
  if (ext === ".ktx2") {
    return "image/ktx2";
  }
  if (ext === ".hdr") {
    return "image/vnd.radiance";
  }
  if (ext === ".exr") {
    return "image/x-exr";
  }
  return "application/octet-stream";
}

function readImageSize(bytes: Uint8Array): readonly [number, number] | undefined {
  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    const width = readU32(bytes, 16);
    const height = readU32(bytes, 20);
    return [width, height];
  }
  return undefined;
}

function readU32(bytes: Uint8Array, offset: number): number {
  const b0 = bytes[offset] ?? 0;
  const b1 = bytes[offset + 1] ?? 0;
  const b2 = bytes[offset + 2] ?? 0;
  const b3 = bytes[offset + 3] ?? 0;
  return ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
}
