# 08 — Assets and storage

Status: Accepted · Last updated: 2026-09-06 · Packages: `@tessera/storage`, `@tessera/assets` · Phase: 1 (storage, import, uploads, Poly Haven), 3 (generation integration, more sources, compression)

## 1. Purpose and scope

`@tessera/storage` persists projects and blobs on the user's machine. `@tessera/assets` acquires assets (uploads, libraries, generation), normalizes them through the import pipeline, tracks license and provenance, and produces thumbnails. Neither package renders; both run headless.

## 2. Storage interfaces

```ts
export interface BlobStore {
  has(hash: string): Promise<boolean>;
  read(hash: string, signal?: AbortSignal): Promise<Result<Blob, TesseraError>>;
  write(data: Blob | Uint8Array, mime: string, fileName?: string, signal?: AbortSignal): Promise<Result<BlobRef, TesseraError>>;  // hashes, dedupes
  delete(hash: string): Promise<Result<void, TesseraError>>;
  list(): Promise<Result<readonly BlobRef[], TesseraError>>;
  usage(): Promise<Result<{ bytes: number; quotaBytes?: number }, TesseraError>>;
}

export interface ProjectSummary { readonly id: ProjectId; readonly name: string; readonly updatedAt: string; readonly entityCount: number; readonly thumbnail?: BlobRef }

export interface OpenProject {
  readonly id: ProjectId;
  readonly ydoc: Y.Doc;                             // live document; persistence provider attached
  readonly blobs: BlobStore;                        // project-scoped view
  close(): Promise<void>;
}

export interface ProjectStore {
  list(): Promise<Result<readonly ProjectSummary[], TesseraError>>;
  create(meta: { name: string; description?: string }, template?: 'empty' | 'studio' | 'outdoor'): Promise<Result<ProjectId, TesseraError>>;
  open(id: ProjectId): Promise<Result<OpenProject, TesseraError>>;
  snapshot(id: ProjectId): Promise<Result<Document, TesseraError>>;          // canonical JSON snapshot
  exportArchive(id: ProjectId, signal?: AbortSignal): Promise<Result<Blob, TesseraError>>;   // .tessera
  importArchive(archive: Blob, signal?: AbortSignal): Promise<Result<ProjectId, TesseraError>>;
  duplicate(id: ProjectId, name: string): Promise<Result<ProjectId, TesseraError>>;
  delete(id: ProjectId): Promise<Result<void, TesseraError>>;
}
```

Implementations:

| Implementation | Where | Notes |
| --- | --- | --- |
| `MemoryBlobStore`, `MemoryProjectStore` | tests, CLI | deterministic |
| `OpfsBlobStore` | browser | Origin Private File System; falls back to `IndexedDbBlobStore` when OPFS is unavailable |
| `IndexedDbProjectStore` | browser | one `y-indexeddb` database per project (`tessera-project-<id>`), index in `tessera-projects` |
| `FsBlobStore`, `FsProjectStore` | Node, Tauri | project folder layout from `03 §10`; atomic writes (temp + rename) |

## 3. Hashing and addressing

- `sha256` via WebCrypto in `import.worker` for files > 1 MB (main thread otherwise); `BlobRef.hash = 'sha256-' + hex`.
- Writing an existing hash is a no-op that returns the existing ref (dedupe across assets and projects on the same store).
- Blob object URLs for the engine are created per read and revoked when the cache entry is disposed.

## 4. Quotas and persistence

- On first write the app calls `navigator.storage.persist()`; `usage()` reads `navigator.storage.estimate()`.
- UI warns at 80% of quota and blocks imports at 95% with guidance (export archive, delete projects, run GC).
- Autosave: `y-indexeddb` persists each Yjs update; a debounced (5 s) canonical snapshot is also written to `snapshots/<projectId>.json` for crash recovery and quick project listing.

## 5. Garbage collection

`ProjectStore.gc(id)` deletes blobs not referenced by the current document or by the last 20 undo history entries, and older than 24 h. Never automatic; exposed in Settings → Storage and to the agent as `assets.gc` (destructive).

## 6. Asset sources

