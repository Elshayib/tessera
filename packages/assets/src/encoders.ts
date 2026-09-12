/**
 * Deterministic KTX2 / Draco encoder ports (`08` §7.1, `09` §3.1, Q-0181).
 *
 * Production may inject BasisU/Draco WASM. Tests and Node CI use this stub, which
 * still emits a valid KTX2 identifier + DFD color model and a
 * `KHR_draco_mesh_compression` primitive extension with a dedicated buffer view.
 *
 * @public
 */

const KTX2_IDENTIFIER = Uint8Array.from([
  0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a,
]);

/** Khronos Data Format color models used in KTX2 DFDs. */
export const KTX2_COLOR_MODEL_ETC1S = 163;
export const KTX2_COLOR_MODEL_UASTC = 166;

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const DRACO_EXT = "KHR_draco_mesh_compression";
const HEADER_BYTES = 80;
const LEVEL_INDEX_BYTES = 24;
const DFD_BYTES = 44;
const DRACO_STUB_BYTES = 16;

/**
 * Texture compression scheme (`08` §7.1): UASTC for normal maps, ETC1S otherwise.
 *
 * @public
 */
export type Ktx2Scheme = "uastc" | "etc1s";

/**
 * Encodes image bytes as KTX2.
 *
 * @public
 */
export interface TextureCompressEncoder {
  encodeKtx2(input: {
    readonly bytes: Uint8Array;
    readonly scheme: Ktx2Scheme;
    readonly width: number;
    readonly height: number;
  }): Uint8Array;
}

/**
 * Default encoder used when none is injected.
 *
 * @example
 * ```ts
 * const ktx2 = stubEncodeKtx2({ bytes, scheme: "etc1s", width: 2048, height: 2048 });
 * ```
 *
 * @public
 */
export function stubEncodeKtx2(input: {
  readonly bytes: Uint8Array;
  readonly scheme: Ktx2Scheme;
  readonly width: number;
  readonly height: number;
}): Uint8Array {
  const payload = input.bytes.byteLength === 0 ? new Uint8Array([0]) : input.bytes;
  const dfdOffset = HEADER_BYTES + LEVEL_INDEX_BYTES;
  const dataOffset = dfdOffset + DFD_BYTES;
  const total = dataOffset + payload.byteLength;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  out.set(KTX2_IDENTIFIER, 0);
  writeU32(view, 12, 0);
  writeU32(view, 16, 1);
  writeU32(view, 20, Math.max(1, input.width));
  writeU32(view, 24, Math.max(1, input.height));
  writeU32(view, 28, 0);
  writeU32(view, 32, 0);
  writeU32(view, 36, 1);
  writeU32(view, 40, 1);
  writeU32(view, 44, input.scheme === "etc1s" ? 1 : 0);
  writeU32(view, 48, dfdOffset);
  writeU32(view, 52, DFD_BYTES);
  writeU32(view, 56, 0);
  writeU32(view, 60, 0);
  writeU64(view, 64, 0);
  writeU64(view, 72, 0);
  writeU64(view, 80, dataOffset);
  writeU64(view, 88, payload.byteLength);
  writeU64(view, 96, payload.byteLength);
  writeU32(view, dfdOffset, DFD_BYTES);
  view.setUint16(dfdOffset + 4, 0, true);
  view.setUint16(dfdOffset + 6, 0, true);
  view.setUint16(dfdOffset + 8, 2, true);
  view.setUint16(dfdOffset + 10, 40, true);
  out[dfdOffset + 12] = input.scheme === "uastc" ? KTX2_COLOR_MODEL_UASTC : KTX2_COLOR_MODEL_ETC1S;
  out[dfdOffset + 13] = 1;
  out[dfdOffset + 14] = input.scheme === "uastc" ? 1 : 2;
  out.set(payload, dataOffset);
  return out;
}

/**
 * True when `bytes` start with the KTX2 file identifier.
 *
 * @public
 */
export function isKtx2(bytes: Uint8Array): boolean {
  if (bytes.byteLength < KTX2_IDENTIFIER.byteLength) {
    return false;
  }
  return KTX2_IDENTIFIER.every((value, index) => bytes[index] === value);
}

/**
 * Reads the DFD color model from a stub or spec KTX2 file.
 *
 * @public
 */
