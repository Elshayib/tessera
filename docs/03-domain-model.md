# 03 — Domain model (document schema v0.1)

Status: Accepted · Last updated: 2026-09-06 · Package: `@tessera/schema` (definitions), `@tessera/core` (storage) · Phase: 0–1

## 1. Purpose and scope

Defines the persistent data model of a Tessera project: the **document** and its **blobs**. Everything the editor, the agent, exporters and collaborators share is described here. Runtime state (three.js objects, selection, camera) is not part of the document (`02 §9`).

The schema is authored once in Zod 4 in `@tessera/schema` and is the single source of truth for: TypeScript types (`z.infer`), runtime validation, JSON Schema (for the MCP tool surface and docs), inspector UI metadata, and migrations (ADR-0006).

## 2. Conventions

| Topic | Rule |
| --- | --- |
| Units | Meters for length, seconds for time, degrees in the document for angles, kilograms for mass. |
| Axes | Right-handed, **Y-up**, −Z forward for cameras and lights (glTF convention). |
| Rotation | Euler angles in **degrees**, order **XYZ** (intrinsic, three.js `'XYZ'`), stored as `[x, y, z]`. Quaternions are an internal runtime representation only (ADR-0013). |
| Scale | Per-axis, positive. Negative scale is rejected (`INVALID_INPUT`); mirroring is a phase-7 modifier. |
| Colors | sRGB hex strings `#rrggbb` (lowercase) for colors that artists pick; scalar intensities are linear floats. |
| Light units | Physical: directional in lux, point and spot in candela, area (rect) in nits (ADR-0014). |
| Ids | Opaque strings: `e_` entity, `a_` asset, `b_` behavior, `p_` project. Generated with `newId(prefix)`; 10 chars from `[0-9a-z]` after the prefix. |
| Names | Human-readable, 1–64 chars, any Unicode letters/digits/space/`_-.()`; unique among siblings (see §4.3). |
| Paths | `/<name>/<name>/…` from the root; used by queries and tools to address entities. Names with `/` are rejected. |
| Numbers | IEEE doubles; serialized with JavaScript shortest round-trip formatting; no NaN/Infinity anywhere (`INVALID_INPUT`). |
| Time | ISO 8601 UTC strings (`createdAt`, `updatedAt`, `importedAt`). |

## 3. Document root

```ts
export interface Document {
  readonly version: string;                       // document format semver, currently "0.1.0"
  readonly meta: DocumentMeta;
  readonly settings: Settings;
  readonly entities: Readonly<Record<EntityId, Entity>>;
  readonly assets: Readonly<Record<AssetId, Asset>>;
  readonly environment: Environment;
  readonly behaviors: Readonly<Record<BehaviorId, Behavior>>;   // phase 7; empty until then
}

export interface DocumentMeta {
  readonly id: ProjectId;                          // "p_…"
  readonly name: string;                           // 1–120 chars
  readonly description?: string;                   // ≤ 2000 chars
  readonly createdAt: string;
  readonly updatedAt: string;                      // bumped by the command bus on every committed transaction
  readonly generator: string;                      // "tessera@<app version>"
}

export interface Settings {
  readonly units: 'm';                             // fixed in v0.1
  readonly up: 'Y';                                // fixed in v0.1
  readonly handedness: 'right';                    // fixed in v0.1
  readonly mainCamera: EntityId | null;            // entity with a camera component, or null
  readonly physics: { readonly gravity: readonly [number, number, number] };  // default [0, -9.81, 0]
}
```

## 4. Entities

```ts
export interface Entity {
  readonly id: EntityId;
  readonly name: string;
  readonly parent: EntityId | null;                // null = root level
  readonly order: string;                          // fractional index key among siblings (ADR-0003)
  readonly components: Components;                 // exactly one of each present type
  readonly enabled: boolean;                       // disabled entities render nothing and export as inactive
}

export interface Components {
  readonly transform: Transform;                   // mandatory on every entity
  readonly meshRenderer?: MeshRenderer;
  readonly light?: Light;
  readonly camera?: Camera;
  readonly collider?: Collider;
  readonly rigidBody?: RigidBody;
  readonly tags?: Tags;
  readonly metadata?: Metadata;
}
```

### 4.1 Hierarchy rules
- `parent` must reference an existing entity or be `null`. Cycles are rejected (`CONFLICT`, `INV-DOC-03`).
- Maximum depth 64 (`INVALID_INPUT` beyond).
- Sibling order is defined by `order` using the `fractional-indexing` scheme: string keys, lexicographically sorted, generated between neighbors. Ties are broken by id (deterministic).
- Deleting an entity deletes its subtree in the same transaction (`entity.delete` with `recursive: true` is the only mode in v0.1).

