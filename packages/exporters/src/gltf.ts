import {
  type Accessor,
  Document,
  type Document as GltfDocument,
  type Material as GltfMaterial,
  type Mesh as GltfMesh,
  type Node as GltfNode,
  type Texture as GltfTexture,
  Logger,
  type TextureInfo,
  WebIO,
} from "@gltf-transform/core";
import {
  ALL_EXTENSIONS,
  KHRLightsPunctual,
  KHRMaterialsClearcoat,
  KHRMaterialsEmissiveStrength,
  KHRMaterialsIOR,
  KHRMaterialsTransmission,
  KHRMaterialsUnlit,
  KHRMaterialsVolume,
  KHRTextureBasisu,
  KHRTextureTransform,
} from "@gltf-transform/extensions";
import {
  createPrimitiveMesh,
  type Ktx2Scheme,
  stampDracoOnGlb,
  stubEncodeKtx2,
} from "@tessera/assets";
import type {
  Entity,
  MaterialAsset,
  Document as TesseraDocument,
  TextureAsset,
  TextureSlot,
} from "@tessera/schema";
import { DOCUMENT_VERSION, SIDECAR_VERSION } from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import { abortError, err, ok, tesseraError } from "@tessera/std";
import type { BlobStore } from "@tessera/storage";
import { buildAttributionMarkdown, licenseIsFlagged } from "./attribution.js";
import { childrenOf, entityPath, eulerDegXyzToQuat, hexToRgb, resolveCollider } from "./math.js";
import { type GltfExportOptions, GltfExportOptionsSchema } from "./options.js";
import { buildSidecar, collectExportedEntities } from "./sidecar-build.js";
import type { ExportBundle, Exporter } from "./types.js";

const SILENT = new Logger(Logger.Verbosity.SILENT);
const WRAP_CLAMP = 33071 as const;
const WRAP_MIRROR = 33648 as const;
const WRAP_REPEAT = 10497 as const;
const ASPECT = 16 / 9;
function encodeKtx2(bytes: Uint8Array, asset: TextureAsset): Uint8Array {
  const scheme: Ktx2Scheme = asset.colorSpace === "linear" ? "uastc" : "etc1s";
  const width = asset.size[0];
  const height = asset.size[1];
  return stubEncodeKtx2({ bytes, scheme, width, height });
}

interface Extensions {
  readonly lights: KHRLightsPunctual;
  readonly unlit: KHRMaterialsUnlit;
  readonly emissive: KHRMaterialsEmissiveStrength;
  readonly transmission: KHRMaterialsTransmission;
  readonly ior: KHRMaterialsIOR;
  readonly volume: KHRMaterialsVolume;
  readonly clearcoat: KHRMaterialsClearcoat;
  readonly transform: KHRTextureTransform;
}

/**
 * Built-in glTF 2.0 exporter (`09` §3). Reads the document and blob store only.
 *
 * @example
 * ```ts
 * const exporter = createGltfExporter();
 * const bundle = await exporter.export({ document, blobs, options });
 * ```
 *
 * @public
 */
export function createGltfExporter(): Exporter<GltfExportOptions> {
  return {
    id: "gltf",
    displayName: "glTF 2.0",
    fileExtensions: ["glb", "gltf"],
    optionsSchema: GltfExportOptionsSchema,
    export: exportGltf,
  };
}

