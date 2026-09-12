import {
  type Document as GltfDocument,
  type Material as GltfMaterial,
  type Mesh as GltfMesh,
  type Node as GltfNode,
  type Scene as GltfScene,
  type Texture as GltfTexture,
  Logger,
  type TextureInfo,
  WebIO,
} from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsUnlit } from "@gltf-transform/extensions";
import {
  dedup,
  getBounds,
  getGLPrimitiveCount,
  metalRough,
  prune,
  tangents,
  transformMesh,
  weld,
} from "@gltf-transform/functions";
import type {
  AssetId,
  BlobRef,
  EntityId,
  GeometryAsset,
  MaterialAsset,
  TextureAsset,
  Vec3,
} from "@tessera/schema";
import {
  AssetIdSchema,
  EntityIdSchema,
  MaterialAssetSchema,
  MeshRendererSchema,
} from "@tessera/schema";
import type { Clock, Result, TesseraError } from "@tessera/std";
import { abortError, err, invariant, ok, tesseraError } from "@tessera/std";
import type { BlobStore } from "@tessera/storage";
import { createDefaultMaterial } from "./default-material.js";
import type { ImportEncodeOptions } from "./encode-options.js";
import { applyImportEncode } from "./encode-options.js";
import { stampDracoOnGlb } from "./encoders.js";
import type { AssetInput, EntityInput, ImportPlan } from "./import-plan.js";
import { HARD_BLOB_LIMIT_BYTES, IMPORT_TRIANGLE_WARN_COUNT } from "./import-plan.js";

export { HARD_BLOB_LIMIT_BYTES, IMPORT_TRIANGLE_WARN_COUNT } from "./import-plan.js";

const UNSUPPORTED_EXTENSIONS = new Set([
  ".fbx",
  ".obj",
  ".usd",
  ".usda",
  ".usdc",
  ".usdz",
  ".blend",
]);
const MODE_TRIANGLES = 4;
const MODE_TRIANGLE_STRIP = 5;
const MODE_TRIANGLE_FAN = 6;
const WRAP_CLAMP = 33071;
const WRAP_MIRROR = 33648;
const KM = 1000;
const MM = 0.001;
const NAME_CHAR = /^[\p{L}\p{N} _.\-()]$/u;

/**
 * Inputs for {@link importGltf} (`08` §7.1). The function is the worker body; a real Worker
 * thread is INV-AST-06 (Q-0053).
 *
 * @public
 */
export interface ImportGltfInput {
  readonly bytes: Uint8Array;
  readonly fileName: string;
  readonly blobs: BlobStore;
  readonly clock: Clock;
  readonly signal?: AbortSignal;
  readonly compress?: boolean;
  readonly textureCompress?: boolean;
  readonly targetTriangles?: number;
}

/**
 * Warning text when `count` exceeds the 2M triangle threshold (`08` §7.1).
 *
 * @example
 * ```ts
 * triangleCountWarning(2_000_001);
 * ```
 *
 * @public
 */
export function triangleCountWarning(
  count: number,
  limit = IMPORT_TRIANGLE_WARN_COUNT,
): string | undefined {
  if (count > limit) {
    return `Triangle count ${String(count)} exceeds ${String(limit)}; consider simplify`;
  }
  return undefined;
}

/**
 * Parses glTF/GLB, writes blobs, and returns an {@link ImportPlan}. Never touches the document
 * (`INV-AST-02`).
 *
 * @example
 * ```ts
 * const plan = await importGltf({ bytes, fileName: "box.glb", blobs, clock });
 * ```
 *
 * @public
 */
