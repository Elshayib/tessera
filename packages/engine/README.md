# `@tessera/engine`

three.js WebGPU renderer host, on-demand viewport loop, and document→scene sync (`05`).

## Public API

| Export | Description |
| --- | --- |
| `createEngine` | Creates `EngineHandle`: WebGPU with WebGL2 fallback, mount/unmount, on-demand loop. |
| `createRendererSync` | Incremental change-set mirror into a three.js `Scene` (`05` §4). |
| `createGizmoController` | TransformControls drag protocol: one `transform.set` intent on release (`INV-RND-04`). |
| `pick` / `raycast` | BVH picking; layers 1–2 ignored unless requested (`05` §6). |
| `createViewportCamera` | `camera-controls` orbit pose; UI state only (`INV-ARCH-04`). |
| `captureScreenshot` | Offscreen capture; helpers hidden unless requested (`INV-RND-07`). |
| `viewportStats` | Samples fps / drawCalls / memory counters after a frame (`05` §9). |
| `structuralHash` | Canonical hash of entity Object3Ds (`INV-RND-01` / `INV-RND-02`). |
| `createThreeRenderer` | Default `WebGPURenderer` factory (`three/webgpu`). |
| `EngineHandle` | Viewport host (`05` §12). T-0104 implements mount/loop/dispose; later methods are no-ops or `UNSUPPORTED`. |
| `EngineCapabilities` | `backend`, `compute`, light/texture limits (`05` §3). |
| `GpuRenderer` / `CreateGpuRenderer` | Injectable renderer for tests without a GPU (Q-0040). |

`createEngine` returns `Result`. If `navigator.gpu` is missing or `init()` rejects, the host recreates the renderer with `forceWebGL: true` and emits `capabilities.changed`.

## Dependency rules

Layer 2. May import `@tessera/std`, `@tessera/schema`, `@tessera/spatial`, `@tessera/assets`, `three` / `three/webgpu`, `three-mesh-bvh`, and `camera-controls`. Must not import `CommandBus` or mutate the document (`INV-ARCH-02`, `INV-RND-03`). Must not import React. Does not import `@tessera/core` in production (tests may). Architecture table omits `assets`; T-0105 AC4 requires it (Q-0043).

## Usage example

```ts
import { createEngine } from "@tessera/engine";

const created = await createEngine({ canvas });
if (created.ok) {
  created.value.mount(container);
  created.value.requestRender();
}
```

## Testing notes

Colocated Vitest tests. Coverage ≥ 70% (`01` §7). `*.browser.test.ts` runs in happy-dom with an injected `GpuRenderer` (Q-0040). Isolation test scans production sources for `CommandBus`.

## New dependencies

| Name | License | Why |
| --- | --- | --- |
| `three` 0.183.2 | MIT | `WebGPURenderer` from `three/webgpu` (ADR-0005). ~1.2 MB min+gz for the webgpu build; no other package may import it except spatial math (not used here). |
| `@types/three` 0.183.1 (dev) | MIT | Typed `three` / `three/webgpu` imports. The `three` package does not ship its own `.d.ts`. |
| `happy-dom` 18.0.1 (dev) | MIT | DOM + `ResizeObserver` for host tests without Playwright. |
| `three-mesh-bvh` 0.9.14 | MIT | Accelerated raycast + lazy per-geometry BVH (`05` §6). Engine-only (`02` §5). |
| `camera-controls` 3.1.2 | MIT | Orbit/pan/dolly for the viewport camera (`05` §8). Engine-only (`02` §5). |

## Related specs

- `docs/05-rendering.md` §2–§10, §11–§13
- `docs/adr/ADR-0005-threejs-webgpu-tsl.md`
- Tickets T-0104, T-0105, T-0106, T-0107
