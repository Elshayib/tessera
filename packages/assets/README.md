# `@tessera/assets`

Canonical primitive mesh generator and default PBR material used by the engine and exporters (`09` §3.2). Import sources and glTF workers land in later tickets.

## Public API

| Export | Description |
| --- | --- |
| `createPrimitiveMesh` | Pure triangle mesh (positions, normals, uvs, indices) for every schema `Primitive`. |
| `createDefaultMaterial` | Valid `MaterialAsset` (license `unknown`, provenance `derived`, Q-0014). |

No document mutation. No blob writes in this ticket; meshes stay in memory until a caller asks a `BlobStore` to persist them.

## Dependency rules

Layer 2. May import `@tessera/std` and `@tessera/schema`. Must not import `three`, `@tessera/core`, or `@gltf-transform/*` (T-0109). Must not import `CommandBus`.

## Usage example

```ts
import { createDefaultMaterial, createPrimitiveMesh } from "@tessera/assets";

const mesh = createPrimitiveMesh({ type: "box", size: [1, 1, 1] });
const material = createDefaultMaterial({
  id: "a_aaaaaaaaaa",
  createdAt: "2026-01-01T00:00:00.000Z",
});
```

## Testing notes

Colocated Vitest tests. Coverage ≥ 85% (`01` §7). Mesh AABBs must match `primitiveBounds` within 1e-5.

## Related specs

- `docs/03-domain-model.md` primitives
- `docs/09-export-and-bridges.md` §3.2
- `docs/05-rendering.md` §4
- Ticket T-0108