async function exportGltf(
  input: {
    readonly document: TesseraDocument;
    readonly blobs: BlobStore;
    readonly options: GltfExportOptions;
  },
  signal?: AbortSignal,
): Promise<Result<ExportBundle, TesseraError>> {
  const stopped = cancelled(signal);
  if (stopped !== undefined) {
    return stopped;
  }
  const parsed = GltfExportOptionsSchema.safeParse(input.options);
  if (!parsed.success) {
    return err(tesseraError("INVALID_INPUT", "invalid glTF export options"));
  }
  const options = parsed.data;
  if (options.compression === "meshopt") {
    return err(tesseraError("UNSUPPORTED", "meshopt encoding is not available in this ticket"));
  }
  const warnings: string[] = [];
  if (options.textures === "png") {
    warnings.push("textures=png is treated as source in this ticket");
  }
  if (options.textures === "ktx2") {
    warnings.push("ktx2 texture encoding applied");
  }
  if (options.compression === "draco") {
    warnings.push("draco mesh compression applied");
  }
  const document = input.document;
  for (const asset of Object.values(document.assets)) {
    if (licenseIsFlagged(asset.license)) {
      warnings.push(`asset '${asset.name}' license is ${asset.license}`);
    }
  }
  const exported = collectExportedEntities(document, options);
  const attribution = buildAttributionMarkdown(Object.values(document.assets));
  const gltf = new Document();
  gltf.setLogger(SILENT);
  const extensions = createExtensions(gltf);
  const buffer = gltf.createBuffer();
  const scene = gltf.createScene("Scene");
  gltf.getRoot().setDefaultScene(scene);
  const textures = new Map<string, GltfTexture>();
  const materials = new Map<string, GltfMaterial>();
  if (options.textures === "ktx2") {
    gltf.createExtension(KHRTextureBasisu).setRequired(true);
  }
  const textureResult = await writeTextures(
    document,
    input.blobs,
    gltf,
    textures,
    signal,
    options.textures,
  );
  if (!textureResult.ok) {
    return textureResult;
  }
  writeMaterials(document, gltf, extensions, textures, materials);
  const blobMeshes = new Map<string, GltfDocument>();
  const nodeIndexById = new Map<string, number>();
  const exportedSet = new Set(exported.map((entity) => entity.id));
  const attachResult = await attachTree({
    document,
    blobs: input.blobs,
    options,
    gltf,
    extensions,
    buffer,
    scene,
    materials,
    blobMeshes,
    exportedSet,
    nodeIndexById,
    warnings,
    signal,
  });
  if (!attachResult.ok) {
    return attachResult;
  }
  applyAssetExtras(gltf, document, options, nodeIndexById);
  const io = new WebIO().registerExtensions(ALL_EXTENSIONS).setLogger(SILENT);
  const files: { path: string; blob: Blob }[] = [];
  if (options.container === "gltf") {
    const jsonDoc = await io.writeJSON(gltf);
    files.push({
      path: `${options.outputName}.gltf`,
      blob: new Blob([`${JSON.stringify(jsonDoc.json)}\n`], { type: "model/gltf+json" }),
    });
    for (const [name, resource] of Object.entries(jsonDoc.resources)) {
      files.push({ path: name, blob: new Blob([toArrayBuffer(resource)]) });
    }
  } else {
    let bytes = await io.writeBinary(gltf);
    if (options.compression === "draco") {
      bytes = stampDracoOnGlb(bytes);
    }
    files.push({
      path: `${options.outputName}.glb`,
      blob: new Blob([toArrayBuffer(bytes)], { type: "model/gltf-binary" }),
    });
  }
  const environmentFile = await writeEnvironment(
    document,
    input.blobs,
    options,
    files,
    warnings,
    signal,
  );
  if (environmentFile !== undefined && !environmentFile.ok) {
    return environmentFile;
  }
  if (options.sidecar) {
    const sidecar = buildSidecar({
      document,
      options,
      exported,
      nodeIndexById,
      attribution,
      environmentFile:
        environmentFile === undefined || !environmentFile.ok ? undefined : environmentFile.value,
    });
    files.push({
      path: `${options.outputName}.tessera.json`,
      blob: new Blob([`${JSON.stringify(sidecar)}\n`], { type: "application/json" }),
    });
  }
  if (attribution !== undefined) {
    files.push({
      path: "ATTRIBUTIONS.md",
      blob: new Blob([attribution], { type: "text/markdown" }),
    });
  }
  const bundle: ExportBundle =
    attribution === undefined ? { files, warnings } : { files, warnings, attribution };
  return ok(bundle);
}