export function ktx2ColorModel(bytes: Uint8Array): number | undefined {
  if (bytes.byteLength < HEADER_BYTES) {
    return undefined;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dfdOffset = view.getUint32(48, true);
  const modelAt = dfdOffset + 12;
  if (modelAt >= bytes.byteLength) {
    return undefined;
  }
  return bytes[modelAt];
}

/**
 * Parsed GLB JSON chunk plus BIN payload.
 *
 * @public
 */
export interface ParsedGlb {
  readonly json: GltfJson;
  readonly bin: Uint8Array;
}

/**
 * Loose glTF JSON used by the Draco stamp (Q-0181).
 *
 * @public
 */
export interface GltfJson {
  extensionsUsed?: string[];
  extensionsRequired?: string[];
  buffers?: { byteLength: number; uri?: string }[];
  bufferViews?: { buffer: number; byteOffset?: number; byteLength: number }[];
  meshes?: {
    primitives: {
      attributes?: Record<string, number>;
      indices?: number;
      extensions?: Record<string, unknown>;
    }[];
  }[];
  images?: { mimeType?: string; bufferView?: number; uri?: string }[];
}

/**
 * Reads JSON and BIN chunks from a GLB.
 *
 * @example
 * ```ts
 * const { json } = parseGlb(glbBytes);
 * ```
 *
 * @public
 */
export function parseGlb(bytes: Uint8Array): ParsedGlb {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 20 || view.getUint32(0, true) !== GLB_MAGIC) {
    return { json: {}, bin: new Uint8Array() };
  }
  const jsonLength = view.getUint32(12, true);
  const jsonType = view.getUint32(16, true);
  if (jsonType !== JSON_CHUNK) {
    return { json: {}, bin: new Uint8Array() };
  }
  const jsonStart = 20;
  const jsonEnd = jsonStart + jsonLength;
  const jsonText = new TextDecoder().decode(bytes.subarray(jsonStart, jsonEnd)).replace(/\0/g, "");
  const parsed: unknown = JSON.parse(jsonText);
  const json: GltfJson = typeof parsed === "object" && parsed !== null ? (parsed as GltfJson) : {};
  if (jsonEnd + 8 > bytes.byteLength) {
    return { json, bin: new Uint8Array() };
  }
  const binView = new DataView(bytes.buffer, bytes.byteOffset + jsonEnd, 8);
  const binLength = binView.getUint32(0, true);
  const binType = binView.getUint32(4, true);
  if (binType !== BIN_CHUNK) {
    return { json, bin: new Uint8Array() };
  }
  const binStart = jsonEnd + 8;
  return { json, bin: bytes.subarray(binStart, binStart + binLength) };
}

/**
 * Rewrites a GLB so every mesh primitive has `KHR_draco_mesh_compression` and a
 * dedicated buffer view (stub bitstream; not GPU Draco).
 *
 * @public
 */
export function stampDracoOnGlb(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const parsed = parseGlb(bytes);
  const stamped = stampDracoOnGltf(parsed.json, parsed.bin);
  return packGlb(stamped.json, stamped.bin);
}

function stampDracoOnGltf(json: GltfJson, bin: Uint8Array): { json: GltfJson; bin: Uint8Array } {
  const used = [...(json.extensionsUsed ?? [])];
  if (!used.includes(DRACO_EXT)) {
    used.push(DRACO_EXT);
  }
  const required = [...(json.extensionsRequired ?? [])];
  if (!required.includes(DRACO_EXT)) {
    required.push(DRACO_EXT);
  }
  const stub = new Uint8Array(DRACO_STUB_BYTES);
  stub[0] = 0x44;
  stub[1] = 0x52;
  stub[2] = 0x41;
  stub[3] = 0x43;
  const nextBin = new Uint8Array(bin.byteLength + stub.byteLength);
  nextBin.set(bin, 0);
  nextBin.set(stub, bin.byteLength);
  const buffers = [...(json.buffers ?? [{ byteLength: bin.byteLength }])];
  const first = buffers[0];
  if (first !== undefined) {
    buffers[0] = { ...first, byteLength: nextBin.byteLength };
  }
  const bufferViews = [...(json.bufferViews ?? [])];
  const viewIndex = bufferViews.length;
  bufferViews.push({
    buffer: 0,
    byteOffset: bin.byteLength,
    byteLength: stub.byteLength,
  });
  const meshes = (json.meshes ?? []).map((mesh) => ({
    ...mesh,
    primitives: mesh.primitives.map((primitive) => {
      const attributes = primitive.attributes ?? {};
      const mapping: Record<string, number> = {};
      let index = 0;
      for (const name of Object.keys(attributes)) {
        mapping[name] = index;
        index += 1;
      }
      return {
        ...primitive,
        extensions: {
          ...(primitive.extensions ?? {}),
          [DRACO_EXT]: { bufferView: viewIndex, attributes: mapping },
        },
      };
    }),
  }));
  return {
    json: {
      ...json,
      extensionsUsed: used,
      extensionsRequired: required,
      buffers,
      bufferViews,
      meshes,
    },
    bin: nextBin,
  };
}

function packGlb(json: GltfJson, bin: Uint8Array): Uint8Array<ArrayBuffer> {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPad = (4 - (jsonBytes.byteLength % 4)) % 4;
  const jsonChunk = jsonBytes.byteLength + jsonPad;
  const binPad = (4 - (bin.byteLength % 4)) % 4;
  const binChunk = bin.byteLength + binPad;
  const total = 12 + 8 + jsonChunk + 8 + binChunk;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonChunk, true);
  view.setUint32(16, JSON_CHUNK, true);
  out.set(jsonBytes, 20);
  out.fill(0x20, 20 + jsonBytes.byteLength, 20 + jsonChunk);
  const binHeader = 20 + jsonChunk;
  view.setUint32(binHeader, binChunk, true);
  view.setUint32(binHeader + 4, BIN_CHUNK, true);
  out.set(bin, binHeader + 8);
  return out;
}

function writeU32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true);
}

function writeU64(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true);
  view.setUint32(offset + 4, 0, true);
}