export async function importGltf(
  input: ImportGltfInput,
): Promise<Result<ImportPlan, TesseraError>> {
  const stopped = cancelled(input.signal);
  if (stopped !== undefined) {
    return stopped;
  }
  const extension = fileExtension(input.fileName);
  if (UNSUPPORTED_EXTENSIONS.has(extension)) {
    return err(
      tesseraError(
        "UNSUPPORTED",
        "Convert through the Blender bridge (phase 4) or an external converter",
        { fileName: input.fileName },
      ),
    );
  }
  if (input.bytes.byteLength > HARD_BLOB_LIMIT_BYTES) {
    return err(
      tesseraError("INVALID_INPUT", "file exceeds hard blob limit", {
        size: input.bytes.byteLength,
        limit: HARD_BLOB_LIMIT_BYTES,
      }),
    );
  }

  const warnings: string[] = [];
  const encode: ImportEncodeOptions = {
    ...(input.compress === undefined ? {} : { compress: input.compress }),
    ...(input.textureCompress === undefined ? {} : { textureCompress: input.textureCompress }),
    ...(input.targetTriangles === undefined ? {} : { targetTriangles: input.targetTriangles }),
  };
  const io = new WebIO()
    .registerExtensions(ALL_EXTENSIONS)
    .setLogger(new Logger(Logger.Verbosity.SILENT));
  let document: GltfDocument;
  try {
    document = await readDocument(io, input.bytes);
  } catch {
    return err(tesseraError("INVALID_INPUT", "failed to parse glTF"));
  }
  applyImportEncode(document, encode);

  const skipped = cancelled(input.signal);
  if (skipped !== undefined) {
    return skipped;
  }

  document.setLogger(new Logger(Logger.Verbosity.SILENT));
  skipNonTriangles(document, warnings);
  let triangles = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      triangles += getGLPrimitiveCount(prim);
    }
  }
  const triangleWarning = triangleCountWarning(triangles);
  if (triangleWarning !== undefined) {
    warnings.push(triangleWarning);
  }

  bakeNonPositiveScale(document, warnings);
  try {
    await document.transform(dedup(), prune(), weld());
  } catch {
    return err(tesseraError("INVALID_INPUT", "failed to normalize glTF"));
  }
  if (needsTangents(document)) {
    try {
      await document.transform(tangents());
    } catch {
      warnings.push("Normal texture present without tangents; mikktspace not bundled (Q-0055)");
    }
  }
  if (
    document
      .getRoot()
      .listExtensionsUsed()
      .some((extension) => extension.extensionName === "KHR_materials_pbrSpecularGlossiness")
  ) {
    try {
      await document.transform(metalRough());
    } catch {
      return err(tesseraError("INVALID_INPUT", "failed to convert specular-glossiness"));
    }
  }

  const after = cancelled(input.signal);
  if (after !== undefined) {
    return after;
  }

  warnRootBounds(document, warnings);

  const importedAt = input.clock.nowIso();
  const ids = new TempIds();
  const textures = new Map<GltfTexture, AssetId>();
  const materials = new Map<GltfMaterial | "default", AssetId>();
  const geometries = new Map<GltfMesh, AssetId>();
  const assets: AssetInput[] = [];

  const remainingMeshes = document
    .getRoot()
    .listMeshes()
    .filter((mesh) => mesh.listPrimitives().length > 0);
  if (remainingMeshes.length === 0) {
    return ok({ blobs: [], assets, entities: [], warnings });
  }

  let glb = await io.writeBinary(document);
  if (encode.compress === true) {
    glb = stampDracoOnGlb(glb);
  }
  const written = await input.blobs.write(glb, "model/gltf-binary", input.fileName, input.signal);
  if (!written.ok) {
    return written;
  }
  const glbRef = written.value;

  for (const [meshIndex, mesh] of remainingMeshes.entries()) {
    const geometryId = ids.nextAsset();
    geometries.set(mesh, geometryId);
    const bounds = meshBounds(mesh);
    let vertexCount = 0;
    let triCount = 0;
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute("POSITION");
      vertexCount += position?.getCount() ?? 0;
      triCount += getGLPrimitiveCount(prim);
      const material = prim.getMaterial();
      const key = material ?? "default";
      if (materials.has(key)) {
        continue;
      }
      const planned = await planMaterial({
        material,
        importedAt,
        ids,
        textures,
        assets,
        blobs: input.blobs,
        ...(input.signal === undefined ? {} : { signal: input.signal }),
      });
      if (!planned.ok) {
        return planned;
      }
      materials.set(key, planned.value);
    }
    const name = uniqueAssetName(assets, "geometry", sanitizeName(mesh.getName(), "Mesh"));
    assets.push({
      id: geometryId,
      name,
      license: "unknown",
      provenance: { source: "upload", importedAt },
      kind: "geometry",
      source: {
        kind: "blob",
        blob: glbRef,
        meshIndex,
        ...(mesh.getName() === "" ? {} : { meshName: mesh.getName() }),
      },
      bounds,
      stats: {
        triangles: triCount,
        vertices: vertexCount,
        primitiveGroups: mesh.listPrimitives().length,
      },
    });
  }

  const entities = proposeEntities(document, geometries, materials, ids);
  return ok({
    blobs: collectBlobs(glbRef, assets),
    assets: sortAssets(assets),
    entities,
    warnings,
  });
}

