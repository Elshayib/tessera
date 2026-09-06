# 09 — Export and engine bridges

Status: Accepted (§1–§6, §9–§11) · Draft (§7–§8 bridges) · Last updated: 2026-09-06 · Packages: `@tessera/exporters`, `bridges/*` · Phase: 1 (glTF + sidecar, code export), 4 (bridges)

## 1. Purpose and scope

Exports turn a document into files other tools consume. glTF 2.0 is the canonical interchange (ADR-0009); a **sidecar** JSON carries everything glTF cannot express; **bridges** are engine-side importers that read both and build native scenes. Code exporters produce Three.js / React Three Fiber modules for web use. All exporters run headless in Node and in the browser and are deterministic.

## 2. Exporter interface

```ts
export interface Exporter<O extends ExportOptions = ExportOptions> {
  readonly id: string;                              // 'gltf' | 'code-three' | 'code-r3f' | plugin ids
  readonly displayName: string;
  readonly fileExtensions: readonly string[];
  readonly optionsSchema: z.ZodType<O>;
  export(input: { readonly document: Document; readonly blobs: BlobStore; readonly options: O }, signal?: AbortSignal): Promise<Result<ExportBundle, TesseraError>>;
}
export interface ExportBundle {
  readonly files: readonly { readonly path: string; readonly blob: Blob }[];   // relative paths, forward slashes
  readonly warnings: readonly string[];
  readonly attribution?: string;                    // contents of ATTRIBUTIONS.md when needed
}
export interface ExportOptions { readonly selection?: readonly EntityId[]; readonly includeDisabled?: boolean; readonly outputName: string }
```
`ExporterRegistry` is the extension point; built-ins register at bootstrap. The UI export dialog is generated from `optionsSchema` metadata like the inspector.

## 3. glTF export

### 3.1 Options
```ts
export interface GltfExportOptions extends ExportOptions {
  readonly container: 'glb' | 'gltf';               // default glb
  readonly textures: 'source' | 'png' | 'ktx2';     // default source (bytes as imported)
  readonly compression: 'none' | 'draco' | 'meshopt';   // default none
  readonly includeColliders: boolean;               // default true (as extras + sidecar; no geometry)
  readonly includeCameras: boolean;                 // default true
  readonly includeLights: boolean;                  // default true (KHR_lights_punctual)
  readonly sidecar: boolean;                        // default true
  readonly bakeUnitScale: number;                   // default 1; bridges apply engine scale themselves
}
```

### 3.2 Mapping
| Document | glTF |
| --- | --- |
| Entity | `node` with `name`, TRS (`translation`, `rotation` as quaternion from Euler XYZ degrees, `scale`), children per hierarchy and sibling order; `extras.tessera` (§3.3) |
| `enabled = false` | omitted unless `includeDisabled` (then `extras.tessera.enabled = false`) |
| `meshRenderer` | `mesh` copied from the source GLB's mesh (`meshIndex`) via gltf-transform node graph copy; primitives keep attributes; materials remapped to document materials per slot; `visible = false` → `extras.tessera.visible = false` |
| Primitive geometry | Generated triangle mesh (same generator as the engine, from `@tessera/schema` primitive params: positions, normals, uvs, indices) |
| `material` | `material` with pbrMetallicRoughness; `KHR_materials_emissive_strength`, `KHR_materials_transmission`, `KHR_materials_ior`, `KHR_materials_volume` (thickness), `KHR_materials_clearcoat`, `KHR_materials_unlit`, `KHR_texture_transform`; `alphaMode`, `doubleSided` |
| `texture` | `image` + `texture` + `sampler` (wrap modes); KTX2 via `KHR_texture_basisu` when `textures = 'ktx2'` |
| `light` directional/point/spot | `KHR_lights_punctual` with the same physical units (lux, candela); `range`; spot `innerConeAngle = outer × (1 − penumbra)`, `outerConeAngle = angle` in radians |
| `light` area | Not representable in glTF → `extras.tessera.light` and sidecar; bridges create native area lights |
| `camera` | `camera` (perspective `yfov` radians, `znear`, `zfar`; orthographic `ymag = orthoSize`, `xmag` from 16:9) |
| `collider`, `rigidBody`, `tags`, `metadata` | `extras.tessera` on the node (resolved collider sizes when `fit = 'auto'`) |
| Environment | `asset.extras.tessera.environment` + sidecar; the HDRI file is emitted next to the export (`<name>.environment.hdr`) |
| Settings | `asset.extras.tessera.settings` (`mainCamera` as node index) |
| Behaviors | `extras.tessera.behaviors` (ids and params) + sidecar; scripts as separate files (phase 7) |

