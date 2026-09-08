# `@tessera/spatial`

Node-safe bounds, overlap, hierarchy sort, and camera framing math. Pure functions over document data and geometry AABBs (`02` §4, `05` §8). Layout macros and Rapier are later tickets.

## Public API

| Export | Description |
| --- | --- |
| `SpatialReader` | `getEntity` / `getAsset` / `parentChain` subset used by bounds and sort. |
| `localAabb` / `worldAabb` | Local and world AABBs from geometry bounds + TRS. No `three` Object3D. |
| `aabbOverlaps` / `aabbGap` | Intersection and Euclidean separation. |
| `onGroundPlane` | True when AABB `min.y` is within epsilon of 0 (Q-0038). |
| `unionAabb` / `expandAabb` / `aabbDiagonal` | AABB combinators. |
| `sortByHierarchy` | Parents before children (`05` §4). |
| `frameBounds` | Look-at framing pose for engine `frame` (`05` §8). |

## Dependency rules

Layer 1. May import `@tessera/std` and `@tessera/schema`. Must not import `three` Object3D, React, or Node builtins. Does not import `@tessera/core` (Q-0037); `DocumentReader` is structurally a `SpatialReader`.

## Usage example

```ts
import { frameBounds, worldAabb } from "@tessera/spatial";

const box = worldAabb(entity, reader);
const framed = frameBounds([box], 0.5);
```

## Testing notes

Colocated Vitest tests. Coverage ≥ 90% (`01` §7). Tests build documents with `@tessera/testing` `docBuilder` and `@tessera/core` `createDocument`.

## Related specs

- `docs/02-architecture.md` §4
- `docs/05-rendering.md` §4, §8
- `docs/03-domain-model.md` bounds
- Ticket T-0103
