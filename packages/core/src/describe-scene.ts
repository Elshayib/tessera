import type {
  Asset,
  Document,
  Entity,
  EntityRef,
  Environment,
  Light,
  Primitive,
} from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import { ok } from "@tessera/std";
import { resolveEntityRef } from "./commands/helpers.js";
import type { DocumentReader } from "./document-types.js";

/** Default `scene.describe` detail when omitted (Q-0020). */
export const DEFAULT_DESCRIBE_DETAIL = "outline" as const;

/** Default character budget from `docs/04-command-bus.md` §10. */
export const DEFAULT_DESCRIBE_MAX_CHARS = 8000;

/** Default tree depth from `docs/04-command-bus.md` §10. */
export const DEFAULT_DESCRIBE_MAX_DEPTH = 4;

export interface DescribeSceneInput {
  readonly root?: EntityRef | undefined;
  readonly detail?: "summary" | "outline" | "full" | undefined;
  readonly maxDepth?: number | undefined;
  readonly maxChars?: number | undefined;
  readonly includeAssets?: boolean | undefined;
}

export interface DescribeSceneOutput {
  readonly text: string;
  readonly truncated: boolean;
  readonly entityCount: number;
}

interface LineSink {
  truncated: boolean;
  entityCount: number;
  push(line: string): boolean;
  text(): string;
}

/**
 * Compact hierarchical scene text for language models (`docs/04-command-bus.md` §11).
 *
 * @example
 * ```ts
 * const described = describeScene(reader, { detail: "outline" });
 * ```
 *
 * @public
 */
export function describeScene(
  reader: DocumentReader,
  input: DescribeSceneInput = {},
): Result<DescribeSceneOutput, TesseraError> {
  const snapshot = reader.snapshot();
  let rootEntity: Entity | undefined;
  if (input.root !== undefined) {
    const resolved = resolveEntityRef(reader, input.root);
    if (!resolved.ok) {
      return resolved;
    }
    rootEntity = resolved.value;
  }
  const maxChars = input.maxChars ?? DEFAULT_DESCRIBE_MAX_CHARS;
  const maxDepth = input.maxDepth ?? DEFAULT_DESCRIBE_MAX_DEPTH;
  const detail = input.detail ?? DEFAULT_DESCRIBE_DETAIL;
  const effectiveDepth = detail === "summary" ? 1 : maxDepth;
  const index = indexEntities(snapshot);
  const sink = createSink(maxChars);
  if (!sink.push(headerLine(snapshot, index))) {
    return ok({ text: sink.text(), truncated: true, entityCount: 0 });
  }
  if (rootEntity === undefined) {
    if (!sink.push("/")) {
      return ok({ text: sink.text(), truncated: sink.truncated, entityCount: sink.entityCount });
    }
    walkChildren(index, snapshot, null, "", 1, effectiveDepth, detail, sink);
  } else {
    emitEntity(index, snapshot, rootEntity, "", true, 1, effectiveDepth, detail, sink);
  }
  if (input.includeAssets === true && !sink.truncated) {
    appendAssets(snapshot, sink);
  }
  return ok({ text: sink.text(), truncated: sink.truncated, entityCount: sink.entityCount });
}

function createSink(maxChars: number): LineSink {
  const lines: string[] = [];
  const encoder = new TextEncoder();
  let bytes = 0;
  const sink: LineSink = {
    truncated: false,
    entityCount: 0,
    push(line) {
      if (sink.truncated) {
        return false;
      }
      const extra = encoder.encode(line).byteLength + (lines.length === 0 ? 0 : 1);
      if (bytes + extra > maxChars) {
        sink.truncated = true;
        return false;
      }
      lines.push(line);
      bytes += extra;
      return true;
    },
    text() {
      return lines.join("\n");
    },
  };
  return sink;
}

function headerLine(snapshot: Document, index: EntityIndex): string {
  const entityCount = Object.keys(snapshot.entities).length;
  const assetCount = Object.keys(snapshot.assets).length;
  const camera =
    snapshot.settings.mainCamera === null
      ? "none"
      : (index.pathOf(snapshot.settings.mainCamera) ?? snapshot.settings.mainCamera);
  return `scene "${snapshot.meta.name}" · ${String(entityCount)} entities · ${String(assetCount)} assets · ${formatEnvironment(snapshot.environment)} · main camera: ${camera}`;
}

function formatEnvironment(environment: Environment): string {
  const sky = environment.sky;
  let skyText = "env none";
  if (sky.kind === "color") {
    skyText = `env color:${sky.color}`;
  } else if (sky.kind === "environment") {
    skyText = `env hdri:${sky.asset}`;
  }
  return `${skyText} exposure ${trimNum(environment.exposure.toFixed(2))} tonemap ${environment.toneMapping}`;
}

