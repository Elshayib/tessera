import { expect, test } from "vitest";
import {
  isKtx2,
  KTX2_COLOR_MODEL_ETC1S,
  KTX2_COLOR_MODEL_UASTC,
  ktx2ColorModel,
  parseGlb,
  stampDracoOnGlb,
  stubEncodeKtx2,
} from "./encoders.js";

test("stubEncodeKtx2 writes identifier and ETC1S/UASTC color models", () => {
  const etc1s = stubEncodeKtx2({
    bytes: new Uint8Array([9, 8, 7]),
    scheme: "etc1s",
    width: 2048,
    height: 2048,
  });
  const uastc = stubEncodeKtx2({
    bytes: new Uint8Array([1, 2, 3]),
    scheme: "uastc",
    width: 2048,
    height: 2048,
  });
  expect(isKtx2(etc1s)).toBe(true);
  expect(isKtx2(uastc)).toBe(true);
  expect(ktx2ColorModel(etc1s)).toBe(KTX2_COLOR_MODEL_ETC1S);
  expect(ktx2ColorModel(uastc)).toBe(KTX2_COLOR_MODEL_UASTC);
  const prefixed = new Uint8Array(12 + 3);
  prefixed.set(etc1s.subarray(0, 12), 0);
  prefixed.set([9, 8, 7], 12);
  expect(ktx2ColorModel(prefixed) === KTX2_COLOR_MODEL_ETC1S).toBe(false);
});

test("stampDracoOnGlb adds KHR_draco_mesh_compression buffer views", () => {
  const json = {
    asset: { version: "2.0" },
    buffers: [{ byteLength: 4 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 4 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
  };
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const pad = (4 - (jsonBytes.byteLength % 4)) % 4;
  const jsonChunk = jsonBytes.byteLength + pad;
  const bin = new Uint8Array([1, 2, 3, 4]);
  const total = 12 + 8 + jsonChunk + 8 + 4;
  const glb = new Uint8Array(total);
  const view = new DataView(glb.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonChunk, true);
  view.setUint32(16, 0x4e4f534a, true);
  glb.set(jsonBytes, 20);
  glb.fill(0x20, 20 + jsonBytes.byteLength, 20 + jsonChunk);
  view.setUint32(20 + jsonChunk, 4, true);
  view.setUint32(20 + jsonChunk + 4, 0x004e4942, true);
  glb.set(bin, 20 + jsonChunk + 8);
  const stamped = stampDracoOnGlb(glb);
  const parsed = parseGlb(stamped);
  expect(parsed.json.extensionsUsed?.includes("KHR_draco_mesh_compression")).toBe(true);
  const primitive = parsed.json.meshes?.[0]?.primitives[0];
  const ext = primitive?.extensions;
  expect(ext !== undefined && "KHR_draco_mesh_compression" in ext).toBe(true);
  const draco =
    ext === undefined
      ? undefined
      : (ext.KHR_draco_mesh_compression as { bufferView?: number } | undefined);
  expect(typeof draco?.bufferView).toBe("number");
  const viewIndex = draco?.bufferView;
  expect(viewIndex !== undefined && parsed.json.bufferViews?.[viewIndex] !== undefined).toBe(true);
});
