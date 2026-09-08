import type { ErrorCode } from "@tessera/std";
import { RESERVED_COMPONENT_NAMES } from "./components/reserved.js";
import type { Document } from "./document.js";
import { DocumentSchema } from "./document.js";
import type { Entity } from "./entity.js";

export type DocumentInvariant =
  | "INV-DOC-01"
  | "INV-DOC-02"
  | "INV-DOC-03"
  | "INV-DOC-04"
  | "INV-DOC-05"
  | "INV-DOC-06"
  | "INV-DOC-07";

export interface ValidationIssue {
  readonly invariant?: DocumentInvariant;
  readonly code: ErrorCode;
  readonly message: string;
  readonly path: string;
  readonly level: 1 | 2 | 3;
  readonly severity: "error";
}

export interface ValidationReport {
  readonly ok: boolean;
  readonly issues: readonly ValidationIssue[];
}

function issue(
  partial: Omit<ValidationIssue, "severity"> & { readonly invariant?: DocumentInvariant },
): ValidationIssue {
  return { severity: "error", ...partial };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function field(record: Record<string, unknown>, name: string): unknown {
  return record[name];
}

function collectReserved(raw: unknown, issues: ValidationIssue[]): void {
  const reserved = new Set<string>(RESERVED_COMPONENT_NAMES);
  if (!isRecord(raw)) {
    return;
  }
  const entities = field(raw, "entities");
  if (!isRecord(entities)) {
    return;
  }
  for (const [entityId, entity] of Object.entries(entities)) {
    if (!isRecord(entity)) {
      continue;
    }
    const components = field(entity, "components");
    if (!isRecord(components)) {
      continue;
    }
    for (const key of Object.keys(components)) {
      if (reserved.has(key)) {
        issues.push(
          issue({
            code: "UNSUPPORTED",
            message: `reserved component '${key}'`,
            path: `entities.${entityId}.components.${key}`,
            level: 1,
          }),
        );
      }
    }
  }
}

function collectIds(doc: Document, issues: ValidationIssue[]): void {
  const seen = new Map<string, string>();
  const remember = (id: string, path: string): void => {
    const existing = seen.get(id);
    if (existing !== undefined) {
      issues.push(
        issue({
          invariant: "INV-DOC-01",
          code: "CONFLICT",
          message: `id '${id}' reused (${existing})`,
          path,
          level: 3,
        }),
      );
      return;
    }
    seen.set(id, path);
  };
  remember(doc.meta.id, "meta.id");
  for (const [key, entity] of Object.entries(doc.entities)) {
    remember(key, `entities.${key}`);
    if (entity.id !== key) {
      remember(entity.id, `entities.${key}.id`);
    }
  }
  for (const [key, asset] of Object.entries(doc.assets)) {
    remember(key, `assets.${key}`);
    if (asset.id !== key) {
      remember(asset.id, `assets.${key}.id`);
    }
  }
  for (const [key, behavior] of Object.entries(doc.behaviors)) {
    remember(key, `behaviors.${key}`);
    if (behavior.id !== key) {
      remember(behavior.id, `behaviors.${key}.id`);
    }
  }
}

function parentDepth(
  entityId: string,
  entities: Document["entities"],
): number | "cycle" | "missing" {
  const visiting = new Set<string>();
  let current: string | null = entityId;
  let depth = 0;
  while (current !== null) {
    if (visiting.has(current)) {
      return "cycle";
    }
    const entity: Entity | undefined = entities[current];
    if (entity === undefined) {
      return "missing";
    }
    visiting.add(current);
    current = entity.parent;
    depth += 1;
    if (depth > 64) {
      return 65;
    }
  }
  return depth;
}

function collectStructure(doc: Document, issues: ValidationIssue[]): void {
  for (const [id, entity] of Object.entries(doc.entities)) {
    if (entity.components.transform === undefined) {
      issues.push(
        issue({
          invariant: "INV-DOC-04",
          code: "INVALID_INPUT",
          message: "transform is required",
          path: `entities.${id}.components.transform`,
          level: 1,
        }),
      );
    }
    if (entity.components.rigidBody !== undefined && entity.components.collider === undefined) {
      issues.push(
        issue({
          invariant: "INV-DOC-05",
          code: "INVALID_INPUT",
          message: "rigidBody requires collider",
          path: `entities.${id}.components.rigidBody`,
          level: 3,
        }),
      );
    }
    const collider = entity.components.collider;
    if (
      collider !== undefined &&
      (collider.shape === "convex" || collider.shape === "mesh") &&
      entity.components.meshRenderer === undefined
    ) {
      issues.push(
        issue({
          code: "INVALID_INPUT",
          message: "convex/mesh collider requires meshRenderer",
          path: `entities.${id}.components.collider`,
          level: 3,
        }),
      );
    }
    if (entity.parent !== null && doc.entities[entity.parent] === undefined) {
      issues.push(
        issue({
          invariant: "INV-DOC-02",
          code: "NOT_FOUND",
          message: "parent does not exist",
          path: `entities.${id}.parent`,
          level: 2,
        }),
      );
    }
    const depth = parentDepth(id, doc.entities);
    if (depth === "cycle") {
      issues.push(
        issue({
          invariant: "INV-DOC-03",
          code: "CONFLICT",
          message: "parent cycle",
          path: `entities.${id}.parent`,
          level: 3,
        }),
      );
    } else if (depth === 65) {
      issues.push(
        issue({
          code: "INVALID_INPUT",
          message: "hierarchy depth exceeds 64",
          path: `entities.${id}`,
          level: 3,
        }),
      );
    }
  }

  const siblings = new Map<string, string[]>();
  for (const entity of Object.values(doc.entities)) {
    const key = entity.parent ?? "";
    const names = siblings.get(key) ?? [];
    names.push(entity.name);
    siblings.set(key, names);
  }
  for (const [parent, names] of siblings) {
    const seen = new Map<string, number>();
    for (const name of names) {
      const folded = name.toLowerCase();
      const count = seen.get(folded) ?? 0;
      seen.set(folded, count + 1);
      if (count >= 1) {
        issues.push(
          issue({
            invariant: "INV-DOC-07",
            code: "CONFLICT",
            message: `duplicate sibling name '${name}'`,
            path: parent === "" ? "entities" : `entities.${parent}`,
            level: 3,
          }),
        );
      }
    }
  }

  const assetsByKind = new Map<string, string[]>();
  for (const asset of Object.values(doc.assets)) {
    const names = assetsByKind.get(asset.kind) ?? [];
    names.push(asset.name);
    assetsByKind.set(asset.kind, names);
  }
  for (const [kind, names] of assetsByKind) {
    const seen = new Map<string, number>();
    for (const name of names) {
      const folded = name.toLowerCase();
      const count = seen.get(folded) ?? 0;
      seen.set(folded, count + 1);
      if (count >= 1) {
        issues.push(
          issue({
            invariant: "INV-DOC-07",
            code: "CONFLICT",
            message: `duplicate ${kind} asset name '${name}'`,
            path: "assets",
            level: 3,
          }),
        );
      }
    }
  }
}

function expectAsset(
  doc: Document,
  id: string,
  kind: string,
  path: string,
  issues: ValidationIssue[],
): void {
  const asset = doc.assets[id];
  if (asset === undefined || asset.kind !== kind) {
    issues.push(
      issue({
        invariant: "INV-DOC-06",
        code: "NOT_FOUND",
        message: `asset '${id}' must exist with kind '${kind}'`,
        path,
        level: 2,
      }),
    );
  }
}

function collectRefs(doc: Document, issues: ValidationIssue[]): void {
  if (doc.settings.mainCamera !== null) {
    const camera = doc.entities[doc.settings.mainCamera];
    if (camera === undefined || camera.components.camera === undefined) {
      issues.push(
        issue({
          invariant: "INV-DOC-06",
          code: "NOT_FOUND",
          message: "mainCamera must reference an entity with a camera component",
          path: "settings.mainCamera",
          level: 2,
        }),
      );
    }
  }
  if (doc.environment.sky.kind === "environment") {
    expectAsset(doc, doc.environment.sky.asset, "environment", "environment.sky.asset", issues);
  }
  for (const [id, entity] of Object.entries(doc.entities)) {
    const mesh = entity.components.meshRenderer;
    if (mesh !== undefined) {
      expectAsset(
        doc,
        mesh.geometry,
        "geometry",
        `entities.${id}.components.meshRenderer.geometry`,
        issues,
      );
      for (const [index, material] of mesh.materials.entries()) {
        expectAsset(
          doc,
          material,
          "material",
          `entities.${id}.components.meshRenderer.materials.${String(index)}`,
          issues,
        );
      }
    }
  }
  for (const [id, asset] of Object.entries(doc.assets)) {
    if (asset.kind === "material") {
      const slots = [
        asset.baseColorTexture,
        asset.metallicRoughnessTexture,
        asset.normalTexture,
        asset.occlusionTexture,
        asset.emissiveTexture,
      ];
      for (const [index, slot] of slots.entries()) {
        if (slot !== undefined) {
          expectAsset(
            doc,
            slot.texture,
            "texture",
            `assets.${id}.textures.${String(index)}`,
            issues,
          );
        }
      }
    }
    if (asset.kind === "geometry" && asset.source.kind === "procedural") {
      expectAsset(doc, asset.source.script, "script", `assets.${id}.source.script`, issues);
    }
  }
  for (const [id, behavior] of Object.entries(doc.behaviors)) {
    if (doc.entities[behavior.target] === undefined) {
      issues.push(
        issue({
          invariant: "INV-DOC-06",
          code: "NOT_FOUND",
          message: "behavior target does not exist",
          path: `behaviors.${id}.target`,
          level: 2,
        }),
      );
    }
    expectAsset(doc, behavior.script, "script", `behaviors.${id}.script`, issues);
  }
}

/**
 * Runs schema, referential, and structural validation (`03` §12 levels 1–3).
 *
 * @public
 */
export function validateDocument(input: unknown): ValidationReport {
  const issues: ValidationIssue[] = [];
  collectReserved(input, issues);
  const parsed = DocumentSchema.safeParse(input);
  if (!parsed.success) {
    for (const item of parsed.error.issues) {
      const path = item.path.join(".");
      const missingTransform = path.endsWith("components.transform") || path.endsWith("transform");
      if (missingTransform) {
        issues.push(
          issue({
            invariant: "INV-DOC-04",
            code: "INVALID_INPUT",
            message: item.message,
            path,
            level: 1,
          }),
        );
      } else {
        issues.push(
          issue({
            code: "INVALID_INPUT",
            message: item.message,
            path,
            level: 1,
          }),
        );
      }
    }
    return { ok: issues.length === 0, issues };
  }
  collectIds(parsed.data, issues);
  collectStructure(parsed.data, issues);
  collectRefs(parsed.data, issues);
  return { ok: issues.length === 0, issues };
}