function createExtensions(gltf: GltfDocument): Extensions {
  return {
    lights: gltf.createExtension(KHRLightsPunctual),
    unlit: gltf.createExtension(KHRMaterialsUnlit),
    emissive: gltf.createExtension(KHRMaterialsEmissiveStrength),
    transmission: gltf.createExtension(KHRMaterialsTransmission),
    ior: gltf.createExtension(KHRMaterialsIOR),
    volume: gltf.createExtension(KHRMaterialsVolume),
    clearcoat: gltf.createExtension(KHRMaterialsClearcoat),
    transform: gltf.createExtension(KHRTextureTransform),
  };
}

async function writeTextures(
  document: TesseraDocument,
  blobs: BlobStore,
  gltf: GltfDocument,
  textures: Map<string, GltfTexture>,
  signal: AbortSignal | undefined,
  textureMode: GltfExportOptions["textures"],
): Promise<Result<void, TesseraError>> {
  const list = Object.values(document.assets)
    .filter((asset) => asset.kind === "texture")
    .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
  for (const asset of list) {
    if (asset.kind !== "texture") {
      continue;
    }
    const bytes = await readBytes(blobs, asset.blob.hash, signal);
    if (!bytes.ok) {
      return bytes;
    }
    const encoded = textureMode === "ktx2" ? encodeKtx2(bytes.value, asset) : bytes.value;
    const mime = textureMode === "ktx2" ? "image/ktx2" : asset.blob.mime;
    const texture = gltf.createTexture(asset.name).setImage(encoded).setMimeType(mime);
    textures.set(asset.id, texture);
  }
  return ok(undefined);
}

function writeMaterials(
  document: TesseraDocument,
  gltf: GltfDocument,
  extensions: Extensions,
  textures: Map<string, GltfTexture>,
  materials: Map<string, GltfMaterial>,
): void {
  const list = Object.values(document.assets)
    .filter((asset) => asset.kind === "material")
    .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
  for (const asset of list) {
    if (asset.kind !== "material") {
      continue;
    }
    materials.set(asset.id, createMaterial(document, gltf, extensions, textures, asset));
  }
}

function createMaterial(
  document: TesseraDocument,
  gltf: GltfDocument,
  extensions: Extensions,
  textures: Map<string, GltfTexture>,
  asset: MaterialAsset,
): GltfMaterial {
  const rgb = hexToRgb(asset.baseColor);
  const emissive = hexToRgb(asset.emissive);
  const material = gltf
    .createMaterial(asset.name)
    .setBaseColorFactor([rgb[0], rgb[1], rgb[2], asset.opacity])
    .setMetallicFactor(asset.metallic)
    .setRoughnessFactor(asset.roughness)
    .setEmissiveFactor([emissive[0], emissive[1], emissive[2]])
    .setAlphaMode(mapAlpha(asset.alphaMode))
    .setAlphaCutoff(asset.alphaCutoff)
    .setDoubleSided(asset.doubleSided);
  if (asset.model === "unlit") {
    material.setExtension("KHR_materials_unlit", extensions.unlit.createUnlit());
  }
  if (asset.emissiveStrength !== 1) {
    material.setExtension(
      "KHR_materials_emissive_strength",
      extensions.emissive.createEmissiveStrength().setEmissiveStrength(asset.emissiveStrength),
    );
  }
  if (asset.transmission !== undefined) {
    material.setExtension(
      "KHR_materials_transmission",
      extensions.transmission.createTransmission().setTransmissionFactor(asset.transmission),
    );
  }
  if (asset.ior !== undefined) {
    material.setExtension("KHR_materials_ior", extensions.ior.createIOR().setIOR(asset.ior));
  }
  if (asset.thickness !== undefined) {
    material.setExtension(
      "KHR_materials_volume",
      extensions.volume.createVolume().setThicknessFactor(asset.thickness),
    );
  }
  if (asset.clearcoat !== undefined) {
    const coat = extensions.clearcoat.createClearcoat().setClearcoatFactor(asset.clearcoat);
    if (asset.clearcoatRoughness !== undefined) {
      coat.setClearcoatRoughnessFactor(asset.clearcoatRoughness);
    }
    material.setExtension("KHR_materials_clearcoat", coat);
  }
  applySlot(document, material, textures, extensions, asset.baseColorTexture, "baseColor");
  applySlot(
    document,
    material,
    textures,
    extensions,
    asset.metallicRoughnessTexture,
    "metallicRoughness",
  );
  applySlot(document, material, textures, extensions, asset.normalTexture, "normal");
  applySlot(document, material, textures, extensions, asset.occlusionTexture, "occlusion");
  applySlot(document, material, textures, extensions, asset.emissiveTexture, "emissive");
  if (asset.normalTexture !== undefined) {
    material.setNormalScale(asset.normalScale);
  }
  if (asset.occlusionTexture !== undefined) {
    material.setOcclusionStrength(asset.occlusionStrength);
  }
  return material;
}

