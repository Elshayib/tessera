# `@tessera/spatial`

Node-safe bounds, overlap, hierarchy sort, camera framing, and layout-macro math. Pure functions over document data and geometry AABBs (`02` §4, `04` §8.5, `05` §8).

## Public API

| Export | Description |
| --- | --- |
| `checkScene` | Seven headless spatial checks (`06` §8.1). |
| `SpatialReader` | `getEntity` / `getAsset` / `parentChain` subset used by bounds and sort. |
| `CheckSceneReader` | `SpatialReader` plus `entities` / `pathOf` for `checkScene`. |
| `localAabb` / `worldAabb` | Local and world AABBs from geometry bounds + TRS. No `three` Object3D. |
| `aabbOverlaps` / `aabbGap` | Intersection and Euclidean separation. |
| `onGroundPlane` | True when AABB `min.y` is within epsilon of 0 (Q-0038). |
| `unionAabb` / `expandAabb` / `aabbDiagonal` | AABB combinators. |
| `sortByHierarchy` | Parents before children (`05` §4). |
| `frameBounds` | Look-at framing pose for engine `frame` (`05` §8). |
| `placeOnDelta` / `snapToGroundDelta` / `alignToDelta` / `distributeCenters` / `arrangeGridPositions` | Layout deltas for macros. |
| `poissonDisk` / `mulberry32` | Deterministic scatter samples. |
| `lookAtEuler` | Euler XYZ so local −Z faces a point. |
| `resolveOverlaps` | Minimal XZ separations. |
| `cameraFitPose` | `camera.fit` iso uses `frameBounds`; other directions keep axes (Q-0123). |

## Dependency rules

Layer 1. May import `@tessera/std` and `@tessera/schema`. Must not import `three` Object3D, React, or Node builtins. Does not import `@tessera/core` (Q-0037); `DocumentReader` is structurally a `SpatialReader`.

## Usage example

```ts
import { frameBounds, placeOnDelta, worldAabb } from "@tessera/spatial";

const box = worldAabb(entity, reader);
const framed = frameBounds([box], 0.5);
```

## Testing notes

Colocated Vitest tests. Coverage ≥ 90% (`01` §7). Tests build snapshots with `@tessera/testing` `docBuilder` (no `@tessera/core`, Q-0037).

## Related specs

- `docs/02-architecture.md` §4
- `docs/04-command-bus.md` §8.5
- `docs/05-rendering.md` §4, §8
- Tickets T-0103, T-0206, T-0208
