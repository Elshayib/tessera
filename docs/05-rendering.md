# 05 — Rendering and viewport

Status: Accepted · Last updated: 2026-09-06 · Package: `@tessera/engine` · Phase: 1 (core), 2 (screenshots for agent), 7 (advanced)

## 1. Purpose and scope

`@tessera/engine` owns everything three.js: creating the renderer, mirroring the document into a scene (**renderer sync**), loading assets into GPU resources, picking, gizmos, camera control, screenshots and viewport statistics. It never writes to the document (`INV-ARCH-02`); interactions produce **intents** that the UI turns into commands.

Out of scope: React (lives in `@tessera/ui`), document semantics (`@tessera/core`), layout math (`@tessera/spatial`).

## 2. Renderer

- `import { WebGPURenderer } from 'three/webgpu'`; TSL for all custom materials and post-processing (ADR-0005).
- Creation: `const renderer = new WebGPURenderer({ canvas, antialias: true, forceWebGL })`, then `await renderer.init()` before any render or capability read.
- Color: `outputColorSpace = SRGBColorSpace`; textures tagged per `03 §6.4`; tone mapping from `environment.toneMapping` (`neutral` → `NeutralToneMapping`, `aces` → `ACESFilmicToneMapping`, `agx` → `AgXToneMapping`, `none` → `NoToneMapping`); `toneMappingExposure = environment.exposure`.
- Shadows: enabled; PCF soft; map size 2048 for directional, 1024 for spot; at most 4 shadow-casting lights render shadows at once (nearest to camera), others fall back to no shadow with a UI warning.
- Pixel ratio capped at 2. Resize via `ResizeObserver` on the container.
- Rendering is **on demand**: a dirty flag is set by document changes, camera moves, gizmo drags, asset loads, and animation; the loop renders at most once per animation frame and idles when clean. Continuous mode exists for playback (phase 7).

## 3. Capabilities and fallback

```ts
export interface EngineCapabilities {
  readonly backend: 'webgpu' | 'webgl2';
  readonly compute: boolean;
  readonly maxDynamicLights: number;         // 64 on webgpu (clustered), 8 on webgl2
  readonly maxTextureSize: number;
  readonly compressedTextures: readonly ('ktx2-etc1s' | 'ktx2-uastc')[];
  readonly float16Textures: boolean;
}
```
Detection: if `navigator.gpu` is absent or `renderer.init()` rejects → recreate with `forceWebGL: true`. The fallback is announced through `engine.events 'capabilities.changed'`; the UI shows a persistent badge with a link to the support matrix (`01 §17`). Features disabled on `webgl2`: compute-based effects, > 8 lights (extra lights render as unlit helpers), SSGI/SSR (phase 7).

## 4. Scene mirroring (renderer sync)

### 4.1 Mapping
| Document | Runtime |
| --- | --- |
| Entity | `THREE.Group` (`Object3D`) with `userData.entityId`; children attached per hierarchy; `visible = enabled` |
| `transform` | `position`, `rotation` (Euler XYZ, degrees → radians), `scale` |
| `meshRenderer` | `THREE.Mesh` (or `InstancedMesh`, §9) child of the entity group, `layers = 0`, `castShadow/receiveShadow/visible` |
| `light` | `DirectionalLight` (+ target as child at −Z), `PointLight`, `SpotLight`, `RectAreaLight`; physical units pass through unchanged |
| `camera` | `PerspectiveCamera` / `OrthographicCamera` child; `CameraHelper` on layer 1 when selected |
| `collider` | `LineSegments` wireframe helper on layer 1 (toggle) |
| geometry asset | `BufferGeometry` (primitive generator or glTF mesh), cached by asset id; BVH computed lazily for picking |
| material asset | `MeshStandardNodeMaterial` / `MeshPhysicalNodeMaterial` (when transmission/clearcoat present) / `MeshBasicNodeMaterial` (unlit), cached by asset id |
| texture asset | `Texture` / `CompressedTexture` via loaders, cached by blob hash + sampler settings |
| environment asset | `PMREMGenerator` output for `scene.environment`, equirect for `scene.background` |
| environment (document) | `scene.background`, `scene.environment`, `scene.environmentRotation`, fog, tone mapping, exposure, ambient light |

### 4.2 Handlers
```ts
export interface ComponentSyncHandler<C> {
  readonly type: ComponentType;
  onAdd(entity: EntityView, component: C, ctx: SyncContext): void;
  onUpdate(entity: EntityView, prev: C, next: C, ctx: SyncContext): void;
  onRemove(entity: EntityView, prev: C, ctx: SyncContext): void;
}
```
Handlers are registered through the engine's registry (built-ins in `src/sync/handlers/`). `SyncContext` exposes asset caches, the scene, `markDirty()`, and the logger.