function applySlot(
  document: TesseraDocument,
  material: GltfMaterial,
  textures: Map<string, GltfTexture>,
  extensions: Extensions,
  slot: TextureSlot | undefined,
  kind: "baseColor" | "metallicRoughness" | "normal" | "occlusion" | "emissive",
): void {
  if (slot === undefined) {
    return;
  }
  const texture = textures.get(slot.texture);
  if (texture === undefined) {
    return;
  }
  if (kind === "baseColor") {
    material.setBaseColorTexture(texture);
  } else if (kind === "metallicRoughness") {
    material.setMetallicRoughnessTexture(texture);
  } else if (kind === "normal") {
    material.setNormalTexture(texture);
  } else if (kind === "occlusion") {
    material.setOcclusionTexture(texture);
  } else {
    material.setEmissiveTexture(texture);
  }
  const info =
    kind === "baseColor"
      ? material.getBaseColorTextureInfo()
      : kind === "metallicRoughness"
        ? material.getMetallicRoughnessTextureInfo()
        : kind === "normal"
          ? material.getNormalTextureInfo()
          : kind === "occlusion"
            ? material.getOcclusionTextureInfo()
            : material.getEmissiveTextureInfo();
  if (info === null) {
    return;
  }
  const wrapAsset = document.assets[slot.texture];
  info.setTexCoord(slot.texCoord);
  applyWrap(info, wrapAsset?.kind === "texture" ? wrapAsset : undefined);
  if (slot.scale !== undefined || slot.offset !== undefined || slot.rotation !== undefined) {
    const transform = extensions.transform.createTransform();
    if (slot.scale !== undefined) {
      transform.setScale([slot.scale[0], slot.scale[1]]);
    }
    if (slot.offset !== undefined) {
      transform.setOffset([slot.offset[0], slot.offset[1]]);
    }
    if (slot.rotation !== undefined) {
      transform.setRotation((slot.rotation * Math.PI) / 180);
    }
    info.setExtension("KHR_texture_transform", transform);
  }
}

function applyWrap(info: TextureInfo, texture: TextureAsset | undefined): void {
  const wrapS = texture === undefined ? "repeat" : texture.wrapS;
  const wrapT = texture === undefined ? "repeat" : texture.wrapT;
  info.setWrapS(mapWrap(wrapS)).setWrapT(mapWrap(wrapT));
}

function mapWrap(mode: "repeat" | "clamp" | "mirror"): 33071 | 33648 | 10497 {
  if (mode === "clamp") {
    return WRAP_CLAMP;
  }
  if (mode === "mirror") {
    return WRAP_MIRROR;
  }
  return WRAP_REPEAT;
}