function collectBlobs(glbRef: BlobRef, assets: readonly AssetInput[]): BlobRef[] {
  const blobs = [glbRef];
  const seen = new Set([glbRef.hash]);
  for (const asset of assets) {
    if (asset.kind !== "texture") {
      continue;
    }
    if (seen.has(asset.blob.hash)) {
      continue;
    }
    seen.add(asset.blob.hash);
    blobs.push(asset.blob);
  }
  return blobs;
}

function sortAssets(assets: readonly AssetInput[]): AssetInput[] {
  const order = { geometry: 0, material: 1, texture: 2, environment: 3, script: 4 };
  return [...assets].sort((left, right) => order[left.kind] - order[right.kind]);
}

interface PlanMaterialInput {
  readonly material: GltfMaterial | null;
  readonly importedAt: string;
  readonly ids: TempIds;
  readonly textures: Map<GltfTexture, AssetId>;
  readonly assets: AssetInput[];
  readonly blobs: BlobStore;
  readonly signal?: AbortSignal;
}

async function planMaterial(input: PlanMaterialInput): Promise<Result<AssetId, TesseraError>> {
  if (input.material === null) {
    const id = input.ids.nextAsset();
    const created = createDefaultMaterial({ id, createdAt: input.importedAt });
    input.assets.push({
      ...omitCreatedAt(created),
      provenance: { source: "upload", importedAt: input.importedAt },
    });
    return ok(id);
  }
  const id = input.ids.nextAsset();
  const factor = input.material.getBaseColorFactor();
  const emissive = input.material.getEmissiveFactor();
  const unlit = input.material.getExtension(KHRMaterialsUnlit.EXTENSION_NAME);
  const parsed = MaterialAssetSchema.parse({
    id,
    name: uniqueAssetName(
      input.assets,
      "material",
      sanitizeName(input.material.getName(), "Material"),
    ),
    license: "unknown",
    provenance: { source: "upload", importedAt: input.importedAt },
    createdAt: input.importedAt,
    kind: "material",
    model: unlit === null ? "pbr" : "unlit",
    baseColor: toHex(factor),
    metallic: input.material.getMetallicFactor(),
    roughness: input.material.getRoughnessFactor(),
    emissive: toHex(emissive),
    opacity: factor[3] ?? 1,
    alphaMode: mapAlphaMode(input.material.getAlphaMode()),
    alphaCutoff: input.material.getAlphaCutoff(),
    doubleSided: input.material.getDoubleSided(),
    normalScale: input.material.getNormalScale(),
    occlusionStrength: input.material.getOcclusionStrength(),
  });
  const withSlots = await assignTextureSlots(input, omitCreatedAt(parsed), input.material);
  if (!withSlots.ok) {
    return withSlots;
  }
  input.assets.push(withSlots.value);
  return ok(id);
}

