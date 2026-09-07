# `@tessera/engine`

three.js WebGPU renderer host, on-demand viewport loop, and (later) document→scene sync (`05`). This ticket lands the host, WebGL2 fallback, and dispose. Sync, picking, gizmos, and screenshots are later tickets.

## Public API

| Export | Description |
| --- | --- |
| `createEngine` | Creates `EngineHandle`: WebGPU with WebGL2 fallback, mount/unmount, on-demand loop. |
| `createThreeRenderer` | Default `WebGPURenderer` factory (`three/webgpu`). |
| `EngineHandle` | Viewport host (`05` §12). T-0104 implements mount/loop/dispose; later methods are no-ops or `UNSUPPORTED`. |
| `EngineCapabilities` | `backend`, `compute`, light/texture limits (`05` §3). |
| `GpuRenderer` / `CreateGpuRenderer` | Injectable renderer for tests without a GPU (Q-0040). |

`createEngine` returns `Result`. If `navigator.gpu` is missing or `init()` rejects, the host recreates the renderer with `forceWebGL: true` and emits `capabilities.changed`.

## Dependency rules

Layer 2. May import `@tessera/std`, `@tessera/schema`, and `three` / `three/webgpu`. Must not import `CommandBus` or mutate the document (`INV-ARCH-02`, `INV-RND-03`). Must not import React. Does not import `@tessera/core` in T-0104.

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

## Related specs

- `docs/05-rendering.md` §2–§3, §11–§12
- `docs/adr/ADR-0005-threejs-webgpu-tsl.md`
- Ticket T-0104