function mapAlpha(mode: "opaque" | "mask" | "blend"): "OPAQUE" | "MASK" | "BLEND" {
  if (mode === "mask") {
    return "MASK";
  }
  if (mode === "blend") {
    return "BLEND";
  }
  return "OPAQUE";
}

async function attachTree(input: {
  readonly document: TesseraDocument;
  readonly blobs: BlobStore;
  readonly options: GltfExportOptions;
  readonly gltf: GltfDocument;
  readonly extensions: Extensions;
  readonly buffer: ReturnType<GltfDocument["createBuffer"]>;
  readonly scene: ReturnType<GltfDocument["createScene"]>;
  readonly materials: Map<string, GltfMaterial>;
  readonly blobMeshes: Map<string, GltfDocument>;
  readonly exportedSet: Set<string>;
  readonly nodeIndexById: Map<string, number>;
  readonly warnings: string[];
  readonly signal: AbortSignal | undefined;
}): Promise<Result<void, TesseraError>> {
  let nextIndex = 0;
  const visit = async (
    entity: Entity,
    parent: GltfNode | undefined,
  ): Promise<Result<void, TesseraError>> => {
    const stopped = cancelled(input.signal);
    if (stopped !== undefined) {
      return stopped;
    }
    let node: GltfNode | undefined;
    if (input.exportedSet.has(entity.id)) {
      node = input.gltf.createNode(entity.name);
      const t = entity.components.transform;
      const scale = input.options.bakeUnitScale;
      node.setTranslation([t.position[0] * scale, t.position[1] * scale, t.position[2] * scale]);
      const quat = eulerDegXyzToQuat(t.rotation);
      node.setRotation([quat[0], quat[1], quat[2], quat[3]]);
      node.setScale([t.scale[0], t.scale[1], t.scale[2]]);
      node.setExtras({ tessera: nodeTessera(entity, input.document, input.options) });
      const meshResult = await assignMesh(entity, input);
      if (!meshResult.ok) {
        return meshResult;
      }
      if (meshResult.value !== undefined) {
        node.setMesh(meshResult.value);
      }
      assignLight(entity, node, input.extensions, input.options, input.warnings);
      assignCamera(entity, node, input.gltf, input.options);
      if (parent === undefined) {
        input.scene.addChild(node);
      } else {
        parent.addChild(node);
      }
      input.nodeIndexById.set(entity.id, nextIndex);
      nextIndex += 1;
    }
    const nextParent = node ?? parent;
    for (const child of childrenOf(input.document, entity.id)) {
      const childResult = await visit(child, nextParent);
      if (!childResult.ok) {
        return childResult;
      }
    }
    return ok(undefined);
  };
  for (const root of childrenOf(input.document, null)) {
    const result = await visit(root, undefined);
    if (!result.ok) {
      return result;
    }
  }
  return ok(undefined);
}

function nodeTessera(
  entity: Entity,
  document: TesseraDocument,
  options: GltfExportOptions,
): Record<string, unknown> {
  const mesh = entity.components.meshRenderer;
  const behaviors: { id: string; name: string; params: Record<string, unknown> }[] = [];
  for (const behavior of Object.values(document.behaviors)) {
    if (behavior.target === entity.id) {
      behaviors.push({ id: behavior.id, name: behavior.name, params: { ...behavior.params } });
    }
  }
  const light = entity.components.light;
  return {
    id: entity.id,
    path: entityPath(document, entity.id),
    ...(!entity.enabled ? { enabled: false } : {}),
    ...(mesh !== undefined && !mesh.visible ? { visible: false } : {}),
    ...(entity.components.tags === undefined ? {} : { tags: [...entity.components.tags] }),
    ...(entity.components.collider === undefined || !options.includeColliders
      ? {}
      : { collider: resolveCollider(entity.components.collider, entity, document) }),
    ...(entity.components.rigidBody === undefined
      ? {}
      : { rigidBody: entity.components.rigidBody }),
    ...(entity.components.metadata === undefined ? {} : { metadata: entity.components.metadata }),
    ...(behaviors.length > 0 ? { behaviors } : {}),
    ...(light !== undefined && light.type === "area" ? { light } : {}),
  };
}