### 4.2 Component exclusivity
- An entity has at most one component of each type.
- `light` and `camera` are mutually exclusive with `meshRenderer`? **No** — allowed together (a lamp mesh with a point light child is more common, but same-entity is permitted). Exporters map to child nodes when the engine requires it.
- `rigidBody` requires `collider` (`INV-DOC-05`).

### 4.3 Naming
- Names are unique among siblings, case-insensitively. `entity.create` and `entity.rename` resolve collisions by appending `_01`, `_02`, … unless `strictName: true` is passed, in which case they return `CONFLICT`.
- The root path `/` is virtual. `resolvePath('/forest/oak_01')` returns the entity or `NOT_FOUND`.

## 5. Components (v0.1)

Defaults apply when a component is added without the field. Ranges are validated; violations return `INVALID_INPUT` with the field path.

### 5.1 `transform`
| Field | Type | Default | Constraints |
| --- | --- | --- | --- |
| `position` | `[x, y, z]` m | `[0,0,0]` | finite |
| `rotation` | `[x, y, z]` deg | `[0,0,0]` | finite; normalized to (−180, 180] on write |
| `scale` | `[x, y, z]` | `[1,1,1]` | each > 0 and finite |

### 5.2 `meshRenderer`
| Field | Type | Default | Constraints |
| --- | --- | --- | --- |
| `geometry` | `AssetId` | — | must reference an asset of kind `geometry` |
| `materials` | `AssetId[]` | `[]` | each references kind `material`; length ≤ 64. Slot *i* applies to primitive group *i*; missing slots use the last provided material; empty list uses the built-in default material |
| `castShadow` | boolean | `true` | |
| `receiveShadow` | boolean | `true` | |
| `visible` | boolean | `true` | invisible still exports; `enabled=false` on the entity does not export |

### 5.3 `light`
| Field | Type | Default | Constraints / notes |
| --- | --- | --- | --- |
| `type` | `'directional' \| 'point' \| 'spot' \| 'area'` | — | |
| `color` | hex | `#ffffff` | |
| `intensity` | number | directional `3` (lux), point `100` (cd), spot `200` (cd), area `5` (nits) | ≥ 0 |
| `range` | m | `0` (= infinite) | point/spot only; ≥ 0 |
| `angle` | deg | `30` | spot only; outer cone half-angle, (0, 90) |
| `penumbra` | 0–1 | `0.2` | spot only |
| `size` | `[w, h]` m | `[1, 1]` | area only; > 0 |
| `castShadow` | boolean | directional `true`, others `false` | area lights never cast shadows in v0.1 |

Direction: lights point down their local −Z, so a directional light with rotation `[-45, 30, 0]` is a typical sun.

### 5.4 `camera`
| Field | Type | Default | Constraints |
| --- | --- | --- | --- |
| `type` | `'perspective' \| 'orthographic'` | `'perspective'` | |
| `fov` | deg (vertical) | `50` | (1, 179) |
| `near` | m | `0.1` | > 0 |
| `far` | m | `1000` | > near |
| `orthoSize` | m (half height) | `5` | > 0 |

Aspect ratio is a viewport/export property, not stored.

### 5.5 `collider`
| Field | Type | Default | Constraints |
| --- | --- | --- | --- |
| `shape` | `'box' \| 'sphere' \| 'capsule' \| 'convex' \| 'mesh'` | `'box'` | `convex`/`mesh` require a `meshRenderer` on the same entity |
| `fit` | `'auto' \| 'manual'` | `'auto'` | `auto` derives size/radius from geometry bounds at export and for spatial checks |
| `size` | `[x, y, z]` m | `[1,1,1]` | box, manual |
| `radius` | m | `0.5` | sphere/capsule, manual |
| `height` | m | `1` | capsule, manual; total height including caps |
| `offset` | `[x, y, z]` m | `[0,0,0]` | local offset |
| `isTrigger` | boolean | `false` | |

### 5.6 `rigidBody`
| Field | Type | Default | Constraints |
| --- | --- | --- | --- |
| `type` | `'static' \| 'dynamic' \| 'kinematic'` | `'static'` | |
| `mass` | kg | `1` | > 0; ignored for static |
| `friction` | 0–1 | `0.5` | |
| `restitution` | 0–1 | `0` | |

### 5.7 `tags`
`readonly string[]`, each matching `^[a-z0-9][a-z0-9_-]{0,31}$`, unique, ≤ 32 per entity. Used by queries, exporters (engine layers/groups) and the agent.