```ts
export interface AssetSource {
  readonly descriptor: { readonly id: string; readonly displayName: string; readonly kinds: readonly ('model' | 'texture' | 'hdri')[]; readonly defaultLicense: License; readonly requiresKey: boolean; readonly attributionRequired: boolean; readonly docsUrl: string };
  search(query: { readonly text: string; readonly kind: 'model' | 'texture' | 'hdri'; readonly tags?: readonly string[]; readonly page?: number; readonly pageSize?: number }, signal: AbortSignal): Promise<Result<SearchPage, TesseraError>>;
  fetch(item: SearchItem, options: { readonly resolution?: '1k' | '2k' | '4k'; readonly format?: string }, blobs: BlobStore, signal: AbortSignal): Promise<Result<FetchedAsset, TesseraError>>;
}
export interface SearchItem { readonly id: string; readonly name: string; readonly kind: 'model' | 'texture' | 'hdri'; readonly thumbnailUrl: string; readonly tags: readonly string[]; readonly license: License; readonly author?: string; readonly sizeHint?: { readonly meters?: number; readonly triangles?: number }; readonly untrustedDescription?: string }
export interface SearchPage { readonly items: readonly SearchItem[]; readonly total?: number; readonly nextPage?: number }
export interface FetchedAsset { readonly blobs: readonly BlobRef[]; readonly license: License; readonly provenance: Provenance; readonly attribution?: string }
```

Built-in sources:

| Source | Phase | API | License | Notes |
| --- | --- | --- | --- | --- |
| Uploads (local files) | 1 | — | user-declared, default `unknown` | glb/gltf, png/jpg/webp/ktx2, hdr/exr |
| Poly Haven | 1 | `https://api.polyhaven.com` (`/assets?t=models|textures|hdris`, `/files/{id}`) | CC0-1.0 | models as glTF, textures as jpg/png sets, HDRIs as .hdr; resolution choice; attribution not required but recorded |
| Kenney | 3 | curated manifest in `packages/assets/data/kenney-index.json` pointing at CC0 packs converted to glb | CC0-1.0 | manifest maintained in-repo; Draft |
| Sketchfab | 3+ | OAuth + download API | per model (CC variants) | requires user account; attribution export |
| Generated (any `GenerationProvider`) | 3 | `07 §8` | per provider | appears as a source in the same asset panel |

Search results' free-text fields are untrusted (`06 §12`) and are surfaced to the agent only inside `<untrusted>` wrappers.

## 7. Import pipeline (`import.worker`)

Input: a file (upload, source fetch, or generation result). Output: blobs written, an `ImportPlan` of commands, and warnings. The worker never touches the document; the main thread commits the plan in one transaction.

### 7.1 glTF / GLB
1. Parse with gltf-transform `WebIO` (extensions: Draco, Meshopt, KTX2 registered with decoders).
2. Validate: reject files > hard blob limit; warn on > 2M triangles; reject non-triangle primitives (convert points/lines → warning + skip).
3. Transforms: `dedup()`, `prune()`, `weld()` (tolerance 1e-5), `tangents()` when a normal texture exists and tangents are missing, `metalRough()` for spec-gloss conversion, `unlit()` preserved.
4. Optional (options / phase 3): `textureCompress` to KTX2 (UASTC for normal maps, ETC1S otherwise) for textures > 1024²; `draco()` when `options.compress`; `simplify()` to `targetTriangles`.
5. Per mesh: compute local bounds and stats → one `geometry` asset per mesh (`source.kind = 'blob'`, `meshIndex`); per material → `material` asset with texture slots → `texture` assets (colorSpace by usage).
6. Hierarchy: if the file has more than one node with a mesh, propose an entity tree mirroring the glTF node graph (names, transforms decomposed to TRS; non-decomposable matrices → `INVALID_INPUT` warning and identity with baked vertices). With a single mesh, propose one entity.
7. Store the processed GLB once as a blob; all geometry assets from the file point to it.
8. Units: glTF is meters, Y-up — no conversion. If the root bounds exceed 1 km or are under 1 mm, add a warning suggesting `rescale`.

### 7.2 Images
Decode (`createImageBitmap`), read size and alpha, store original bytes (never re-encode lossy sources), produce a `texture` asset; color space defaults to `srgb` and is switched to `linear` when assigned to a non-color slot.

