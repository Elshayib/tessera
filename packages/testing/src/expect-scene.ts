import type { Aabb, Asset, Document, Entity, MaterialAsset } from "@tessera/schema";
/**
 * One hard eval assertion (`13` §5.1).
 *
 * @public
 */
export interface Assertion {
  readonly name: string;
  readonly pass: boolean;
  readonly detail?: string;
  readonly weight?: number;
}

/**
 * Scene assertion helpers (`13` §5.3).
 *
 * @example
 * ```ts
 * expectScene(doc).toHaveEntity("cube*");
 * ```
 *
 * @public
 */
export function expectScene(doc: Document, before?: Document): SceneExpect {
  return new SceneExpectImpl(doc, before);
}

/**
 * Fluent assertions over a document snapshot (`13` §5.3).
 *
 * @public
 */
export interface SceneExpect {
  toHaveEntity(pathOrGlob: string): Assertion;
  toHaveCount(query: string, n: number): Assertion;
  toBeOnGround(path: string, tolerance?: number): Assertion;
  toNotOverlap(paths: readonly string[]): Assertion;
  toBeWithin(pathA: string, pathB: string, meters: number): Assertion;
  toFace(pathA: string, pathB: string, toleranceDeg: number): Assertion;
  toHaveMaterial(
    path: string,
    fields: {
      readonly baseColorNear?: string;
      readonly roughnessBetween?: readonly [number, number];
      readonly metallicBetween?: readonly [number, number];
    },
  ): Assertion;
  toHaveLight(
    query: string,
    fields: {
      readonly type?: string;
      readonly colorTemperatureBetween?: readonly [number, number];
      readonly intensityBetween?: readonly [number, number];
    },
  ): Assertion;
  toHaveMainCamera(options: { readonly framesAll: true }): Assertion;
  toBeUnchanged(paths: readonly string[]): Assertion;
  toHaveNoIssues(
    check: (reader: SceneReader, ids: readonly string[]) => { readonly issues: readonly unknown[] },
  ): Assertion;
  toHaveTransactionsOnlyBy(
    authorKind: string,
    transactions: readonly { readonly author: { readonly kind: string } }[],
  ): Assertion;
}

class SceneExpectImpl implements SceneExpect {
  private readonly doc: Document;
  private readonly before: Document | undefined;
  private readonly reader: SceneReader;

  constructor(doc: Document, before: Document | undefined) {
    this.doc = doc;
    this.before = before;
    this.reader = readerFromDocument(doc);
  }

  toHaveEntity(pathOrGlob: string): Assertion {
    const hits = findEntities(this.doc, pathOrGlob);
    return assertion(`toHaveEntity ${pathOrGlob}`, hits.length > 0);
  }

  toHaveCount(query: string, n: number): Assertion {
    const hits = findEntities(this.doc, query);
    return assertion(`toHaveCount ${query} = ${String(n)}`, hits.length === n);
  }

  toBeOnGround(path: string, tolerance = 1e-6): Assertion {
    const hits = findEntities(this.doc, path);
    const pass =
      hits.length > 0 &&
      hits.every((entity) => {
        const box = translatedAabb(this.doc, entity);
        return Math.abs(box.min[1]) <= tolerance;
      });
    return assertion(`toBeOnGround ${path}`, pass);
  }

  toNotOverlap(paths: readonly string[]): Assertion {
    const groups = paths.map((path) => findEntities(this.doc, path));
    let pass = groups.every((group) => group.length > 0);
    for (let i = 0; i < groups.length; i += 1) {
      for (let j = i + 1; j < groups.length; j += 1) {
        const a = groups[i];
        const b = groups[j];
        if (a === undefined || b === undefined) {
          pass = false;
          continue;
        }
        for (const left of a) {
          for (const right of b) {
            if (left.id === right.id) {
              continue;
            }
            if (aabbOverlaps(translatedAabb(this.doc, left), translatedAabb(this.doc, right))) {
              pass = false;
            }
          }
        }
      }
    }
    return assertion("toNotOverlap", pass);
  }

  toBeWithin(pathA: string, pathB: string, meters: number): Assertion {
    const a = findEntities(this.doc, pathA)[0];
    const b = findEntities(this.doc, pathB)[0];
    if (a === undefined || b === undefined) {
      return assertion(`toBeWithin ${pathA} ${pathB}`, false);
    }
    const gap = aabbGap(translatedAabb(this.doc, a), translatedAabb(this.doc, b));
    return assertion(`toBeWithin ${pathA} ${pathB}`, gap <= meters);
  }