### 5.8 `metadata`
`Readonly<Record<string, JsonValue>>` with ≤ 64 keys, keys ≤ 64 chars, total serialized size ≤ 16 KB. Exported verbatim to glTF `extras.tessera.metadata` and engine user data. Never interpreted by Tessera.

### 5.9 Reserved component names
`instance`, `lod`, `audio`, `text`, `particles`, `animation`, `terrain`, `splat`, `modifier`. The schema rejects them until the phase that defines them (`UNSUPPORTED`).

## 6. Assets

```ts
export type Asset = GeometryAsset | MaterialAsset | TextureAsset | EnvironmentAsset | ScriptAsset;

export interface AssetBase {
  readonly id: AssetId;
  readonly kind: 'geometry' | 'material' | 'texture' | 'environment' | 'script';
  readonly name: string;                            // unique per kind, case-insensitive; auto-suffixed like entities
  readonly license: License;                        // SPDX id, 'proprietary', or 'unknown'
  readonly provenance: Provenance;
  readonly createdAt: string;
  readonly tags?: readonly string[];
}

export type License = 'CC0-1.0' | 'CC-BY-4.0' | 'CC-BY-SA-4.0' | 'MIT' | 'Apache-2.0' | 'proprietary' | 'unknown' | (string & {});  // any SPDX id accepted; the listed ones get UI labels

export interface Provenance {
  readonly source: 'primitive' | 'upload' | 'polyhaven' | 'kenney' | 'quaternius' | 'sketchfab' | 'generated' | 'derived' | (string & {});
  readonly sourceId?: string;                       // id in the source system
  readonly sourceUrl?: string;
  readonly author?: string;
  readonly importedAt: string;
  readonly generator?: {                            // when source = 'generated'
    readonly provider: string;                      // e.g. "meshy", "hf-trellis2"
    readonly model?: string;
    readonly promptHash: string;                    // sha256 of the prompt; the prompt itself is in the transcript, not the document
    readonly jobId: string;
  };
  readonly derivedFrom?: readonly AssetId[];        // when source = 'derived' (e.g. decimated copy)
}
```

### 6.1 Blobs
Binary payloads live in the project's **blob store**, addressed by content hash.

```ts
export interface BlobRef {
  readonly hash: string;      // "sha256-<64 hex>"
  readonly size: number;      // bytes
  readonly mime: string;      // "model/gltf-binary", "image/png", "image/ktx2", "image/vnd.radiance", "text/typescript", …
  readonly fileName?: string; // original name, display only
}
```
Assets reference blobs; the document itself contains no binary data. Missing blobs are a recoverable state (the UI shows placeholders and offers re-import; peers can supply blobs in collaboration).

### 6.2 `geometry`
```ts
export interface GeometryAsset extends AssetBase {
  readonly kind: 'geometry';
  readonly source:
    | { readonly kind: 'primitive'; readonly primitive: Primitive }
    | { readonly kind: 'blob'; readonly blob: BlobRef; readonly meshName?: string; readonly meshIndex?: number }  // glTF/GLB; selects one mesh
    | { readonly kind: 'procedural'; readonly script: AssetId; readonly params: JsonObject };                     // phase 7
  readonly bounds: { readonly min: Vec3; readonly max: Vec3 };  // local-space AABB; computed on import or analytically; required
  readonly stats: { readonly triangles: number; readonly vertices: number; readonly primitiveGroups: number };
}

export type Primitive =
  | { readonly type: 'box'; readonly size: Vec3 }                                                  // default [1,1,1]
  | { readonly type: 'sphere'; readonly radius: number; readonly segments: number }                // 0.5, 32
  | { readonly type: 'cylinder'; readonly radiusTop: number; readonly radiusBottom: number; readonly height: number; readonly segments: number }
  | { readonly type: 'cone'; readonly radius: number; readonly height: number; readonly segments: number }
  | { readonly type: 'plane'; readonly size: readonly [number, number] }                          // [1,1], faces +Y
  | { readonly type: 'torus'; readonly radius: number; readonly tube: number; readonly radialSegments: number; readonly tubularSegments: number }
  | { readonly type: 'capsule'; readonly radius: number; readonly height: number; readonly segments: number };
```
Primitives are centered at the origin except `plane` (centered, lying in XZ) and `cylinder`/`cone`/`capsule` (centered vertically). Bounds for primitives are computed analytically in `@tessera/schema` (pure functions) so headless code never needs geometry data.

