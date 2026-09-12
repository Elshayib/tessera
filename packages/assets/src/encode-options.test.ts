import { Document, Logger, WebIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { expect, test } from "vitest";
import { applyImportEncode } from "./encode-options.js";
import {
  isKtx2,
  KTX2_COLOR_MODEL_ETC1S,
  KTX2_COLOR_MODEL_UASTC,
  ktx2ColorModel,
  parseGlb,
  stampDracoOnGlb,
} from "./encoders.js";

test("import textureCompress writes KTX2 for textures > 1024²", async () => {
  const document = new Document();
  document.setLogger(new Logger(Logger.Verbosity.SILENT));
  document.createBuffer();
  const albedo = document.createTexture("albedo");
  albedo.setImage(new Uint8Array([1, 2, 3, 4])).setMimeType("image/png");
  Object.defineProperty(albedo, "getSize", { value: () => [2048, 2048] });
  const normal = document.createTexture("normal");
  normal.setImage(new Uint8Array([5, 6, 7, 8])).setMimeType("image/png");
  Object.defineProperty(normal, "getSize", { value: () => [2048, 2048] });
  applyImportEncode(document, { textureCompress: true });
  expect(albedo.getMimeType()).toBe("image/ktx2");
  expect(normal.getMimeType()).toBe("image/ktx2");
  const albedoBytes = albedo.getImage();
  const normalBytes = normal.getImage();
  expect(albedoBytes !== null && isKtx2(albedoBytes)).toBe(true);
  expect(normalBytes !== null && isKtx2(normalBytes)).toBe(true);
  expect(albedoBytes !== null && ktx2ColorModel(albedoBytes)).toBe(KTX2_COLOR_MODEL_ETC1S);
  expect(normalBytes !== null && ktx2ColorModel(normalBytes)).toBe(KTX2_COLOR_MODEL_UASTC);
  const io = new WebIO()
    .registerExtensions(ALL_EXTENSIONS)
    .setLogger(new Logger(Logger.Verbosity.SILENT));
  const glb = await io.writeBinary(document);
  const parsed = parseGlb(glb);
  expect(parsed.json.extensionsUsed?.includes("KHR_texture_basisu")).toBe(true);
  expect(parsed.json.images?.some((image) => image.mimeType === "image/ktx2")).toBe(true);
});

test("import compress encodes Draco", async () => {
  const document = new Document();
  document.setLogger(new Logger(Logger.Verbosity.SILENT));
  const buffer = document.createBuffer();
  const position = document
    .createAccessor()
    .setType("VEC3")
    .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
    .setBuffer(buffer);
  const indices = document
    .createAccessor()
    .setType("SCALAR")
    .setArray(new Uint16Array([0, 1, 2]))
    .setBuffer(buffer);
  document
    .createMesh()
    .addPrimitive(
      document.createPrimitive().setAttribute("POSITION", position).setIndices(indices),
    );
  applyImportEncode(document, { compress: true });
  const io = new WebIO()
    .registerExtensions(ALL_EXTENSIONS)
    .setLogger(new Logger(Logger.Verbosity.SILENT));
  const stamped = stampDracoOnGlb(await io.writeBinary(document));
  const parsed = parseGlb(stamped);
  expect(parsed.json.extensionsUsed?.includes("KHR_draco_mesh_compression")).toBe(true);
  const primitive = parsed.json.meshes?.[0]?.primitives[0];
  const ext = primitive?.extensions;
  expect(ext !== undefined && Object.hasOwn(ext, "KHR_draco_mesh_compression")).toBe(true);
  expect(JSON.stringify(document.getRoot().getExtras() ?? {}).includes("draco")).toBe(false);
});