  toFace(pathA: string, pathB: string, toleranceDeg: number): Assertion {
    const a = findEntities(this.doc, pathA)[0];
    const b = findEntities(this.doc, pathB)[0];
    if (a === undefined || b === undefined) {
      return assertion(`toFace ${pathA} ${pathB}`, false);
    }
    const from = translatedAabb(this.doc, a);
    const to = translatedAabb(this.doc, b);
    const dx = (to.min[0] + to.max[0]) / 2 - (from.min[0] + from.max[0]) / 2;
    const dz = (to.min[2] + to.max[2]) / 2 - (from.min[2] + from.max[2]) / 2;
    const yaw = (a.components.transform.rotation[1] * Math.PI) / 180;
    const facingX = -Math.sin(yaw);
    const facingZ = -Math.cos(yaw);
    const angle = angleDeg(facingX, facingZ, dx, dz);
    return assertion(`toFace ${pathA} ${pathB}`, angle <= toleranceDeg);
  }

  toHaveMaterial(
    path: string,
    fields: {
      readonly baseColorNear?: string;
      readonly roughnessBetween?: readonly [number, number];
      readonly metallicBetween?: readonly [number, number];
    },
  ): Assertion {
    const entity = findEntities(this.doc, path)[0];
    const material = materialOf(this.doc, entity);
    if (material === undefined) {
      return assertion(`toHaveMaterial ${path}`, false);
    }
    let pass = true;
    if (fields.baseColorNear !== undefined) {
      pass = pass && colorsNear(material.baseColor, fields.baseColorNear);
    }
    if (fields.roughnessBetween !== undefined) {
      pass =
        pass &&
        material.roughness >= fields.roughnessBetween[0] &&
        material.roughness <= fields.roughnessBetween[1];
    }
    if (fields.metallicBetween !== undefined) {
      pass =
        pass &&
        material.metallic >= fields.metallicBetween[0] &&
        material.metallic <= fields.metallicBetween[1];
    }
    return assertion(`toHaveMaterial ${path}`, pass);
  }

  toHaveLight(
    query: string,
    fields: {
      readonly type?: string;
      readonly colorTemperatureBetween?: readonly [number, number];
      readonly intensityBetween?: readonly [number, number];
    },
  ): Assertion {
    const lights = findEntities(this.doc, query).filter(
      (entity) => entity.components.light !== undefined,
    );
    const pass = lights.some((entity) => {
      const light = entity.components.light;
      if (light === undefined) {
        return false;
      }
      if (fields.type !== undefined && light.type !== fields.type) {
        return false;
      }
      if (fields.intensityBetween !== undefined) {
        if (
          light.intensity < fields.intensityBetween[0] ||
          light.intensity > fields.intensityBetween[1]
        ) {
          return false;
        }
      }
      if (fields.colorTemperatureBetween !== undefined) {
        const kelvin = approxKelvin(light.color);
        if (
          kelvin < fields.colorTemperatureBetween[0] ||
          kelvin > fields.colorTemperatureBetween[1]
        ) {
          return false;
        }
      }
      return true;
    });
    return assertion(`toHaveLight ${query}`, pass);
  }

  toHaveMainCamera(options: { readonly framesAll: true }): Assertion {
    void options;
    const id = this.doc.settings.mainCamera;
    if (id === null) {
      return assertion("toHaveMainCamera", false);
    }
    const camera = this.doc.entities[id];
    return assertion(
      "toHaveMainCamera",
      camera !== undefined && camera.components.camera !== undefined,
    );
  }

  toBeUnchanged(paths: readonly string[]): Assertion {
    const previousDoc = this.before;
    if (previousDoc === undefined) {
      return assertion("toBeUnchanged", false);
    }
    const pass = paths.every((path) => {
      const afterHits = findEntities(this.doc, path);
      const beforeHits = findEntities(previousDoc, path);
      if (afterHits.length !== beforeHits.length) {
        return false;
      }
      return afterHits.every((entity, index) => {
        const previous = beforeHits[index];
        return (
          previous !== undefined &&
          JSON.stringify(entity.components) === JSON.stringify(previous.components)
        );
      });
    });
    return assertion("toBeUnchanged", pass);
  }

  toHaveNoIssues(
    check: (reader: SceneReader, ids: readonly string[]) => { readonly issues: readonly unknown[] },
  ): Assertion {
    const ids = [...this.reader.entities()].map((entity) => entity.id);
    const result = check(this.reader, ids);
    return assertion("toHaveNoIssues", result.issues.length === 0);
  }

  toHaveTransactionsOnlyBy(
    authorKind: string,
    transactions: readonly { readonly author: { readonly kind: string } }[],
  ): Assertion {
    const pass = transactions.every((row) => row.author.kind === authorKind);
    return assertion(`toHaveTransactionsOnlyBy ${authorKind}`, pass);
  }
}

function assertion(name: string, pass: boolean): Assertion {
  return { name, pass, weight: 1 };
}

interface SceneReader {
  getEntity(id: string): Entity | undefined;
  getAsset(id: string): Asset | undefined;
  parentChain(id: string): readonly Entity[];
  entities(): Iterable<Entity>;
  pathOf(id: string): string | undefined;
}