### 6.3 `material`
Aligned with glTF 2.0 metallic-roughness so export is lossless.
| Field | Type | Default |
| --- | --- | --- |
| `model` | `'pbr' \| 'unlit'` | `'pbr'` |
| `baseColor` | hex | `#cccccc` |
| `baseColorTexture` | `TextureSlot?` | — |
| `metallic` | 0–1 | `0` |
| `roughness` | 0–1 | `0.6` |
| `metallicRoughnessTexture` | `TextureSlot?` | — |
| `normalTexture` | `TextureSlot?` + `normalScale` (default 1) | — |
| `occlusionTexture` | `TextureSlot?` + `occlusionStrength` (default 1) | — |
| `emissive` | hex | `#000000` |
| `emissiveStrength` | ≥ 0 | `1` |
| `emissiveTexture` | `TextureSlot?` | — |
| `opacity` | 0–1 | `1` |
| `alphaMode` | `'opaque' \| 'mask' \| 'blend'` | `'opaque'` |
| `alphaCutoff` | 0–1 | `0.5` |
| `doubleSided` | boolean | `false` |
| `transmission`, `ior`, `thickness`, `clearcoat`, `clearcoatRoughness` | optional numbers | — (map to KHR extensions; UI exposes them under "Advanced") |

`TextureSlot = { texture: AssetId; texCoord: 0 | 1; scale?: [u, v]; offset?: [u, v]; rotation?: deg }` (maps to `KHR_texture_transform`).

### 6.4 `texture`
`blob: BlobRef` (png, jpeg, webp, ktx2), `colorSpace: 'srgb' | 'linear'` (base color and emissive are srgb; everything else linear), `wrapS/wrapT: 'repeat' | 'clamp' | 'mirror'` (default repeat), `size: [w, h]` (from import), `hasAlpha: boolean`.

### 6.5 `environment`
`source: { kind: 'hdri'; blob: BlobRef } | { kind: 'color'; color: hex }`, `rotation: deg around Y` (default 0), `intensity: ≥ 0` (default 1).

### 6.6 `script` (phase 7)
`language: 'ts'`, `source: string` (≤ 256 KB) or `blob`, `apiVersion: string`. Rejected until phase 7 (`UNSUPPORTED`).

## 7. Environment (document-level)

```ts
export interface Environment {
  readonly sky: { readonly kind: 'environment'; readonly asset: AssetId } | { readonly kind: 'color'; readonly color: string } | { readonly kind: 'none' };
  readonly exposure: number;                       // multiplier, default 1, (0, 64]
  readonly toneMapping: 'neutral' | 'aces' | 'agx' | 'none';   // default 'neutral' (Khronos PBR Neutral)
  readonly fog: { readonly kind: 'none' } | { readonly kind: 'linear'; readonly color: string; readonly near: number; readonly far: number } | { readonly kind: 'exponential'; readonly color: string; readonly density: number };
  readonly ambient: { readonly color: string; readonly intensity: number };  // used when sky.kind !== 'environment'; default #ffffff, 0.2
}
```

## 8. Behaviors (forward declaration; phase 7 defines semantics)

```ts
export interface Behavior {
  readonly id: BehaviorId;
  readonly name: string;
  readonly target: EntityId;
  readonly script: AssetId;                        // kind 'script'
  readonly params: JsonObject;
  readonly enabled: boolean;
}
```
The map exists in v0.1 so that documents created now migrate without a version bump when behaviors land; commands that write it return `UNSUPPORTED` until phase 7.

## 9. Yjs mapping (`@tessera/core`)

| Document path | Yjs type | Notes |
| --- | --- | --- |
| root | `Y.Map` | keys: `version` (string), `meta`, `settings`, `entities`, `assets`, `environment`, `behaviors` |
| `meta`, `settings`, `environment` | `Y.Map` of JSON leaf values | nested objects (e.g., `fog`) stored atomically as JSON |
| `entities` | `Y.Map<Y.Map>` keyed by id | |
| `entities.<id>` | `Y.Map` | keys `id`, `name`, `parent`, `order`, `enabled`, `components` |
| `entities.<id>.components` | `Y.Map<Y.Map>` keyed by component type | |
| `entities.<id>.components.<type>` | `Y.Map` of fields | field values are JSON leaves; arrays (`position`) are atomic |
| `assets`, `assets.<id>` | `Y.Map`, `Y.Map` of fields | nested `source`, `provenance` atomic |
| `behaviors.<id>` | `Y.Map` of fields | |

Field-level maps give field-level merge semantics in collaboration; arrays are atomic so a vector never merges into a mix of two edits.

## 10. Serialization

