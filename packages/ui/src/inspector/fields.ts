import type { InspectorFieldMeta } from "@tessera/schema";
import { INSPECTOR_WIDGETS, type InspectorWidget } from "@tessera/schema";

/**
 * Minimal Zod-shaped value used to walk inspector `.meta()`.
 *
 * @public
 */
export interface InspectorSchema {
  readonly def: { readonly type: string };
  meta(): unknown;
  safeParse(data: unknown): { readonly success: boolean };
  readonly shape?: unknown;
}

/**
 * One inspector-bound field from a component schema.
 *
 * @public
 */
export interface InspectorField {
  readonly key: string;
  readonly meta: InspectorFieldMeta;
  readonly widget: string;
  readonly enumValues: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function field(record: Record<string, unknown>, name: string): unknown {
  return record[name];
}

function isZodType(value: unknown): value is InspectorSchema {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof field(value, "safeParse") === "function" &&
    "def" in value &&
    typeof field(value, "meta") === "function"
  );
}

function defField(schema: InspectorSchema, name: string): unknown {
  const def: unknown = schema.def;
  if (!isRecord(def)) {
    return undefined;
  }
  return def[name];
}

function unwrapOnce(schema: InspectorSchema): InspectorSchema | undefined {
  const type = schema.def.type;
  if (type === "optional" || type === "nullable" || type === "default") {
    const inner = defField(schema, "innerType");
    return isZodType(inner) ? inner : undefined;
  }
  if (
    type === "object" ||
    type === "union" ||
    type === "enum" ||
    type === "array" ||
    type === "string" ||
    type === "number" ||
    type === "boolean" ||
    type === "literal"
  ) {
    return undefined;
  }
  for (const name of ["innerType", "schema", "in"]) {
    const inner = defField(schema, name);
    if (isZodType(inner) && inner !== schema) {
      return inner;
    }
  }
  return undefined;
}

function unwrap(schema: InspectorSchema): InspectorSchema {
  const seen = new Set<InspectorSchema>();
  let current = schema;
  let next = unwrapOnce(current);
  while (next !== undefined && !seen.has(current)) {
    seen.add(current);
    current = next;
    next = unwrapOnce(current);
  }
  return current;
}

function readMeta(schema: InspectorSchema): InspectorFieldMeta | undefined {
  const seen = new Set<InspectorSchema>();
  let current: InspectorSchema | undefined = schema;
  while (current !== undefined && !seen.has(current)) {
    seen.add(current);
    const meta: unknown = current.meta();
    if (
      isRecord(meta) &&
      typeof field(meta, "label") === "string" &&
      typeof field(meta, "widget") === "string"
    ) {
      const label = field(meta, "label");
      const widget = field(meta, "widget");
      if (typeof label === "string" && typeof widget === "string") {
        const unit = field(meta, "unit");
        const step = field(meta, "step");
        const group = field(meta, "group");
        const order = field(meta, "order");
        const description = field(meta, "description");
        return {
          label,
          widget: knownWidget(widget),
          ...(typeof unit === "string" ? { unit } : {}),
          ...(typeof step === "number" ? { step } : {}),
          ...(typeof group === "string" ? { group } : {}),
          ...(typeof order === "number" ? { order } : {}),
          ...(typeof description === "string" ? { description } : {}),
        };
      }
    }
    current = unwrapOnce(current);
  }
  return undefined;
}

function rawWidget(schema: InspectorSchema): string | undefined {
  const seen = new Set<InspectorSchema>();
  let current: InspectorSchema | undefined = schema;
  while (current !== undefined && !seen.has(current)) {
    seen.add(current);
    const meta: unknown = current.meta();
    if (isRecord(meta) && typeof field(meta, "widget") === "string") {
      const widget = field(meta, "widget");
      return typeof widget === "string" ? widget : undefined;
    }
    current = unwrapOnce(current);
  }
  return undefined;
}

function knownWidget(widget: string): InspectorWidget {
  for (const known of INSPECTOR_WIDGETS) {
    if (known === widget) {
      return known;
    }
  }
  return "json";
}

/**
 * Whether `widget` is a known inspector widget.
 *
 * @public
 */
export function isKnownWidget(widget: string): boolean {
  for (const known of INSPECTOR_WIDGETS) {
    if (known === widget) {
      return true;
    }
  }
  return false;
}

function enumValues(schema: InspectorSchema): readonly string[] {
  const core = unwrap(schema);
  if (core.def.type !== "enum") {
    return [];
  }
  const entries = defField(core, "entries");
  if (!isRecord(entries)) {
    return [];
  }
  return Object.keys(entries);
}

function objectShape(
  schema: InspectorSchema,
): Readonly<Record<string, InspectorSchema>> | undefined {
  if (!("shape" in schema)) {
    return undefined;
  }
  const shape: unknown = schema.shape;
  if (!isRecord(shape)) {
    return undefined;
  }
  const result: Record<string, InspectorSchema> = {};
  for (const [key, value] of Object.entries(shape)) {
    if (!isZodType(value)) {
      return undefined;
    }
    result[key] = value;
  }
  return result;
}

function unionOptions(schema: InspectorSchema): readonly InspectorSchema[] {
  if (schema.def.type !== "union") {
    return [];
  }
  const options = defField(schema, "options");
  const result: InspectorSchema[] = [];
  for (const option of Array.isArray(options) ? options : []) {
    if (isZodType(option)) {
      result.push(option);
    }
  }
  return result;
}

function pickUnionOption(schema: InspectorSchema, value: unknown): InspectorSchema | undefined {
  for (const option of unionOptions(schema)) {
    const parsed = option.safeParse(value);
    if (parsed.success) {
      return option;
    }
  }
  return unionOptions(schema)[0];
}

/**
 * Lists top-level inspector fields for a Zod object (or matching union option).
 *
 * @example
 * ```ts
 * const fields = listInspectorFields(TransformSchema);
 * ```
 *
 * @public
 */
export function listInspectorFields(
  schema: InspectorSchema,
  value?: unknown,
): readonly InspectorField[] {
  const core = unwrap(schema);
  const options = unionOptions(core);
  if (options.length > 0) {
    const chosen = value === undefined ? options[0] : pickUnionOption(core, value);
    if (chosen === undefined) {
      return [];
    }
    return listInspectorFields(chosen, value);
  }
  const shape = objectShape(core) ?? objectShape(schema);
  if (shape === undefined) {
    return [];
  }
  const fields: InspectorField[] = [];
  for (const [key, fieldSchema] of Object.entries(shape)) {
    const meta = readMeta(fieldSchema);
    if (meta === undefined) {
      continue;
    }
    fields.push({
      key,
      meta,
      widget: rawWidget(fieldSchema) ?? meta.widget,
      enumValues: enumValues(fieldSchema),
    });
  }
  fields.sort((left, right) => (left.meta.order ?? 0) - (right.meta.order ?? 0));
  return fields;
}