### 4.3 Application order for a change set
1. Assets created/updated (build or refresh caches; textures and geometry load asynchronously, with placeholders: magenta-checker material, unit box wireframe geometry).
2. Entities created (parents before children; the change set is topologically sorted by `spatial.sortByHierarchy`).
3. Entities updated (transform, then components).
4. Re-parenting/reordering (three.js children order is kept equal to document sibling order for deterministic rendering of transparent objects).
5. Entities deleted (dispose helpers; do not dispose shared assets).
6. Assets deleted (dispose GPU resources when refcount hits zero).
7. Environment/settings.
8. `markDirty()`.

### 4.4 Asset loading
- Blobs come from `BlobStore.read(hash)` → `Blob` → object URL for `GLTFLoader` (with `KTX2Loader`, `DRACOLoader`, `MeshoptDecoder` configured) or `TextureLoader`/`RGBELoader`/`EXRLoader`.
- One in-flight promise per asset id (dedupe); cancellation on asset deletion via `AbortController`.
- Refcounted caches: `GeometryCache`, `MaterialCache`, `TextureCache`, `EnvironmentCache`. Disposal happens when refcount reaches zero **and** 5 s have passed (grace period for quick undo/redo).
- Errors set the entity's runtime state to `error` (shown in the outliner) and log `engine.assets.load_failed` with the hash; the document is not modified.

## 5. Coordinates

Identical to the document (meters, Y-up, right-handed). No conversions in the engine. Euler order `'XYZ'` on `Object3D.rotation`.

## 6. Picking and selection

- Raycasting through `three-mesh-bvh` (`acceleratedRaycast`) with per-geometry BVH built lazily on first pick and cached.
- Layers: `0` scene content, `1` helpers, `2` gizmos. Picking ignores layers 1–2 unless the tool asks.
- `pick(x, y)` returns the nearest hit's `entityId`, point, normal, distance; entities with `enabled = false` are never hit.
- Selection highlighting: an outline pass in the TSL post-processing pipeline (phase 1 uses a simple selection box helper + emissive tint; phase 2 upgrades to an outline pass). Selection state is UI state passed in through `engine.setSelection(ids)`.

## 7. Gizmos and interaction

- `TransformControls` (three addon) for translate/rotate/scale; modes: `translate | rotate | scale`; spaces `world | local`; snapping increments `0.1 m`, `15°`, `0.1` toggled with a modifier key; multi-selection manipulates a temporary pivot group.
- **Drag protocol** (`INV-CMD-06`): on `dragging-changed(true)` the engine takes a snapshot of the affected entities' transforms and manipulates `Object3D`s directly during the drag (no document writes); on `dragging-changed(false)` it emits one `intent: 'transform.set'` per entity with final values, which the UI executes in a single transaction labeled `Move|Rotate|Scale <name>`. Escape during drag restores the snapshot.
- Keyboard nudging (accessibility): arrow keys move the selection by the snap increment in the viewport plane; with `Shift` ×10; emits the same intents.
- Helpers: infinite grid (TSL shader, fades with distance, 1 m / 10 m lines), axes gnomon, light helpers, camera frustum for the selected camera, collider wireframes (toggle).

## 8. Viewport camera and framing

- `camera-controls` library for orbit/pan/dolly with damping; the viewport camera is UI state (never in the document) with a persisted last pose per project in localStorage.
- `frame(targets, { padding })` computes a pose with `spatial.frameBounds` and animates over 300 ms (respects `prefers-reduced-motion`: instant).
- "Look through" an entity camera: viewport temporarily adopts the entity camera's pose and lens; edits to the pose during this mode emit `transform.set` intents for the camera entity on release.

## 9. Performance strategies (to meet `01 §8`)

- Frustum culling on (default); `matrixAutoUpdate = false` for static entities, matrices updated only from change sets.
- Automatic instancing (phase 2): when ≥ 16 entities share geometry + materials and have no per-entity component that prevents it, the sync layer maintains an `InstancedMesh` group; picking maps instance id → entity id. Toggleable via flag `engineAutoInstancing`.
- Shared BVHs per geometry; BVH built in `import.worker` for meshes > 100k triangles (transferable buffers).
- Texture compression: KTX2 assets preferred; import pipeline offers KTX2 encoding for textures > 1024².
- Shadow budget: ≤ 4 shadow maps; shadow camera fitted to the union of casters' bounds.
- Render on demand; `renderer.info` sampled into `ViewportStats { fps, frameMs, drawCalls, triangles, textures, geometries, programs }`.