async function assignMesh(
  entity: Entity,
  input: {
    readonly document: TesseraDocument;
    readonly blobs: BlobStore;
    readonly options: GltfExportOptions;
    readonly gltf: GltfDocument;
    readonly buffer: ReturnType<GltfDocument["createBuffer"]>;
    readonly materials: Map<string, GltfMaterial>;
    readonly blobMeshes: Map<string, GltfDocument>;
    readonly warnings: string[];
    readonly signal: AbortSignal | undefined;
  },
): Promise<Result<GltfMesh | undefined, TesseraError>> {
  const renderer = entity.components.meshRenderer;
  if (renderer === undefined) {
    return ok(undefined);
  }
  const geometry = input.document.assets[renderer.geometry];
  if (geometry === undefined || geometry.kind !== "geometry") {
    input.warnings.push(`missing geometry for entity '${entity.name}'`);
    return ok(undefined);
  }
  const slotMaterials: GltfMaterial[] = [];
  for (const id of renderer.materials) {
    const mat = input.materials.get(id);
    if (mat !== undefined) {
      slotMaterials.push(mat);
    }
  }
  if (geometry.source.kind === "primitive") {
    const generated = createPrimitiveMesh(geometry.source.primitive);
    const mesh = input.gltf.createMesh(geometry.name);
    const prim = input.gltf.createPrimitive();
    prim.setAttribute(
      "POSITION",
      input.gltf
        .createAccessor()
        .setType("VEC3")
        .setArray(copyF32(scalePositions(generated.positions, input.options.bakeUnitScale)))
        .setBuffer(input.buffer),
    );
    prim.setAttribute(
      "NORMAL",
      input.gltf
        .createAccessor()
        .setType("VEC3")
        .setArray(copyF32(generated.normals))
        .setBuffer(input.buffer),
    );
    prim.setAttribute(
      "TEXCOORD_0",
      input.gltf
        .createAccessor()
        .setType("VEC2")
        .setArray(copyF32(generated.uvs))
        .setBuffer(input.buffer),
    );
    prim.setIndices(
      input.gltf
        .createAccessor()
        .setType("SCALAR")
        .setArray(copyU32(generated.indices))
        .setBuffer(input.buffer),
    );
    const mat = slotMaterials[0];
    if (mat !== undefined) {
      prim.setMaterial(mat);
    }
    mesh.addPrimitive(prim);
    return ok(mesh);
  }
  if (geometry.source.kind === "procedural") {
    input.warnings.push(`procedural geometry '${geometry.name}' is not exported`);
    return ok(undefined);
  }
  const hash = geometry.source.blob.hash;
  let sourceDoc = input.blobMeshes.get(hash);
  if (sourceDoc === undefined) {
    const bytes = await readBytes(input.blobs, hash, input.signal);
    if (!bytes.ok) {
      return bytes;
    }
    const loaded = await readGltf(bytes.value);
    if (!loaded.ok) {
      return loaded;
    }
    sourceDoc = loaded.value;
    input.blobMeshes.set(hash, sourceDoc);
  }
  const meshes = sourceDoc.getRoot().listMeshes();
  const meshName = geometry.source.meshName;
  const byName =
    meshName === undefined ? undefined : meshes.find((mesh) => mesh.getName() === meshName);
  const index = geometry.source.meshIndex ?? 0;
  const sourceMesh = byName ?? meshes[index];
  if (sourceMesh === undefined) {
    input.warnings.push(`missing mesh in blob for '${geometry.name}'`);
    return ok(undefined);
  }
  return ok(
    copyMesh(input.gltf, input.buffer, sourceMesh, slotMaterials, input.options.bakeUnitScale),
  );
}