async function assignTextureSlots(
  input: PlanMaterialInput,
  material: Omit<MaterialAsset, "createdAt">,
  source: GltfMaterial,
): Promise<Result<Omit<MaterialAsset, "createdAt">, TesseraError>> {
  let next = material;
  const slots = [
    {
      getter: () => source.getBaseColorTexture(),
      info: () => source.getBaseColorTextureInfo(),
      key: "baseColorTexture",
      color: true,
    },
    {
      getter: () => source.getMetallicRoughnessTexture(),
      info: () => source.getMetallicRoughnessTextureInfo(),
      key: "metallicRoughnessTexture",
      color: false,
    },
    {
      getter: () => source.getNormalTexture(),
      info: () => source.getNormalTextureInfo(),
      key: "normalTexture",
      color: false,
    },
    {
      getter: () => source.getOcclusionTexture(),
      info: () => source.getOcclusionTextureInfo(),
      key: "occlusionTexture",
      color: false,
    },
    {
      getter: () => source.getEmissiveTexture(),
      info: () => source.getEmissiveTextureInfo(),
      key: "emissiveTexture",
      color: true,
    },
  ] as const;
  for (const slot of slots) {
    const texture = slot.getter();
    if (texture === null) {
      continue;
    }
    const info = slot.info();
    const planned = await planTexture(input, texture, slot.color, info);
    if (!planned.ok) {
      return planned;
    }
    next = {
      ...next,
      [slot.key]: {
        texture: planned.value,
        texCoord: info !== null && info.getTexCoord() === 1 ? 1 : 0,
      },
    };
  }
  return ok(next);
}

async function planTexture(
  input: PlanMaterialInput,
  texture: GltfTexture,
  srgb: boolean,
  info: TextureInfo | null,
): Promise<Result<AssetId, TesseraError>> {
  const existing = input.textures.get(texture);
  if (existing !== undefined) {
    return ok(existing);
  }
  const image = texture.getImage();
  if (image === null) {
    return err(tesseraError("INVALID_INPUT", "texture is missing image bytes"));
  }
  const mime = texture.getMimeType() || "application/octet-stream";
  const written = await input.blobs.write(
    copyBytes(image),
    mime,
    texture.getName() || undefined,
    input.signal,
  );
  if (!written.ok) {
    return written;
  }
  const id = input.ids.nextAsset();
  input.textures.set(texture, id);
  const size = texture.getSize();
  const planned: Omit<TextureAsset, "createdAt"> = {
    id,
    name: uniqueAssetName(input.assets, "texture", sanitizeName(texture.getName(), "Texture")),
    license: "unknown",
    provenance: { source: "upload", importedAt: input.importedAt },
    kind: "texture",
    blob: written.value,
    colorSpace: srgb ? "srgb" : "linear",
    wrapS: mapWrap(info?.getWrapS()),
    wrapT: mapWrap(info?.getWrapT()),
    size: size === null ? [1, 1] : [size[0], size[1]],
    hasAlpha: mime.includes("png") || mime.includes("webp"),
  };
  input.assets.push(planned);
  return ok(id);
}

function proposeEntities(
  document: GltfDocument,
  geometries: Map<GltfMesh, AssetId>,
  materials: Map<GltfMaterial | "default", AssetId>,
  ids: TempIds,
): EntityInput[] {
  const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0];
  if (scene === null || scene === undefined) {
    return [];
  }
  const meshNodes: GltfNode[] = [];
  for (const root of scene.listChildren()) {
    collectMeshNodes(root, meshNodes);
  }
  if (meshNodes.length === 0) {
    return [];
  }
  if (meshNodes.length === 1) {
    const node = meshNodes[0];
    if (node === undefined) {
      return [];
    }
    return [entityFromNode(node, null, geometries, materials, ids)];
  }
  const keep = new Set<GltfNode>(meshNodes);
  for (const meshNode of meshNodes) {
    for (let parent = meshNode.getParentNode(); parent !== null; parent = parent.getParentNode()) {
      keep.add(parent);
    }
  }
  const entities: EntityInput[] = [];
  const nodeIds = new Map<GltfNode, EntityId>();
  const walk = (node: GltfNode, parentId: EntityId | null): void => {
    if (!keep.has(node)) {
      for (const child of node.listChildren()) {
        walk(child, parentId);
      }
      return;
    }
    const entity = entityFromNode(node, parentId, geometries, materials, ids);
    nodeIds.set(node, entity.id);
    entities.push(entity);
    for (const child of node.listChildren()) {
      walk(child, entity.id);
    }
  };
  for (const root of scene.listChildren()) {
    walk(root, null);
  }
  return entities;
}