## 10. Screenshots

```ts
export interface ScreenshotOptions {
  readonly width: number;                   // ≤ 2048
  readonly height: number;
  readonly camera: { kind: 'viewport' } | { kind: 'entity'; id: EntityId } | { kind: 'preset'; preset: 'top' | 'front' | 'iso'; frame: readonly EntityId[] | 'all' };
  readonly includeHelpers?: boolean;        // default false
  readonly format?: 'png' | 'jpeg';         // default jpeg quality 0.85 for agent use, png for user export
  readonly background?: 'scene' | 'neutral';// neutral = mid-gray background, useful for the critic
}
export interface Screenshot { readonly blob: Blob; readonly width: number; readonly height: number; readonly camera: CameraPose; readonly renderedAt: string; }
```
Rendering happens into a dedicated render target so the viewport is unaffected; helpers are hidden unless requested; the result is deterministic for a fixed document and camera up to GPU precision (visual tests use tolerance).

## 11. Resource management

- `engine.dispose()` disposes every cache, controls, render targets and the renderer; a leak test creates/destroys R1 100 times and asserts stable heap and `renderer.info.memory`.
- Context/device loss: on `webglcontextlost` or WebGPU `device.lost`, the engine emits `engine.device_lost`, tears down GPU resources, re-initializes (possibly on the fallback backend), and rebuilds the scene from the document snapshot.

## 12. Public interface

```ts
export interface EngineHandle {
  readonly capabilities: EngineCapabilities;
  readonly canvas: HTMLCanvasElement;
  readonly stats: Readonly<ViewportStats>;
  readonly events: Emitter<EngineEvents>;          // 'intent', 'hover', 'pick', 'capabilities.changed', 'device_lost', 'asset.state'
  mount(container: HTMLElement): void;
  unmount(): void;
  setSelection(ids: readonly EntityId[]): void;
  setGizmo(mode: 'translate' | 'rotate' | 'scale' | 'none', space: 'world' | 'local'): void;
  setSnapping(snapping: { enabled: boolean; translate: number; rotateDeg: number; scale: number }): void;
  setHelpers(flags: Partial<HelperFlags>): void;
  frame(targets: readonly EntityId[] | 'all', options?: { padding?: number; animate?: boolean }): void;
  getViewportCamera(): CameraPose;
  setViewportCamera(pose: CameraPose): void;
  lookThrough(cameraEntity: EntityId | null): void;
  pick(x: number, y: number): PickResult | null;
  raycast(origin: Vec3, direction: Vec3, maxDistance?: number): readonly RaycastHit[];
  screenshot(options: ScreenshotOptions, signal?: AbortSignal): Promise<Result<Screenshot, TesseraError>>;
  requestRender(): void;
  dispose(): void;
}
export type EngineIntent =
  | { kind: 'transform.set'; targets: readonly { id: EntityId; transform: Transform }[]; label: string }
  | { kind: 'select'; ids: readonly EntityId[]; additive: boolean }
  | { kind: 'focus'; id: EntityId };
```

## 13. Invariants

| Id | Invariant |
| --- | --- |
| INV-RND-01 | Applying a change set is idempotent: applying it twice yields an identical scene graph (compared by a structural hash of entity ids, transforms, material/geometry references, light/camera parameters). |
| INV-RND-02 | Incremental sync equals full rebuild: for any sequence of transactions, the structural hash after incremental application equals the hash of a fresh mirror built from the final snapshot. |
| INV-RND-03 | The engine never imports `CommandBus` and never calls a mutating API on the document. |
| INV-RND-04 | No document writes during drags; exactly one intent batch per drag. |
| INV-RND-05 | Disposing the engine releases all GPU resources (`renderer.info.memory` returns to zero). |
| INV-RND-06 | Every asset load failure is recoverable: the document is untouched and a placeholder renders. |
| INV-RND-07 | Screenshots never include helpers or gizmos unless requested. |

## 14. Test plan

- Node unit tests for pure parts: primitive geometry generation (vertex counts, bounds equal to `schema` analytic bounds), change-set ordering, cache refcounting, Euler conversion.
- Browser-mode tests (Vitest + Playwright provider, Chromium with WebGL fallback in CI; WebGPU run in a nightly job on a runner with GPU): `INV-RND-01/02` on R1 with randomized transaction sequences; picking accuracy on known layouts; screenshot determinism (perceptual hash within tolerance); leak test.
- Visual regression via Playwright in `apps/web` for reference scenes (baseline per backend).
- Benchmarks: sync of 100-entity change set, full rebuild R1, screenshot latency.