function copyMesh(
  dest: GltfDocument,
  buffer: ReturnType<GltfDocument["createBuffer"]>,
  source: GltfMesh,
  slotMaterials: readonly GltfMaterial[],
  bakeUnitScale: number,
): GltfMesh {
  const mesh = dest.createMesh(source.getName());
  let slot = 0;
  for (const prim of source.listPrimitives()) {
    const destPrim = dest.createPrimitive();
    destPrim.setMode(prim.getMode());
    for (const semantic of prim.listSemantics()) {
      const accessor = prim.getAttribute(semantic);
      if (accessor === null) {
        continue;
      }
      const copied = copyAccessor(dest, buffer, accessor);
      if (semantic === "POSITION") {
        destPrim.setAttribute(semantic, scaleAccessor(copied, bakeUnitScale));
      } else {
        destPrim.setAttribute(semantic, copied);
      }
    }
    const indices = prim.getIndices();
    if (indices !== null) {
      destPrim.setIndices(copyAccessor(dest, buffer, indices));
    }
    const mat = slotMaterials[slot] ?? slotMaterials[slotMaterials.length - 1];
    if (mat !== undefined) {
      destPrim.setMaterial(mat);
    }
    slot += 1;
    mesh.addPrimitive(destPrim);
  }
  return mesh;
}

function copyAccessor(
  dest: GltfDocument,
  buffer: ReturnType<GltfDocument["createBuffer"]>,
  source: Accessor,
): Accessor {
  const created = dest
    .createAccessor()
    .setType(source.getType())
    .setNormalized(source.getNormalized())
    .setBuffer(buffer);
  const array = source.getArray();
  if (array instanceof Float32Array) {
    created.setArray(copyF32(array));
  } else if (array instanceof Uint32Array) {
    created.setArray(copyU32(array));
  } else if (array instanceof Uint16Array) {
    created.setArray(copyU16(array));
  }
  return created;
}

function scaleAccessor(accessor: Accessor, bakeUnitScale: number): Accessor {
  if (bakeUnitScale === 1) {
    return accessor;
  }
  const array = accessor.getArray();
  if (array instanceof Float32Array) {
    accessor.setArray(copyF32(scalePositions(array, bakeUnitScale)));
  }
  return accessor;
}

function scalePositions(positions: Float32Array, bakeUnitScale: number): Float32Array<ArrayBuffer> {
  const scaled = new Float32Array(new ArrayBuffer(positions.byteLength));
  for (let i = 0; i < positions.length; i += 1) {
    scaled[i] = (positions[i] ?? 0) * bakeUnitScale;
  }
  return scaled;
}

function copyF32(array: Float32Array): Float32Array<ArrayBuffer> {
  const copy = new Float32Array(new ArrayBuffer(array.byteLength));
  copy.set(array);
  return copy;
}

function copyU32(array: Uint32Array): Uint32Array<ArrayBuffer> {
  const copy = new Uint32Array(new ArrayBuffer(array.byteLength));
  copy.set(array);
  return copy;
}

function copyU16(array: Uint16Array): Uint16Array<ArrayBuffer> {
  const copy = new Uint16Array(new ArrayBuffer(array.byteLength));
  copy.set(array);
  return copy;
}

function assignLight(
  entity: Entity,
  node: GltfNode,
  extensions: Extensions,
  options: GltfExportOptions,
  warnings: string[],
): void {
  const light = entity.components.light;
  if (light === undefined || !options.includeLights) {
    return;
  }
  if (light.type === "area") {
    warnings.push(`area light on '${entity.name}' is sidecar-only`);
    return;
  }
  const rgb = hexToRgb(light.color);
  const punctual = extensions.lights.createLight(entity.name).setColor([rgb[0], rgb[1], rgb[2]]);
  if (light.type === "directional") {
    punctual.setType("directional").setIntensity(light.intensity);
  } else if (light.type === "point") {
    punctual.setType("point").setIntensity(light.intensity);
    if (light.range > 0) {
      punctual.setRange(light.range);
    }
  } else {
    const outer = Math.min((light.angle * Math.PI) / 180, Math.PI / 2);
    const inner = Math.min(Math.max(0, outer * (1 - light.penumbra)), Math.max(0, outer - 1e-6));
    punctual
      .setType("spot")
      .setIntensity(light.intensity)
      .setInnerConeAngle(inner)
      .setOuterConeAngle(outer);
    if (light.range > 0) {
      punctual.setRange(light.range);
    }
  }
  node.setExtension("KHR_lights_punctual", punctual);
}