### 7.3 HDR / EXR
Store bytes; produce an `environment` asset with a downscaled preview (`thumb`) rendered when the engine is available.

### 7.4 Unsupported
FBX, OBJ, USD, BLEND → `UNSUPPORTED` with a hint to convert through the Blender bridge (phase 4) or an external converter.

### 7.5 ImportPlan
```ts
export interface ImportPlan {
  readonly blobs: readonly BlobRef[];
  readonly assets: readonly AssetInput[];          // with temporary ids resolved on commit
  readonly entities?: readonly EntityInput[];     // proposed tree
  readonly warnings: readonly string[];
  readonly attribution?: string;
}
```
`AssetService.commitPlan(plan, options: { parent?: EntityRef; position?: Vec3; author })` executes `asset.create` and `entity.create` commands in one transaction labeled `Import <fileName>`.

## 8. Licensing and attribution

- `license` is mandatory on every asset (`INV-DOC-06`). Uploads default to `unknown`; the asset panel nudges the user to set it.
- Exporters generate `ATTRIBUTIONS.md` listing every asset whose license requires attribution (`CC-BY-*`, provider terms), with author, source URL and license — `INV-AST-03`.
- Assets with `license = 'proprietary'` or `'unknown'` are flagged in the export dialog; export is not blocked.

## 9. Thumbnails

`ThumbnailService.get(assetId)` returns a cached 256×256 WebP blob (`derived:thumb:<assetId>:<hash>`) rendered by the engine in an offscreen pass with a neutral studio environment; headless environments return `null`, and the UI shows a kind icon.

## 10. Asset service (façade used by UI and agent)

```ts
export interface AssetService {
  importFiles(files: readonly File[], options?: CommitOptions, signal?: AbortSignal): Promise<Result<readonly JobHandle<ImportPlan>[], TesseraError>>;
  search(sourceId: string, query: SearchQuery, signal?: AbortSignal): Promise<Result<SearchPage, TesseraError>>;
  addFromSource(sourceId: string, item: SearchItem, options?: CommitOptions & { resolution?: '1k' | '2k' | '4k' }, signal?: AbortSignal): Promise<Result<JobHandle<ImportPlan>, TesseraError>>;
  generate(providerId: string, request: GenerationRequest, options?: CommitOptions, signal?: AbortSignal): Promise<Result<JobHandle<ImportPlan>, TesseraError>>;
  listUnused(): readonly AssetId[];
  thumbnails: ThumbnailService;
  readonly sources: AssetSourceRegistry;
}
```
Agent tools `asset.search`, `asset.add`, `asset.generateMesh`, `asset.generateTexture`, `asset.generateEnvironment`, `asset.import` (tier 3) are thin wrappers around these methods and return job handles.

## 11. Invariants

| Id | Invariant |
| --- | --- |
| INV-AST-01 | Blobs are content-addressed: `read(write(x).hash)` returns bytes identical to `x`, and writing the same bytes twice yields the same hash and one stored copy. |
| INV-AST-02 | The import pipeline never modifies the document directly; it produces an `ImportPlan` committed through the command bus in exactly one transaction. |
| INV-AST-03 | Exports include `ATTRIBUTIONS.md` whenever any exported asset requires attribution. |
| INV-AST-04 | Every asset created by a source or generator carries `license` ≠ `unknown` and full `provenance` (source, sourceId or jobId, importedAt). |
| INV-AST-05 | Importing a glTF and exporting it again preserves geometry (vertex count, index count within dedupe), materials and textures byte-identically when no optimization option is enabled. |
| INV-AST-06 | Import work runs in a worker; the main thread never blocks > 50 ms during import (measured in e2e with a 50 MB file). |

## 12. Test plan

- Storage: contract test suite run against every `BlobStore`/`ProjectStore` implementation (memory in Node; OPFS/IndexedDB in browser mode; Fs in Node with a temp dir).
- Import: fixture glTF files (single mesh, multi-node, Draco, KTX2, spec-gloss, invalid) with golden `ImportPlan` snapshots; `INV-AST-05` round-trip.
- Sources: Poly Haven adapter against recorded API fixtures; pagination; failure modes.
- Attribution generation goldens.
- e2e: drag-drop import of a 50 MB file with long-task monitoring.