### 3.3 `extras.tessera` (node level)
```json
{ "id": "e_7f3a9k2m1p", "path": "/forest/oak_01", "tags": ["vegetation","static"],
  "collider": { "shape": "box", "size": [2.1, 6.3, 2.0], "offset": [0, 3.15, 0], "isTrigger": false },
  "rigidBody": { "type": "static" },
  "metadata": { "lootTier": 2 },
  "behaviors": [{ "id": "b_…", "name": "spin", "params": { "speed": 1.5 } }],
  "light": { "type": "area", "color": "#ffffff", "intensity": 5, "size": [1, 1] } }
```
Only present keys are written. `asset.extras.tessera` carries `{ "documentVersion", "sidecarVersion": 1, "generator", "exportedAt", "settings", "environment" }`.

### 3.4 Determinism and validation
- Node, mesh, material, texture and image arrays are emitted in document order (sibling order, then asset name); buffers are packed in that order; `exportedAt` is the only varying field and is omitted when `options.deterministic = true` (used by tests).
- Output is validated in tests with the Khronos glTF Validator (`gltf-validator` npm) — zero errors required.

## 4. Sidecar (`<name>.tessera.json`, format version 1)

```json
{
  "format": "tessera-sidecar", "version": 1,
  "documentVersion": "0.1.0", "generator": "tessera@0.3.0", "exportedAt": "2026-09-06T18:00:00Z",
  "settings": { "units": "m", "up": "Y", "handedness": "right", "mainCamera": "e_cam…" },
  "environment": { "sky": { "kind": "environment", "file": "forest.environment.hdr", "rotation": 0, "intensity": 1 }, "exposure": 1, "toneMapping": "neutral", "fog": { "kind": "none" }, "ambient": { "color": "#ffffff", "intensity": 0.2 } },
  "entities": [
    { "id": "e_7f3a9k2m1p", "name": "oak_01", "path": "/forest/oak_01", "nodeIndex": 12, "enabled": true, "visible": true,
      "tags": ["vegetation","static"], "collider": { "...resolved" }, "rigidBody": { "type": "static" }, "metadata": {}, "behaviors": [], "light": null, "camera": null }
  ],
  "assets": [ { "id": "a_oak", "kind": "geometry", "name": "oak", "license": "CC0-1.0", "provenance": { "source": "polyhaven", "sourceId": "oak_tree_01", "importedAt": "…" } } ],
  "attribution": "…markdown…"
}
```
The JSON Schema is generated from Zod into `packages/schema/json-schema/sidecar.v1.json` and published with the docs. Bridges validate against it and ignore unknown fields (forward compatibility).

## 5. Engine conventions and conversions (reference for bridges)

| Engine | Axes / units | Handedness | Camera FOV | Light units | Notes |
| --- | --- | --- | --- | --- | --- |
| Godot 4 | Y-up, meters | right | vertical (default) | unitless energy, or physical when `use_physical_light_units` is on: directional lux, omni/spot lumens | cd → lm: omni `lm = cd × 4π`; spot `lm = cd × 2π(1 − cos(angle))` |
| Unity 6 | Y-up, meters | left | vertical | Built-in/URP: unitless intensity; HDRP: lux (directional), candela/lumen (point/spot) | glTFast handles handedness; bridge scales intensity for URP with a documented constant (`1 lux ≈ 1 unit` for sun; `cd × 4π / 100` for point) |
| Unreal 5.7 | Z-up, centimeters | left | horizontal | candela/lumens/unitless per light (`IntensityUnits`) | Interchange glTF import handles axes and scale; bridge sets `IntensityUnits = Candelas` for point/spot and lux for directional |
| Blender 5 | Z-up, meters | right | horizontal or vertical (sensor fit) | watts (point/spot/area), W/m² (sun) | glTF importer "Lighting mode: Standard" converts physical units; `sun W/m² = lux / 683`, `point W = cd × 4π / 683` |

All conversions live in `packages/exporters/src/engine-conventions.ts` as pure functions with tests; bridges duplicate the constants in their language with the same test vectors.

## 6. Code exporters (phase 1: three, phase 2: r3f)