function translatedAabb(doc: Document, entity: Entity): Aabb {
  const mesh = entity.components.meshRenderer;
  const origin: Aabb = { min: [0, 0, 0], max: [0, 0, 0] };
  if (mesh === undefined) {
    return origin;
  }
  const asset = doc.assets[mesh.geometry];
  if (asset === undefined || asset.kind !== "geometry") {
    return origin;
  }
  const pos = entity.components.transform.position;
  return {
    min: [asset.bounds.min[0] + pos[0], asset.bounds.min[1] + pos[1], asset.bounds.min[2] + pos[2]],
    max: [asset.bounds.max[0] + pos[0], asset.bounds.max[1] + pos[1], asset.bounds.max[2] + pos[2]],
  };
}

function aabbOverlaps(a: Aabb, b: Aabb): boolean {
  return (
    a.min[0] <= b.max[0] &&
    a.max[0] >= b.min[0] &&
    a.min[1] <= b.max[1] &&
    a.max[1] >= b.min[1] &&
    a.min[2] <= b.max[2] &&
    a.max[2] >= b.min[2]
  );
}

function aabbGap(a: Aabb, b: Aabb): number {
  const dx = Math.max(0, a.min[0] - b.max[0], b.min[0] - a.max[0]);
  const dy = Math.max(0, a.min[1] - b.max[1], b.min[1] - a.max[1]);
  const dz = Math.max(0, a.min[2] - b.max[2], b.min[2] - a.max[2]);
  return Math.hypot(dx, dy, dz);
}

function readerFromDocument(doc: Document): SceneReader {
  return {
    getEntity: (id) => doc.entities[id],
    getAsset: (id) => doc.assets[id],
    parentChain(id) {
      const chain: Entity[] = [];
      let current = doc.entities[id];
      while (current !== undefined && current.parent !== null) {
        const parent = doc.entities[current.parent];
        if (parent === undefined) {
          break;
        }
        chain.push(parent);
        current = parent;
      }
      return chain;
    },
    entities() {
      return Object.values(doc.entities);
    },
    pathOf(id) {
      const entity = doc.entities[id];
      if (entity === undefined) {
        return undefined;
      }
      const names = [entity.name];
      let current = entity;
      while (current.parent !== null) {
        const parent = doc.entities[current.parent];
        if (parent === undefined) {
          break;
        }
        names.unshift(parent.name);
        current = parent;
      }
      return names.join("/");
    },
  };
}

function findEntities(doc: Document, pathOrGlob: string): readonly Entity[] {
  const out: Entity[] = [];
  for (const entity of Object.values(doc.entities)) {
    const path = entityPath(doc, entity);
    if (globMatch(entity.name, pathOrGlob) || globMatch(path, pathOrGlob)) {
      out.push(entity);
    }
  }
  return out;
}

function entityPath(doc: Document, entity: Entity): string {
  const names = [entity.name];
  let current = entity;
  while (current.parent !== null) {
    const parent = doc.entities[current.parent];
    if (parent === undefined) {
      break;
    }
    names.unshift(parent.name);
    current = parent;
  }
  return names.join("/");
}

function globMatch(name: string, glob: string): boolean {
  let pattern = "";
  for (const char of glob) {
    if (char === "*") {
      pattern += ".*";
    } else if (char === "?") {
      pattern += ".";
    } else {
      pattern += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${pattern}$`, "i").test(name);
}

function materialOf(doc: Document, entity: Entity | undefined): MaterialAsset | undefined {
  const ids = entity?.components.meshRenderer?.materials;
  const first = ids?.[0];
  if (first === undefined) {
    return undefined;
  }
  const asset = doc.assets[first];
  if (asset === undefined || asset.kind !== "material") {
    return undefined;
  }
  return asset;
}

function colorsNear(actual: string, expected: string): boolean {
  const a = parseHex(actual);
  const b = parseHex(expected);
  if (a === undefined || b === undefined) {
    return actual.toLowerCase() === expected.toLowerCase();
  }
  const dist = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  return dist <= 40;
}

function parseHex(hex: string): readonly [number, number, number] | undefined {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (match === null || match[1] === undefined) {
    return undefined;
  }
  const raw = match[1];
  return [
    Number.parseInt(raw.slice(0, 2), 16),
    Number.parseInt(raw.slice(2, 4), 16),
    Number.parseInt(raw.slice(4, 6), 16),
  ];
}

function approxKelvin(hex: string): number {
  const rgb = parseHex(hex);
  if (rgb === undefined) {
    return 6500;
  }
  const r = Math.max(rgb[0], 1);
  const b = rgb[2];
  if (r >= b) {
    return 2000 + (b / r) * 2500;
  }
  return 5500 + (r / Math.max(b, 1)) * 2000;
}

function angleDeg(ax: number, az: number, bx: number, bz: number): number {
  const la = Math.hypot(ax, az);
  const lb = Math.hypot(bx, bz);
  if (la < 1e-8 || lb < 1e-8) {
    return 180;
  }
  const cos = (ax * bx + az * bz) / (la * lb);
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
}
