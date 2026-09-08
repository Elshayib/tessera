import type { Asset, Document, Entity, Sidecar, SidecarEntity } from "@tessera/schema";
import { DOCUMENT_VERSION, SIDECAR_FORMAT, SIDECAR_VERSION, SidecarSchema } from "@tessera/schema";
import { childrenOf, entityPath, resolveCollider } from "./math.js";
import type { GltfExportOptions } from "./options.js";

/**
 * Builds `<name>.tessera.json` payload (`09` §4).
 *
 * @public
 */
export function buildSidecar(input: {
  readonly document: Document;
  readonly options: GltfExportOptions;
  readonly exported: readonly Entity[];
  readonly nodeIndexById: ReadonlyMap<string, number>;
  readonly attribution: string | undefined;
  readonly environmentFile: string | undefined;
}): Sidecar {
  const document = input.document;
  const entities: SidecarEntity[] = input.exported.map((entity) => {
    const nodeIndex = input.nodeIndexById.get(entity.id);
    const collider = entity.components.collider;
    const light = entity.components.light;
    const camera = entity.components.camera;
    const visible = entity.components.meshRenderer?.visible ?? true;
    const row: SidecarEntity = {
      id: entity.id,
      name: entity.name,
      path: entityPath(document, entity.id),
      nodeIndex: nodeIndex ?? 0,
      enabled: entity.enabled,
      visible,
      tags: entity.components.tags === undefined ? [] : [...entity.components.tags],
      collider:
        collider === undefined || !input.options.includeColliders
          ? null
          : resolveCollider(collider, entity, document),
      rigidBody: entity.components.rigidBody ?? null,
      metadata: entity.components.metadata === undefined ? {} : { ...entity.components.metadata },
      behaviors: behaviorsFor(document, entity.id),
      light: light === undefined ? null : light,
      camera: camera === undefined ? null : camera,
    };
    return row;
  });
  const assets = Object.values(document.assets)
    .map((asset) => sidecarAsset(asset))
    .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
  const sidecar: Sidecar = {
    format: SIDECAR_FORMAT,
    version: SIDECAR_VERSION,
    documentVersion: DOCUMENT_VERSION,
    generator: document.meta.generator,
    settings: {
      units: document.settings.units,
      up: document.settings.up,
      handedness: document.settings.handedness,
      mainCamera: document.settings.mainCamera,
    },
    environment: sidecarEnvironment(document, input.environmentFile),
    entities,
    assets,
  };
  if (!input.options.deterministic) {
    return SidecarSchema.parse({
      ...sidecar,
      exportedAt: new Date().toISOString(),
      ...(input.attribution === undefined ? {} : { attribution: input.attribution }),
    });
  }
  if (input.attribution !== undefined) {
    return SidecarSchema.parse({ ...sidecar, attribution: input.attribution });
  }
  return SidecarSchema.parse(sidecar);
}

function sidecarAsset(asset: Asset): Sidecar["assets"][number] {
  const provenance = {
    source: asset.provenance.source,
    importedAt: asset.provenance.importedAt,
    ...(asset.provenance.sourceId === undefined ? {} : { sourceId: asset.provenance.sourceId }),
    ...(asset.provenance.sourceUrl === undefined ? {} : { sourceUrl: asset.provenance.sourceUrl }),
    ...(asset.provenance.author === undefined ? {} : { author: asset.provenance.author }),
  };
  return {
    id: asset.id,
    kind: asset.kind,
    name: asset.name,
    license: asset.license,
    provenance,
  };
}

function sidecarEnvironment(
  document: Document,
  environmentFile: string | undefined,
): Sidecar["environment"] {
  const env = document.environment;
  if (env.sky.kind === "environment") {
    const asset = document.assets[env.sky.asset];
    const rotation = asset?.kind === "environment" ? asset.rotation : 0;
    const intensity = asset?.kind === "environment" ? asset.intensity : 1;
    return {
      sky: {
        kind: "environment",
        file: environmentFile ?? `${document.meta.name}.environment.hdr`,
        rotation,
        intensity,
      },
      exposure: env.exposure,
      toneMapping: env.toneMapping,
      fog: env.fog,
      ambient: env.ambient,
    };
  }
  if (env.sky.kind === "color") {
    return {
      sky: { kind: "color", color: env.sky.color },
      exposure: env.exposure,
      toneMapping: env.toneMapping,
      fog: env.fog,
      ambient: env.ambient,
    };
  }
  return {
    sky: { kind: "none" },
    exposure: env.exposure,
    toneMapping: env.toneMapping,
    fog: env.fog,
    ambient: env.ambient,
  };
}

function behaviorsFor(document: Document, entityId: string): SidecarEntity["behaviors"] {
  const list: SidecarEntity["behaviors"] = [];
  for (const behavior of Object.values(document.behaviors)) {
    if (behavior.target === entityId) {
      list.push({ id: behavior.id, name: behavior.name, params: behavior.params });
    }
  }
  list.sort((left, right) => (left.id < right.id ? -1 : 1));
  return list;
}

/**
 * Walks the export tree in sibling order (`09` §3.4).
 *
 * @public
 */
export function collectExportedEntities(
  document: Document,
  options: GltfExportOptions,
): readonly Entity[] {
  const selected = options.selection === undefined ? undefined : new Set<string>(options.selection);
  const out: Entity[] = [];
  const visit = (entity: Entity, ancestorSelected: boolean): void => {
    const isSelected = selected === undefined || selected.has(entity.id) || ancestorSelected;
    const enabledOk = entity.enabled || options.includeDisabled;
    if (isSelected && enabledOk) {
      out.push(entity);
    }
    const passSelection = selected === undefined || isSelected;
    for (const child of childrenOf(document, entity.id)) {
      visit(child, passSelection && selected !== undefined && isSelected);
    }
  };
  for (const root of childrenOf(document, null)) {
    visit(root, false);
  }
  return out;
}
