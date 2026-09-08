import type { z } from "zod";
import { EnvironmentAssetSchema } from "./assets/environment.js";
import { GeometryAssetSchema } from "./assets/geometry.js";
import { MaterialAssetSchema } from "./assets/material.js";
import { ScriptAssetSchema } from "./assets/script.js";
import { TextureAssetSchema } from "./assets/texture.js";
import { CameraFieldsSchema } from "./components/camera.js";
import { ColliderSchema } from "./components/collider.js";
import { LightSchema } from "./components/light.js";
import { MeshRendererSchema } from "./components/mesh-renderer.js";
import { MetadataSchema } from "./components/metadata.js";
import { RigidBodySchema } from "./components/rigid-body.js";
import { TagsSchema } from "./components/tags.js";
import { TransformSchema } from "./components/transform.js";
import { INSPECTOR_WIDGETS, type InspectorFieldMeta } from "./inspector-field.js";

export type { InspectorAssetKind, InspectorFieldMeta, InspectorWidget } from "./inspector-field.js";
export { INSPECTOR_WIDGETS } from "./inspector-field.js";

const WIDGETS = new Set<string>(INSPECTOR_WIDGETS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function field(record: Record<string, unknown>, name: string): unknown {
  return record[name];
}

function isZodType(value: unknown): value is z.ZodType {
  if (!isRecord(value)) {
    return false;
  }
  return typeof field(value, "safeParse") === "function" && "def" in value;
}

function defField(schema: z.ZodType, name: string): unknown {
  const def: unknown = schema.def;
  if (!isRecord(def)) {
    return undefined;
  }
  return def[name];
}

function isInspectorMeta(value: unknown): value is InspectorFieldMeta {
  if (!isRecord(value)) {
    return false;
  }
  const label = field(value, "label");
  const widget = field(value, "widget");
  if (typeof label !== "string" || label.length === 0) {
    return false;
  }
  return typeof widget === "string" && WIDGETS.has(widget);
}

function hasInspectorMeta(schema: z.ZodType): boolean {
  const seen = new Set<z.ZodType>();
  let current: z.ZodType | undefined = schema;
  while (current !== undefined && !seen.has(current)) {
    seen.add(current);
    if (isInspectorMeta(current.meta())) {
      return true;
    }
    current = unwrapOnce(current);
  }
  return false;
}

function unwrapOnce(schema: z.ZodType): z.ZodType | undefined {
  const type = schema.def.type;
  if (type === "optional" || type === "nullable" || type === "default") {
    const inner = defField(schema, "innerType");
    return isZodType(inner) ? inner : undefined;
  }
  return undefined;
}

function unwrap(schema: z.ZodType): z.ZodType {
  const seen = new Set<z.ZodType>();
  let current = schema;
  let next = unwrapOnce(current);
  while (next !== undefined && !seen.has(current)) {
    seen.add(current);
    current = next;
    next = unwrapOnce(current);
  }
  return current;
}

function objectShape(schema: z.ZodType): Readonly<Record<string, z.ZodType>> | undefined {
  if (!("shape" in schema)) {
    return undefined;
  }
  const shape: unknown = schema.shape;
  if (!isRecord(shape)) {
    return undefined;
  }
  const result: Record<string, z.ZodType> = {};
  for (const [key, value] of Object.entries(shape)) {
    if (!isZodType(value)) {
      return undefined;
    }
    result[key] = value;
  }
  return result;
}

function unionOptions(schema: z.ZodType): readonly z.ZodType[] | undefined {
  if (schema.def.type !== "union") {
    return undefined;
  }
  const options = defField(schema, "options");
  const result: z.ZodType[] = [];
  for (const option of Array.isArray(options) ? options : []) {
    if (isZodType(option)) {
      result.push(option);
    }
  }
  return result;
}

function walk(schema: z.ZodType, path: string, missing: string[], seen: Set<z.ZodType>): void {
  if (seen.has(schema)) {
    return;
  }
  seen.add(schema);
  if (schema.def.type === "lazy") {
    return;
  }
  const core = unwrap(schema);
  const options = unionOptions(core);
  if (options !== undefined) {
    for (const [index, option] of options.entries()) {
      walk(option, `${path}[${String(index)}]`, missing, seen);
    }
    return;
  }
  const shape = objectShape(core);
  if (shape !== undefined) {
    for (const [key, fieldSchema] of Object.entries(shape)) {
      const fieldPath = path.length === 0 ? key : `${path}.${key}`;
      if (!hasInspectorMeta(fieldSchema)) {
        missing.push(fieldPath);
      }
      walk(fieldSchema, fieldPath, missing, seen);
    }
    return;
  }
  if (core.def.type === "array") {
    const element = defField(core, "element");
    if (isZodType(element)) {
      const inner = unwrap(element);
      if (objectShape(inner) !== undefined || unionOptions(inner) !== undefined) {
        walk(element, `${path}[]`, missing, seen);
      }
    }
  }
}

const INSPECTOR_SCHEMAS: readonly { readonly name: string; readonly schema: z.ZodType }[] = [
  { name: "transform", schema: TransformSchema },
  { name: "meshRenderer", schema: MeshRendererSchema },
  { name: "light", schema: LightSchema },
  { name: "camera", schema: CameraFieldsSchema },
  { name: "collider", schema: ColliderSchema },
  { name: "rigidBody", schema: RigidBodySchema },
  { name: "tags", schema: TagsSchema },
  { name: "metadata", schema: MetadataSchema },
  { name: "geometry", schema: GeometryAssetSchema },
  { name: "material", schema: MaterialAssetSchema },
  { name: "texture", schema: TextureAssetSchema },
  { name: "environmentAsset", schema: EnvironmentAssetSchema },
  { name: "script", schema: ScriptAssetSchema },
];

/**
 * Returns schema paths that lack inspector `.meta()` (`INV-DOC-09`).
 *
 * @example
 * ```ts
 * const missing = missingInspectorMeta();
 * ```
 */
export function inspectorGaps(schema: z.ZodType, name: string): readonly string[] {
  const missing: string[] = [];
  const core = unwrap(schema);
  if (objectShape(core) === undefined && unionOptions(core) === undefined) {
    if (!hasInspectorMeta(schema)) {
      missing.push(name);
    }
  }
  walk(schema, name, missing, new Set());
  return missing;
}

/**
 * Completeness check for every component and asset-kind schema.
 */
export function missingInspectorMeta(): readonly string[] {
  const missing: string[] = [];
  for (const entry of INSPECTOR_SCHEMAS) {
    missing.push(...inspectorGaps(entry.schema, entry.name));
  }
  return missing;
}