interface EntityIndex {
  children(parent: string | null): readonly Entity[];
  pathOf(id: string): string | undefined;
}

function indexEntities(snapshot: Document): EntityIndex {
  const byParent = new Map<string | null, Entity[]>();
  for (const entity of Object.values(snapshot.entities)) {
    const existing = byParent.get(entity.parent);
    if (existing === undefined) {
      byParent.set(entity.parent, [entity]);
    } else {
      existing.push(entity);
    }
  }
  for (const list of byParent.values()) {
    list.sort((left, right) => (left.order < right.order ? -1 : left.order > right.order ? 1 : 0));
  }
  return {
    children(parent) {
      return byParent.get(parent) ?? [];
    },
    pathOf(id) {
      const parts: string[] = [];
      let current: string | null = id;
      const visiting = new Set<string>();
      while (current !== null) {
        if (visiting.has(current)) {
          break;
        }
        visiting.add(current);
        const entity: Entity | undefined = snapshot.entities[current];
        if (entity === undefined) {
          return undefined;
        }
        parts.unshift(entity.name);
        current = entity.parent;
      }
      return `/${parts.join("/")}`;
    },
  };
}

function walkChildren(
  index: EntityIndex,
  snapshot: Document,
  parent: string | null,
  prefix: string,
  depth: number,
  maxDepth: number,
  detail: "summary" | "outline" | "full",
  sink: LineSink,
): void {
  const kids = index.children(parent);
  for (let i = 0; i < kids.length; i += 1) {
    const child = kids[i];
    if (child === undefined) {
      continue;
    }
    const isLast = i === kids.length - 1;
    const remaining = kids.length - i;
    const before = sink.entityCount;
    emitEntity(index, snapshot, child, prefix, isLast, depth, maxDepth, detail, sink);
    if (sink.truncated && remaining > 1 && sink.entityCount === before) {
      const hintParent = parent === null ? "/" : (index.pathOf(parent) ?? "/");
      sink.push(
        `${prefix}└─ … +${String(remaining)} more (use scene.describe root=${hintParent} for all)`,
      );
      return;
    }
    if (sink.truncated) {
      const leftover = kids.length - i - 1;
      if (leftover > 0) {
        const hintParent = parent === null ? "/" : (index.pathOf(parent) ?? "/");
        sink.push(
          `${prefix}${isLast ? "   " : "│  "}└─ … +${String(leftover)} more (use scene.describe root=${hintParent} for all)`,
        );
      }
      return;
    }
  }
}

function emitEntity(
  index: EntityIndex,
  snapshot: Document,
  entity: Entity,
  prefix: string,
  isLast: boolean,
  depth: number,
  maxDepth: number,
  detail: "summary" | "outline" | "full",
  sink: LineSink,
): void {
  const branch = isLast ? "└─ " : "├─ ";
  if (!sink.push(`${prefix}${branch}${formatEntity(entity, snapshot, index, detail, depth)}`)) {
    return;
  }
  sink.entityCount += 1;
  if (depth >= maxDepth) {
    return;
  }
  const childPrefix = `${prefix}${isLast ? "   " : "│  "}`;
  walkChildren(index, snapshot, entity.id, childPrefix, depth + 1, maxDepth, detail, sink);
}

function formatEntity(
  entity: Entity,
  snapshot: Document,
  index: EntityIndex,
  detail: "summary" | "outline" | "full",
  depth: number,
): string {
  const bits: string[] = [`${entity.name} [${entity.id}]`];
  const mesh = entity.components.meshRenderer;
  const light = entity.components.light;
  const camera = entity.components.camera;
  if (mesh !== undefined) {
    bits.push(formatMesh(mesh.geometry, mesh.materials, snapshot));
  }
  if (light !== undefined) {
    bits.push(formatLight(light));
  }
  if (camera !== undefined) {
    const proj = camera.type === "orthographic" ? "ortho" : "persp";
    bits.push(`camera ${proj} fov${trimNum(camera.fov.toFixed(2))}`);
  }
  if (mesh === undefined && light === undefined && camera === undefined) {
    const childCount = index.children(entity.id).length;
    bits.push(childCount > 0 ? `group (${String(childCount)} children)` : "group");
  }
  const transform = entity.components.transform;
  if (!isZero(transform.position)) {
    bits.push(`@${formatVec(transform.position, 2)}`);
  }
  if (!isZero(transform.rotation)) {
    bits.push(`rot ${formatVec(transform.rotation, 2)}`);
  }
  if (!isUnitScale(transform.scale)) {
    const uniform =
      transform.scale[0] === transform.scale[1] && transform.scale[1] === transform.scale[2];
    bits.push(
      uniform
        ? `scale ${trimNum(transform.scale[0].toFixed(1))}`
        : `scale ${formatVec(transform.scale, 1)}`,
    );
  }
  if (detail === "outline" && depth <= 2 && mesh !== undefined) {
    const geom: Asset | undefined = snapshot.assets[mesh.geometry];
    if (geom !== undefined && geom.kind === "geometry") {
      bits.push(`bounds ${formatSize(geom.bounds.max, geom.bounds.min)}`);
    }
  }
  const tags = entity.components.tags;
  if (tags !== undefined && tags.length > 0) {
    bits.push(`tags:${tags.join(",")}`);
  }
  if (detail === "full") {
    bits.push(formatFull(entity));
  }
  return bits.join(" ");
}