function entityFromNode(
  node: GltfNode,
  parent: EntityId | null,
  geometries: Map<GltfMesh, AssetId>,
  materials: Map<GltfMaterial | "default", AssetId>,
  ids: TempIds,
): EntityInput {
  const rotation = node.getRotation();
  const scale = node.getScale();
  const translation = node.getTranslation();
  const transform = {
    position: vec3(translation, [0, 0, 0]),
    rotation: quatToEulerDeg(rotation),
    scale: positiveScale(scale),
  };
  const mesh = node.getMesh();
  const geometryId = mesh === null ? undefined : geometries.get(mesh);
  if (geometryId === undefined || mesh === null) {
    return {
      id: ids.nextEntity(),
      name: sanitizeName(node.getName(), "Entity"),
      parent,
      components: { transform },
    };
  }
  const materialIds: AssetId[] = [];
  for (const prim of mesh.listPrimitives()) {
    const key = prim.getMaterial() ?? "default";
    const materialId = materials.get(key);
    if (materialId !== undefined) {
      materialIds.push(materialId);
    }
  }
  return {
    id: ids.nextEntity(),
    name: sanitizeName(node.getName(), "Entity"),
    parent,
    components: {
      transform,
      meshRenderer: MeshRendererSchema.parse({
        geometry: geometryId,
        materials: materialIds,
      }),
    },
  };
}

function collectMeshNodes(node: GltfNode, acc: GltfNode[]): void {
  if ((node.getMesh()?.listPrimitives().length ?? 0) > 0) {
    acc.push(node);
  }
  for (const child of node.listChildren()) {
    collectMeshNodes(child, acc);
  }
}

function skipNonTriangles(document: GltfDocument, warnings: string[]): void {
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of [...mesh.listPrimitives()]) {
      if (isTriangleMode(prim.getMode())) {
        continue;
      }
      warnings.push(
        `Skipped non-triangle primitive in mesh '${sanitizeName(mesh.getName(), "Mesh")}'`,
      );
      prim.dispose();
    }
  }
}

function bakeNonPositiveScale(document: GltfDocument, warnings: string[]): void {
  for (const node of document.getRoot().listNodes()) {
    const scale = node.getScale();
    if (scale[0] > 0 && scale[1] > 0 && scale[2] > 0) {
      continue;
    }
    warnings.push(
      "INVALID_INPUT: non-decomposable node transform; using identity with baked vertices",
    );
    const mesh = node.getMesh();
    if (mesh !== null) {
      transformMesh(mesh, node.getMatrix());
    }
    node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
  }
}

function needsTangents(document: GltfDocument): boolean {
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const material = prim.getMaterial();
      if (material?.getNormalTexture() && prim.getAttribute("TANGENT") === null) {
        return true;
      }
    }
  }
  return false;
}

function warnRootBounds(document: GltfDocument, warnings: string[]): void {
  const hasPrims = document
    .getRoot()
    .listMeshes()
    .some((mesh) => mesh.listPrimitives().length > 0);
  if (!hasPrims) {
    return;
  }
  const scene: GltfScene | null =
    document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0] ?? null;
  if (scene === null) {
    return;
  }
  const bounds = getBounds(scene);
  const extent = Math.max(
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
  );
  if (extent > KM) {
    warnings.push("Root bounds exceed 1 km; consider rescale");
  } else if (extent < MM) {
    warnings.push("Root bounds are under 1 mm; consider rescale");
  }
}