- **Snapshot JSON**: canonical form — keys sorted lexicographically at every level, entities/assets/behaviors as objects keyed by id (sorted), 2-space indentation, LF, trailing newline. `canonicalize(doc)` in `@tessera/schema` produces it; `INV-DOC-08` requires `canonicalize(parse(canonicalize(d))) === canonicalize(d)`.
- **Project folder** (desktop, git-friendly): `project.tessera.json` (snapshot) + `blobs/<hash>` + `blobs/index.json` (hash → mime, size, fileName).
- **Archive** `.tessera`: a ZIP with the same layout plus `manifest.json` `{ format: 'tessera-archive', version: 1, documentVersion, createdAt, generator }`.
- **Live persistence** (browser): Yjs updates via `y-indexeddb`; snapshot regenerated on demand. Blobs in OPFS keyed by hash.

## 11. Versioning and migrations

- `document.version` follows semver. Additive optional fields bump patch; new required fields or renamed fields bump minor pre-1.0.
- `@tessera/schema/migrations` exposes `migrate(input: unknown): Result<Document, TesseraError>` that chains `from_x_y_z_to_…` functions. Every migration has fixture pairs (`fixtures/documents/<version>/*.json`) and is pure.
- Unknown newer versions return `UNSUPPORTED` with the version in details; the UI offers read-only opening.

## 12. Validation levels

1. **Schema** (Zod): shapes, ranges, enums, string patterns.
2. **Referential**: parents exist, assets exist and have the right kind, `mainCamera` has a camera component, behaviors target existing entities.
3. **Structural**: no parent cycles, depth ≤ 64, sibling name uniqueness, one component per type.
4. **Semantic warnings** (non-blocking, surfaced in the UI and to the agent): material slot count differs from primitive groups; `collider.shape = 'mesh'` on a dynamic rigid body; light intensity outside typical ranges; unused assets.

`validateDocument(doc): ValidationReport` runs all levels and is used by `tessera validate`, by tests, and by the command bus in development builds after every transaction.

## 13. Inspector metadata

Every schema field carries UI metadata through Zod `.meta()`:

```ts
z.number().min(1).max(179).default(50).meta({ label: 'Field of view', unit: '°', step: 1, widget: 'slider', group: 'Lens', order: 10, description: 'Vertical field of view' })
```
Allowed `widget` values: `number`, `slider`, `vec3`, `vec2`, `color`, `toggle`, `select`, `asset` (with `assetKind`), `entity`, `text`, `textarea`, `tags`, `json`. The inspector in `@tessera/ui` is generated from this metadata (`INV-DOC-09`: every field of every component and asset kind has metadata; a test walks the schemas and fails on omissions).

## 14. Limits (soft limits warn; hard limits reject)

| Item | Soft | Hard |
| --- | --- | --- |
| Entities per document | 50,000 | 250,000 |
| Assets per document | 10,000 | 50,000 |
| Hierarchy depth | 32 | 64 |
| Name length | — | 64 |
| Blob size | 256 MB | 2 GB |
| Document snapshot size | 50 MB | 200 MB |

## 15. Invariants

| Id | Invariant |
| --- | --- |
| INV-DOC-01 | Ids are unique across the entire document, across all maps (an entity id never equals an asset id). |
| INV-DOC-02 | Every `parent` references an existing entity or is `null`. |
| INV-DOC-03 | The parent graph is a forest (no cycles). |
| INV-DOC-04 | Every entity has a `transform` component. |
| INV-DOC-05 | `rigidBody` present ⇒ `collider` present. |
| INV-DOC-06 | Every `AssetId` referenced from a component, environment or asset resolves to an asset of the required kind. |
| INV-DOC-07 | Sibling names are unique case-insensitively; asset names are unique per kind. |
| INV-DOC-08 | Canonical serialization is idempotent and stable across platforms. |
| INV-DOC-09 | Every schema field has inspector metadata. |
| INV-DOC-10 | No document field contains binary data or secrets; blobs are referenced by hash only. |
| INV-DOC-11 | A document that passes `validateDocument` at version *v* migrates to the current version and passes again. |

## 16. Test plan

- Property-based tests (fast-check) for `canonicalize`, `fractional-indexing` ordering, and id generation.
- Schema tests: every default, range boundary and enum; every reserved component name rejected.
- Fixture documents for every version under `packages/schema/fixtures/documents/`; migration tests run the full chain.
- `validateDocument` tests for every invariant above, positive and negative.
- Inspector metadata completeness test (`INV-DOC-09`).
- Yjs mapping round-trip: `toYDoc(snapshot)` → `fromYDoc` equals snapshot after canonicalization.