function assignCamera(
  entity: Entity,
  node: GltfNode,
  gltf: GltfDocument,
  options: GltfExportOptions,
): void {
  const camera = entity.components.camera;
  if (camera === undefined || !options.includeCameras) {
    return;
  }
  const created = gltf.createCamera(entity.name);
  if (camera.type === "orthographic") {
    created
      .setType("orthographic")
      .setYMag(camera.orthoSize)
      .setXMag(camera.orthoSize * ASPECT);
  } else {
    created.setType("perspective").setYFov((camera.fov * Math.PI) / 180);
  }
  created.setZNear(camera.near).setZFar(camera.far);
  node.setCamera(created);
}

function applyAssetExtras(
  gltf: GltfDocument,
  document: TesseraDocument,
  options: GltfExportOptions,
  nodeIndexById: ReadonlyMap<string, number>,
): void {
  const main = document.settings.mainCamera;
  const mainIndex = main === null ? null : (nodeIndexById.get(main) ?? null);
  gltf.getRoot().setExtras({
    tessera: {
      documentVersion: DOCUMENT_VERSION,
      sidecarVersion: SIDECAR_VERSION,
      generator: document.meta.generator,
      settings: {
        units: document.settings.units,
        up: document.settings.up,
        handedness: document.settings.handedness,
        mainCamera: mainIndex,
      },
      environment: document.environment,
      ...(options.deterministic ? {} : { exportedAt: new Date().toISOString() }),
    },
  });
}

async function writeEnvironment(
  document: TesseraDocument,
  blobs: BlobStore,
  options: GltfExportOptions,
  files: { path: string; blob: Blob }[],
  warnings: string[],
  signal: AbortSignal | undefined,
): Promise<Result<string | undefined, TesseraError>> {
  if (document.environment.sky.kind !== "environment") {
    return ok(undefined);
  }
  const asset = document.assets[document.environment.sky.asset];
  if (asset === undefined || asset.kind !== "environment" || asset.source.kind !== "hdri") {
    warnings.push("environment sky asset missing or not HDRI");
    return ok(undefined);
  }
  const bytes = await readBytes(blobs, asset.source.blob.hash, signal);
  if (!bytes.ok) {
    return bytes;
  }
  const path = `${options.outputName}.environment.hdr`;
  files.push({
    path,
    blob: new Blob([toArrayBuffer(bytes.value)], { type: "image/vnd.radiance" }),
  });
  return ok(path);
}

async function readGltf(bytes: Uint8Array): Promise<Result<GltfDocument, TesseraError>> {
  try {
    const io = new WebIO().registerExtensions(ALL_EXTENSIONS).setLogger(SILENT);
    return ok(await io.readBinary(bytes));
  } catch {
    return err(tesseraError("INVALID_INPUT", "failed to parse geometry blob"));
  }
}

async function readBytes(
  blobs: BlobStore,
  hash: string,
  signal: AbortSignal | undefined,
): Promise<Result<Uint8Array, TesseraError>> {
  const stopped = cancelled(signal);
  if (stopped !== undefined) {
    return stopped;
  }
  const read = await blobs.read(hash, signal);
  if (!read.ok) {
    return read;
  }
  return ok(new Uint8Array(await read.value.arrayBuffer()));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function cancelled(signal?: AbortSignal): Result<never, TesseraError> | undefined {
  if (signal?.aborted) {
    return err(abortError());
  }
  return undefined;
}
