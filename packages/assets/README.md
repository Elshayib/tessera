# `@tessera/assets`

Canonical primitive mesh generator, default PBR material, glTF import pipeline (`08` §7), and the Poly Haven `AssetSource` (`08` §6).

## Public API

| Export | Description |
| --- | --- |
| `createPrimitiveMesh` | Pure triangle mesh (positions, normals, uvs, indices) for every schema `Primitive`. |
| `createDefaultMaterial` | Valid `MaterialAsset` (license `unknown`, provenance `derived`, Q-0014). |
| `importGltf` | Worker body: parse/normalize glTF, write blobs, return `ImportPlan` (`INV-AST-02`). |
| `createAssetService` / `commitPlan` | Main thread: `asset.create` + `entity.create` in one `Import <fileName>` transaction. |
| `HARD_BLOB_LIMIT_BYTES` | Reject files larger than 50 MiB (Q-0050). |
| `createPolyHavenSource` | `AssetSource` id `polyhaven` (CC0-1.0). Tests inject a fixture transport; production uses `createFetchTransport`. |
| `wrapUntrusted` | Wraps third-party text in `<untrusted>` (`06` §12). |

No document mutation inside `importGltf`. `asset.import` stays unregistered (Q-0016); commit uses existing catalog handlers.

## Dependency rules

Layer 2. May import `@tessera/std`, `@tessera/schema`, `@tessera/core`, `@tessera/storage`, and `@gltf-transform/*`. `import-worker.ts` / `import-plan.ts` must not import `@tessera/core` or `CommandBus` (`INV-AST-02`). Must not import `three`.

## Usage example

```ts
import { createAssetService, importGltf } from "@tessera/assets";

const imported = await importGltf({ bytes, fileName: "hero.glb", blobs, clock });
if (imported.ok) {
  createAssetService({ bus }).commitPlan(imported.value, {
    author: { kind: "user", id: "u1" },
  });
}
```

## Testing notes

Colocated Vitest tests plus `import.int.test.ts`. Coverage ≥ 85% (`01` §7). Fixtures live in `packages/schema/fixtures/gltf/`.

## Related specs

- `docs/03-domain-model.md` primitives
- `docs/08-assets-and-storage.md` §7
- `docs/09-export-and-bridges.md` §3.2
- Tickets T-0108, T-0109