function formatMesh(geometryId: string, materials: readonly string[], snapshot: Document): string {
  const geom: Asset | undefined = snapshot.assets[geometryId];
  const geomName = geom === undefined ? geometryId : geom.name;
  let text = `mesh ${geomName}(${geometryId})`;
  if (geom !== undefined && geom.kind === "geometry" && geom.source.kind === "primitive") {
    text += ` ${formatPrimitive(geom.source.primitive)}`;
  }
  if (materials.length > 0) {
    const names = materials.map((id) => {
      const asset: Asset | undefined = snapshot.assets[id];
      return asset === undefined ? id : asset.name;
    });
    text += ` mat:${names.join(",")}`;
  }
  return text;
}

function formatPrimitive(primitive: Primitive): string {
  if (primitive.type === "box") {
    return `box ${formatSize3(primitive.size)}`;
  }
  if (primitive.type === "plane") {
    return `plane ${trimNum(primitive.size[0].toFixed(2))}\u00d7${trimNum(primitive.size[1].toFixed(2))}`;
  }
  if (primitive.type === "sphere") {
    return `sphere r${trimNum(primitive.radius.toFixed(2))}`;
  }
  if (primitive.type === "torus") {
    return `torus r${trimNum(primitive.radius.toFixed(2))}`;
  }
  if (primitive.type === "cylinder" || primitive.type === "cone" || primitive.type === "capsule") {
    const radius =
      primitive.type === "cylinder"
        ? Math.max(primitive.radiusTop, primitive.radiusBottom)
        : primitive.radius;
    return `${primitive.type} r${trimNum(radius.toFixed(2))} h${trimNum(primitive.height.toFixed(2))}`;
  }
  return "primitive";
}

function formatLight(light: Light): string {
  const unit = light.type === "directional" ? "lx" : light.type === "area" ? "nt" : "cd";
  const shadow = light.castShadow ? " shadows" : "";
  return `light ${light.type} ${trimNum(light.intensity.toFixed(2))}${unit} ${light.color}${shadow}`;
}

function formatFull(entity: Entity): string {
  const parts: string[] = [];
  flatten("components", entity.components, parts);
  return parts.join(" ");
}

function flatten(path: string, value: unknown, parts: string[]): void {
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    parts.push(`${path}=${String(value)}`);
    return;
  }
  if (Array.isArray(value)) {
    parts.push(`${path}=${value.join(",")}`);
    return;
  }
  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      flatten(`${path}.${key}`, nested, parts);
    }
  }
}

function appendAssets(snapshot: Document, sink: LineSink): void {
  const assets = Object.values(snapshot.assets);
  if (assets.length === 0) {
    return;
  }
  if (!sink.push("assets")) {
    return;
  }
  for (const asset of assets) {
    if (!sink.push(`- ${asset.kind} ${asset.name} [${asset.id}]`)) {
      return;
    }
  }
}

function formatVec(vec: readonly [number, number, number], decimals: number): string {
  return `${trimNum(vec[0].toFixed(decimals))},${trimNum(vec[1].toFixed(decimals))},${trimNum(vec[2].toFixed(decimals))}`;
}

function formatSize3(size: readonly [number, number, number]): string {
  return `${trimNum(size[0].toFixed(2))}\u00d7${trimNum(size[1].toFixed(2))}\u00d7${trimNum(size[2].toFixed(2))}`;
}

function formatSize(
  max: readonly [number, number, number],
  min: readonly [number, number, number],
): string {
  return formatSize3([max[0] - min[0], max[1] - min[1], max[2] - min[2]]);
}

function isZero(vec: readonly [number, number, number]): boolean {
  return vec[0] === 0 && vec[1] === 0 && vec[2] === 0;
}

function isUnitScale(vec: readonly [number, number, number]): boolean {
  return vec[0] === 1 && vec[1] === 1 && vec[2] === 1;
}

function trimNum(value: string): string {
  if (!value.includes(".")) {
    return value;
  }
  return value.replace(/\.?0+$/, "");
}