- **Three.js module** (`code-three`): ESM `scene.js` that loads `<name>.glb` with `GLTFLoader` (+ KTX2/Draco/Meshopt loaders when used), applies environment (PMREM from the HDRI file), fog, tone mapping and exposure, creates area lights, and exposes `createScene({ renderer }) → { scene, camera, update }`. Plain JavaScript with JSDoc types; no bundler assumptions.
- **React Three Fiber** (`code-r3f`): `Scene.tsx` using `useGLTF`, `Environment`, lights and camera; props for the model URL; TypeScript.
- Generated code is formatted with a fixed printer (no dependency on the user's formatter), includes a header comment with the Tessera version and license summary of assets, and is snapshot-tested.

## 7. Bridges (Draft — refined at phase 4 start)

Common rules: a bridge consumes `<name>.glb` + `<name>.tessera.json` (+ environment file) and produces a native scene; it never needs Tessera running; it validates the sidecar against the schema; missing sidecar → import glTF only, with a warning.

### 7.1 Godot addon (`bridges/godot-addon`, GDScript, MIT)
- `EditorPlugin` adding **Import Tessera Scene…**; uses Godot's glTF importer to build the node tree, then applies the sidecar: `StaticBody3D`/`RigidBody3D`/`AnimatableBody3D` from `rigidBody.type` with `CollisionShape3D` (Box/Sphere/Capsule/ConvexPolygon/ConcavePolygon from `collider`), node groups from tags, `set_meta("tessera_*")` from metadata and ids, `WorldEnvironment` + `DirectionalLight3D` etc. from environment, `Camera3D.current` from `mainCamera`, area lights as `OmniLight3D` approximations with a warning.
- Behaviors → `res://tessera/behaviors/<name>.gd` stubs with `@export` params and `_ready/_process` templates.
- Tests: GUT test project importing fixture exports and asserting node counts, groups, shapes and transforms.

### 7.2 Unity package (`bridges/unity-package`, C#, MIT)
- UPM package `com.tessera.importer` depending on `com.unity.cloud.gltfast`. A `ScriptedImporter` for `.tessera.json` that imports the sibling GLB via glTFast and post-processes: colliders (`BoxCollider`, `SphereCollider`, `CapsuleCollider`, `MeshCollider` convex/non-convex), `Rigidbody`, tags/layers via a mapping asset, `TesseraMetadata` component, environment (skybox material from HDRI, ambient), main camera flag.
- Behaviors → `MonoBehaviour` stubs with serialized params. Tests via Unity Test Framework in a sample project.

### 7.3 Unreal (`bridges/unreal`, Python, MIT)
- Editor Python script (Remote Execution or Editor Utility Widget) that imports the GLB with Interchange, then reads the sidecar to set actor tags, simple collision from collider data, light units, and a `DataAsset` with metadata; behaviors as Blueprint stubs are phase 7+.

### 7.4 Blender add-on (`bridges/blender-addon`, Python, GPL-3.0-or-later)
- Import: GLB + sidecar → collections mirroring groups, custom properties from tags/metadata/ids, rigid body settings, world from HDRI.
- Export back: selected collection → GLB + sidecar preserving Tessera ids where present (round-trip editing).
- Headless jobs (phase 7): `blender -b --python tessera_jobs.py -- job.json` implementing `remesh`, `decimate`, `uv-unwrap`, `bake` per the job contract in `docs/11 §6` (desktop discovers Blender and runs jobs through the `JobQueue`).

## 8. Live push (Draft, phase 5+)
Where an engine exposes an MCP server (Unity, Godot, Unreal, Blender), the Tessera agent can drive it as a **client** to place an exported scene into a running editor. This is an optional integration layered on exports; it never replaces the file-based bridge.

## 9. `ATTRIBUTIONS.md`
Generated by `exporters/src/attribution.ts`: one section per license requiring attribution; per asset: name, author, source URL, license; plus provider terms notes for generated assets. Included in every bundle when non-empty (`INV-AST-03`).

## 10. Invariants

| Id | Invariant |
| --- | --- |
| INV-EXP-01 | Exporters read only the document and blob store; they never depend on `@tessera/engine` or a live scene. |
| INV-EXP-02 | glTF export is deterministic: same document + options (+ `deterministic: true`) → byte-identical output. |
| INV-EXP-03 | Every glTF export passes the Khronos validator with zero errors. |
| INV-EXP-04 | Export → import round-trip preserves entity ids, names, paths, transforms (1e-5), materials, lights, cameras, tags, colliders (`INV-ARCH-07`). |
| INV-EXP-05 | Node `extras.tessera.id` and sidecar `entities[].id`/`nodeIndex` agree for every exported entity. |
| INV-EXP-06 | Unit and axis conversions are applied only by bridges, using the shared constants; the glTF is always meters, Y-up. |

## 11. Test plan

- Golden exports for fixture documents (R1 subset, primitives-only, lights/cameras-only, materials with every extension); validator run; determinism (two exports compared).
- Round-trip tests through the import pipeline.
- Engine conversion functions: test vectors shared with bridges (`bridges/shared-test-vectors.json`).
- Code exporters: snapshot tests; a Playwright test that runs the generated Three.js module in a page and asserts a rendered frame (non-blank, expected object count).
- Bridges: engine-native test projects executed in CI where an engine can run headless (Godot yes; Unity/Unreal via manual release checklists).