function meshBounds(mesh: GltfMesh): GeometryAsset["bounds"] {
  let min: Vec3 = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  let max: Vec3 = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  let any = false;
  for (const prim of mesh.listPrimitives()) {
    const position = prim.getAttribute("POSITION");
    if (position === null) {
      continue;
    }
    const loTarget = [0, 0, 0];
    const hiTarget = [0, 0, 0];
    position.getMin(loTarget);
    position.getMax(hiTarget);
    const lo = vec3(loTarget, [0, 0, 0]);
    const hi = vec3(hiTarget, [0, 0, 0]);
    min = [Math.min(min[0], lo[0]), Math.min(min[1], lo[1]), Math.min(min[2], lo[2])];
    max = [Math.max(max[0], hi[0]), Math.max(max[1], hi[1]), Math.max(max[2], hi[2])];
    any = true;
  }
  if (!any) {
    return { min: [0, 0, 0], max: [0, 0, 0] };
  }
  return { min, max };
}

async function readDocument(io: WebIO, bytes: Uint8Array): Promise<GltfDocument> {
  const view = copyBytes(bytes);
  if (isGlb(view)) {
    return io.readBinary(view);
  }
  const parsed: unknown = JSON.parse(new TextDecoder().decode(view));
  if (!isRecord(parsed)) {
    throw new Error("glTF JSON must be an object");
  }
  const resources: Record<string, Uint8Array<ArrayBuffer>> = {};
  collectDataUris(parsed, resources);
  const json = JSON.parse(JSON.stringify(parsed));
  return io.readJSON({ json, resources });
}

function collectDataUris(
  json: Record<string, unknown>,
  resources: Record<string, Uint8Array<ArrayBuffer>>,
): void {
  collectUriArray(json["buffers"], resources);
  collectUriArray(json["images"], resources);
}

function collectUriArray(value: unknown, resources: Record<string, Uint8Array<ArrayBuffer>>): void {
  if (!Array.isArray(value)) {
    return;
  }
  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }
    const uri = entry["uri"];
    if (typeof uri !== "string" || !uri.startsWith("data:") || uri in resources) {
      continue;
    }
    const decoded = decodeDataUri(uri);
    if (decoded !== undefined) {
      resources[uri] = decoded;
    }
  }
}

function decodeDataUri(uri: string): Uint8Array<ArrayBuffer> | undefined {
  const comma = uri.indexOf(",");
  if (comma < 0) {
    return undefined;
  }
  const meta = uri.slice(5, comma);
  const data = uri.slice(comma + 1);
  if (!meta.includes(";base64")) {
    return copyBytes(new TextEncoder().encode(decodeURIComponent(data)));
  }
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function copyBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

function isGlb(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x67 &&
    bytes[1] === 0x6c &&
    bytes[2] === 0x54 &&
    bytes[3] === 0x46
  );
}

function fileExtension(fileName: string): string {
  const base = fileName.split(/[/\\]/u).pop() ?? fileName;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) {
    return "";
  }
  return base.slice(dot).toLowerCase();
}

function cancelled(signal: AbortSignal | undefined): Result<never, TesseraError> | undefined {
  if (signal?.aborted === true) {
    return err(abortError());
  }
  return undefined;
}

function isTriangleMode(mode: number): boolean {
  return mode === MODE_TRIANGLES || mode === MODE_TRIANGLE_STRIP || mode === MODE_TRIANGLE_FAN;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeName(raw: string, fallback: string): string {
  let out = "";
  for (const ch of raw) {
    out += NAME_CHAR.test(ch) ? ch : " ";
  }
  const trimmed = out.replace(/\s+/g, " ").trim().slice(0, 64);
  return trimmed.length > 0 ? trimmed : fallback;
}

function uniqueAssetName(
  assets: readonly AssetInput[],
  kind: AssetInput["kind"],
  desired: string,
): string {
  const taken = new Set(
    assets.filter((asset) => asset.kind === kind).map((asset) => asset.name.toLowerCase()),
  );
  if (!taken.has(desired.toLowerCase())) {
    return desired;
  }
  for (let index = 1; index <= 99; index += 1) {
    const suffix = index < 10 ? `_0${String(index)}` : `_${String(index)}`;
    const candidate = `${desired}${suffix}`.slice(0, 64);
    if (!taken.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
  return desired;
}

function toHex(rgb: readonly number[]): string {
  return `#${hexChannel(rgb[0])}${hexChannel(rgb[1])}${hexChannel(rgb[2])}`;
}

function hexChannel(value: number | undefined): string {
  const n = Math.round(Math.min(1, Math.max(0, value ?? 0)) * 255);
  return n.toString(16).padStart(2, "0");
}

function mapAlphaMode(mode: string): "opaque" | "mask" | "blend" {
  if (mode === "MASK") {
    return "mask";
  }
  if (mode === "BLEND") {
    return "blend";
  }
  return "opaque";
}

function mapWrap(mode: number | undefined): "repeat" | "clamp" | "mirror" {
  if (mode === WRAP_CLAMP) {
    return "clamp";
  }
  if (mode === WRAP_MIRROR) {
    return "mirror";
  }
  return "repeat";
}

function vec3(value: readonly number[] | undefined, fallback: Vec3): Vec3 {
  const x = value?.[0];
  const y = value?.[1];
  const z = value?.[2];
  if (x === undefined || y === undefined || z === undefined) {
    return fallback;
  }
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return fallback;
  }
  return [x, y, z];
}

function positiveScale(value: readonly number[]): Vec3 {
  const x = value[0] ?? 1;
  const y = value[1] ?? 1;
  const z = value[2] ?? 1;
  return [x > 0 ? x : 1, y > 0 ? y : 1, z > 0 ? z : 1];
}

function quatToEulerDeg(q: readonly number[]): Vec3 {
  const x = q[0] ?? 0;
  const y = q[1] ?? 0;
  const z = q[2] ?? 0;
  const w = q[3] ?? 1;
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  const m11 = 1 - (yy + zz);
  const m12 = xy - wz;
  const m13 = xz + wy;
  const m22 = 1 - (xx + zz);
  const m23 = yz(y, z2, wx);
  const m32 = y * z2 + wx;
  const m33 = 1 - (xx + yy);
  const clamped = Math.min(1, Math.max(-1, m13));
  const ey = Math.asin(clamped);
  let ex: number;
  let ez: number;
  if (Math.abs(m13) < 0.9999999) {
    ex = Math.atan2(-m23, m33);
    ez = Math.atan2(-m12, m11);
  } else {
    ex = Math.atan2(m32, m22);
    ez = 0;
  }
  const deg = 180 / Math.PI;
  return [ex * deg, ey * deg, ez * deg];
}

function yz(y: number, z2: number, wx: number): number {
  return y * z2 - wx;
}

class TempIds {
  #assets = 0;
  #entities = 0;

  nextAsset(): AssetId {
    const parsed = AssetIdSchema.safeParse(`a_${this.#assets.toString(36).padStart(10, "0")}`);
    invariant(parsed.success, "temporary asset id");
    this.#assets += 1;
    return parsed.data;
  }

  nextEntity(): EntityId {
    const parsed = EntityIdSchema.safeParse(`e_${this.#entities.toString(36).padStart(10, "0")}`);
    invariant(parsed.success, "temporary entity id");
    this.#entities += 1;
    return parsed.data;
  }
}

function omitCreatedAt<T extends { readonly createdAt: string }>(asset: T): Omit<T, "createdAt"> {
  const { createdAt: _createdAt, ...rest } = asset;
  return rest;
}
