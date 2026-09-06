# 02 — Architecture

Status: Accepted · Last updated: 2026-09-06

## 1. One-paragraph architecture

Tessera is a local-first application whose center is a **document** (a Yjs CRDT holding entities, components, assets, environment and behaviors) that can only be mutated through a **command bus**. Four kinds of clients drive that bus — the editor UI, the built-in agent, external agents over MCP, and remote collaborators via CRDT sync — and every mutation is recorded as an attributed **transaction** with a structured change set. A **renderer sync** layer mirrors the document into a three.js WebGPU scene incrementally. **Providers** (LLMs, generation models, asset libraries) are behind interfaces in packages that contain no vendor code, with vendor implementations in separate packages. **Exporters** turn the document into glTF + sidecar and code; **bridges** turn those into native engine scenes. Everything runs in the browser; a Tauri desktop shell adds files, local models and a bundled MCP server; an optional sync server adds persistent rooms.

## 2. Layer diagram

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ L4  apps/web · apps/desktop · apps/cli · apps/mcp-server · apps/collab-server · evals │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ L3  @tessera/ui  (React panels, design system, inspector generator, chat, review)     │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ L2  engine · agent · assets · exporters · collab · mcp · plugin-api ·                 │
│     providers-llm · providers-generation                                             │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ L1  core (document, command bus, undo, queries, jobs) · spatial · llm · generation ·  │
│     storage                                                                          │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ L0  std (Result, ids, invariant, logger, emitter, clock, abort) · schema (Zod, types) │
└──────────────────────────────────────────────────────────────────────────────────────┘
        imports flow downward only; vendor SDKs are confined to the packages listed in §5
```

## 3. Runtime topologies

| Topology | Processes | Sync | Notes |
| --- | --- | --- | --- |
| **Web, single user** (phase 1) | Browser tab | none | Document persisted to IndexedDB via `y-indexeddb`; blobs in OPFS. |
| **Web + built-in agent** (phase 2) | Browser tab | none | Agent runs in the tab; provider calls go browser → provider (CORS) or through the desktop sidecar. |
| **Web + external agent** (phase 5) | Browser tab + local `tessera-mcp` process | WebSocket on localhost | MCP server holds no document; it forwards tool calls to the tab over the bridge protocol (`11 §3`). |
| **Desktop** (phase 5) | Tauri app (webview + Rust) + optional Node sidecar | in-process | Filesystem projects, keychain, bundled MCP server, Ollama and headless Blender discovery. |
| **Collaboration** (phase 6) | N browsers/desktops (+ optional room server) | y-webrtc (P2P) or y-websocket | Same document, per-author undo, presence. Server persists rooms when present. |
| **Headless** (phase 1+) | Node (`apps/cli`, tests, evals) | none | No engine; `core`, `spatial`, `exporters`, `agent` run fully in Node. |

## 4. Packages

| Package | Layer | Purpose | May import | Phase |
| --- | --- | --- | --- | --- |
| `@tessera/std` | 0 | `Result`, error codes, `invariant`, ids (`newId('e')`), `Logger` interface + default sinks, typed `Emitter`, `Clock`, `AbortSignal` helpers, `redact` | nothing internal | 0 |
| `@tessera/schema` | 0 | Zod 4 schemas and inferred types for the document, components, assets, commands, queries; migrations; JSON Schema generation; inspector metadata | std, zod | 0 |
| `@tessera/core` | 1 | Yjs-backed `Document`, `CommandBus`, `Transaction`, `UndoService`, `ChangeSet` derivation, `QueryRegistry`, `ComponentRegistry`, `JobQueue`, fractional ordering | std, schema, yjs, fractional-indexing | 0 |
| `@tessera/spatial` | 1 | Bounds, overlap tests, ground snapping, layout solver for macros, camera framing math; pure functions over document data and geometry summaries | std, schema, core (types), three (math only) | 1–2 |
| `@tessera/llm` | 1 | `LlmClient`, `ModelDescriptor`, `Capabilities`, message and tool types, `KeyVault` interface, `ProviderRegistry` interface | std, schema | 2 |
| `@tessera/generation` | 1 | `GenerationProvider` interface, request/result types for mesh, texture, environment, image generation | std, schema | 3 |
| `@tessera/storage` | 1 | `BlobStore` and `ProjectStore` interfaces; implementations: memory, IndexedDB, OPFS, filesystem (Node/Tauri); `.tessera` archive codec | std, schema, yjs (persistence only), idb | 1 |
| `@tessera/engine` | 2 | three.js WebGPU renderer host, `RendererSync`, `ComponentSyncHandler`s, asset loading and caches, picking, gizmos, camera controller, screenshots, viewport stats | std, schema, core, spatial, storage (blob reads), three, three-mesh-bvh, camera-controls | 1 |
| `@tessera/agent` | 2 | `AgentRuntime` (run loop), `ToolRegistry` with tiers, prompts, capability-aware planning, roles, budgets, traces, transcript store interface, verification | std, schema, core, spatial, llm, generation, assets | 2 |
| `@tessera/assets` | 2 | `AssetSource` interface and built-in sources (Poly Haven, Kenney, uploads), import pipeline (gltf-transform in a worker), license and provenance handling, thumbnails | std, schema, core, storage, @gltf-transform/* | 1–3 |
| `@tessera/exporters` | 2 | glTF + sidecar builder (gltf-transform, Node-safe), Three.js and R3F code export, engine mapping tables | std, schema, core, storage, @gltf-transform/* | 1, 4 |
| `@tessera/collab` | 2 | `SyncProvider` abstraction (webrtc, websocket), awareness (presence), locks, room lifecycle | std, schema, core, yjs, y-webrtc, y-websocket | 6 |
| `@tessera/mcp` | 2 | MCP server: tools generated from commands/queries, bridge protocol to a running editor, auth token, allowlists | std, schema, core, @modelcontextprotocol/sdk, zod | 5 |
| `@tessera/providers-llm` | 2 | Implementations of `@tessera/llm` using the AI SDK: OpenAI, Anthropic, Google, xAI, DeepSeek, OpenRouter, Ollama, generic OpenAI-compatible; CORS strategy; key vault implementations | std, llm, ai, @ai-sdk/*, @openrouter/ai-sdk-provider | 2 |
| `@tessera/providers-generation` | 2 | Meshy, Tripo, Rodin, Hugging Face Space (TRELLIS.2), local HTTP worker adapters | std, generation, storage | 3 |
| `@tessera/plugin-api` | 2 | Public extension interfaces and the plugin manifest; re-exports the stable subset of core types | std, schema, core (types), llm (types), generation (types) | 0 (interfaces), 8 |
| `@tessera/ui` | 3 | React design system, panels (viewport host, outliner, inspector generated from schema metadata, chat, review, assets, settings), stores, messages | everything below except providers-* and mcp | 1+ |
| `@tessera/testing` | 2 (test-only) | Fixtures (R1, R2, R3, D1), factories, fake `LlmClient`, fake providers, scene assertions, recorded fixture player | anything below L3 | 0 |
| `apps/web` | 4 | Composition root for the browser editor, flags, service worker, routes | all | 0 |
| `apps/desktop` | 4 | Tauri shell; frontend is `apps/web` | all | 5 |
| `apps/cli` | 4 | `tessera validate|export|eval|inspect` | all non-UI | 1 |
| `apps/mcp-server` | 4 | Thin executable around `@tessera/mcp` | mcp | 5 |
| `apps/collab-server` | 4 | y-websocket / Hocuspocus with persistence | collab | 6 |
| `apps/docs` | 4 | Astro Starlight site built from `docs/` and package READMEs | — | 1 |
| `bridges/*` | 4 | Engine-side importers; separate toolchains; consume the sidecar spec only | — | 4 |
| `evals/` | 4 | Suites, runner, reports; uses `@tessera/agent` and `@tessera/testing` | all non-UI | 2 |

## 5. Dependency rules (enforced by dependency-cruiser)

1. **Downward only.** A package may import only from lower layers or its own layer as listed in §4. Same-layer imports are allowed only where listed.
2. **No cycles** anywhere, including type-only imports.
3. **No deep imports.** Only `@tessera/<pkg>` and documented sub-paths.
4. **Vendor isolation.**
   - `three`, `three-mesh-bvh`, `camera-controls`: only `engine`; `three` additionally allowed in `spatial` (math classes only; reviewed).
   - `ai`, `@ai-sdk/*`, `@openrouter/*`: only `providers-llm`.
   - `@modelcontextprotocol/sdk`: only `mcp`, `apps/mcp-server`.
   - `yjs`, `y-*`: only `core`, `collab`, `storage`.
   - `react`, `react-dom`, `zustand`: only `ui`, `apps/web`, `apps/desktop`, `apps/docs`.
   - `@gltf-transform/*`: only `assets`, `exporters`.
   - `zod`: `schema` (definitions), `core`, `agent`, `mcp`, `plugin-api` (consumption).
   - `@dimforge/rapier3d-compat`: only `spatial` (checks) and `engine` (preview).
5. **`apps/*` are never imported.** `evals/` and `bridges/*` are never imported by packages.
6. **`@tessera/testing`** is imported only from `*.test.ts`, `*.bench.ts`, `*.browser.test.ts`, `apps/web/e2e/**`, and `evals/**`.
7. **Node built-ins** (`node:*`) are allowed only in `storage` (filesystem implementation), `apps/cli`, `apps/mcp-server`, `apps/collab-server`, and build scripts. Browser-facing packages must not import them.

The config template `docs/templates/dependency-cruiser.cjs` encodes these rules. Changing the config requires an ADR.

## 6. Data flows

### 6.1 UI edit (phase 1)
1. Inspector widget change → `commands.execute({ name: 'transform.set', input }, { author: user, label: 'Move oak_01' })`.
2. `CommandBus` validates input (Zod) → semantic validation against the document → runs the handler inside `document.transact(origin = author)`.
3. Yjs emits change events → `ChangeSet` is derived → `transaction.committed` event.
4. `RendererSync` receives the change set and updates the affected `Object3D`s only.
5. `UndoService` (per-author `UndoManager`) records the stack item. `y-indexeddb` persists the update.

### 6.2 Agent run (phase 2)
1. Chat panel → `agent.run({ prompt, context: { selection, cameraId } })`.
2. Runtime builds the system prompt: conventions, `scene.describe` at default detail, selection, tool catalog for the model's capability profile.
3. Model returns tool calls → each call maps to a command/query/macro/job executed **through the same command bus** with `author = { kind: 'agent', runId }`. All commands of one run step are one transaction; the whole run is one **run group** the review panel treats as a unit.
4. After acting, the runtime executes verification (`06 §7`): spatial checks, then screenshots when the critic has vision.
5. Runtime emits a report (change set summary + explanation). The user accepts (no-op) or reverts (undo of the run's stack).

### 6.3 External agent via MCP (phase 5)
1. `tessera-mcp` (stdio) receives `tools/call` → validates against the same Zod schema → forwards over the localhost WebSocket bridge to the editor tab with a session token.
2. The tab executes through the command bus with `author = { kind: 'agent', runId: mcpSessionId }`; result and screenshots return over the bridge.

### 6.4 Remote update (phase 6)
1. Sync provider applies a Yjs update with `origin = remote peer id`.
2. Change set derivation runs identically; the renderer sync updates; the remote author's transactions are not in the local user's undo stack.

### 6.5 Asset import (phase 1)
1. File drop → `assets.import(file)` → worker runs gltf-transform (dedupe, prune, tangents, optional Draco/KTX2) → blobs hashed and stored → asset entries created through `asset.create` commands in one transaction with license and provenance.

### 6.6 Export (phase 1, 4)
1. `exporters.gltf.export(document, options)` builds a glTF Document with gltf-transform from the Tessera document (not from the three.js scene) so that exports are deterministic and run in Node; node `extras.tessera` carry ids, tags, colliders, behaviors; sidecar JSON is emitted alongside.

## 7. Composition root and dependency injection

- Packages export factories (`createCommandBus(deps)`, `createRendererSync(deps)`), never singletons. No module-level mutable state.
- `apps/web/src/bootstrap.ts` builds the `EditorContext` and passes it to the UI via React context. `apps/cli` builds a headless context without `engine`.

```ts
export interface EditorContext {
  readonly document: Document;            // @tessera/core
  readonly commands: CommandBus;
  readonly queries: QueryRegistry;
  readonly undo: UndoService;
  readonly jobs: JobQueue;
  readonly components: ComponentRegistry;
  readonly storage: ProjectStore;         // @tessera/storage
  readonly assets: AssetService;          // @tessera/assets
  readonly engine?: EngineHandle;         // @tessera/engine (absent headless)
  readonly agent?: AgentRuntime;          // @tessera/agent (absent when no provider configured)
  readonly logger: Logger;                // @tessera/std
  readonly clock: Clock;
  readonly flags: Readonly<Record<string, boolean>>;
}
```

- Registries are the extension mechanism (`12-plugin-system.md`): `CommandRegistry`, `QueryRegistry`, `ComponentRegistry` (schema + inspector metadata + sync handler), `AssetKindRegistry`, `ToolRegistry`, `ProviderRegistry` (LLM), `GenerationProviderRegistry`, `AssetSourceRegistry`, `ExporterRegistry`, `PanelRegistry`. Built-in features register through the same registries as plugins will.

## 8. Threading model

| Thread | Work |
| --- | --- |
| Main | React UI, three.js render loop, command bus, Yjs document, agent loop orchestration (awaits) |
| `import.worker` | gltf-transform pipeline, image decoding, hashing, thumbnail rendering (OffscreenCanvas when available) |
| `spatial.worker` (phase 2+) | Heavy overlap/layout solves for macros on large scenes; falls back to main thread for < 500 entities |
| `sandbox.worker` (phase 7) | QuickJS interpreter for behaviors and procedural scripts; message-passing API only |
| Service worker | CSP allowlist, offline shell caching |

Rules: nothing on the main thread may block > 50 ms (measured with `PerformanceObserver('longtask')` in e2e); workers communicate with structured-cloneable messages validated by Zod on both sides.

## 9. State ownership

| State | Owner | Persisted | Synced |
| --- | --- | --- | --- |
| Document (entities, components, assets, environment, behaviors, settings) | Yjs `Y.Doc` in `@tessera/core` | yes (IndexedDB / files) | yes |
| Blobs | `BlobStore` (OPFS / filesystem) | yes | by reference; lazily fetched from peers or sources |
| UI state (selection, hover, panel layout, active tool, viewport camera) | Zustand store in `@tessera/ui` | layout only (localStorage) | selection and camera as presence only |
| Engine caches (geometry, materials, textures, BVH) | `@tessera/engine` | no | no |
| Agent transcripts and traces | `TranscriptStore` (IndexedDB) | yes, per project | no |
| Provider settings and keys | `KeyVault` + settings store | yes (encrypted keys) | never |
| Jobs | `JobQueue` in `@tessera/core` | in-flight state in memory; results become document changes | no |

## 10. Cross-cutting concerns

- **Ids**: `newId(prefix)` in `@tessera/std` → prefix + 10 chars from `0-9a-z` (nanoid custom alphabet). Collision probability is negligible for document scale; uniqueness is still asserted on insert (`INV-DOC-01`).
- **Time**: `Clock` interface (`now(): number`, `nowIso(): string`); tests use `FakeClock`.
- **Events**: typed `Emitter<EventMap>` from `@tessera/std`; listeners never throw (errors are logged).
- **Cancellation**: every job and provider call takes an `AbortSignal`.
- **Feature flags**: `apps/web/src/flags.ts`; packages receive flags through their factory config, never by importing the app.
- **Errors**: `Result` at L0–L2, `describeError` at L3 (`01 §6`).
- **Logging**: `Logger` injected through factories; event names per `01 §16`.

## 11. Versioning and compatibility

- Document format has its own semver in `document.version`; migrations in `@tessera/schema/migrations` are pure functions `(doc: unknown) => Result<Document>` with fixtures for every version.
- Public APIs carry `@public` / `@beta` / `@internal` tags. Pre-1.0, breaking changes bump minor; post-1.0, major.
- The sidecar format (`09 §3`) and the MCP tool surface (`11 §2`) are public contracts with their own version fields.

## 12. Architecture invariants

| Id | Invariant | Verified by |
| --- | --- | --- |
| INV-ARCH-01 | The document is mutated only inside `CommandBus.execute`. No other code calls `Y.Doc.transact` on the document. | depcruise (yjs isolation) + code search in CI (`scripts/check-no-direct-yjs.ts`) + core tests |
| INV-ARCH-02 | The renderer never writes to the document. `@tessera/engine` has no import of `CommandBus`. | depcruise rule |
| INV-ARCH-03 | No package outside the listed ones imports a vendor SDK. | depcruise rules §5.4 |
| INV-ARCH-04 | UI state is never stored in the document; document state is never duplicated into the UI store (the UI reads through queries/subscriptions). | ui tests + review |
| INV-ARCH-05 | Every exported operation that can take > 100 ms accepts `AbortSignal` and honors it within 250 ms. | integration tests with aborted signals |
| INV-ARCH-06 | `apps/cli` and `evals/` run without `three` being loaded (headless path stays headless). | CLI test asserts `three` is absent from the module graph |
| INV-ARCH-07 | A document exported to glTF + sidecar and re-imported reproduces entities, transforms (within 1e-5), materials, lights, cameras, tags and colliders. | exporters round-trip tests |
| INV-ARCH-08 | Registries are the only way features attach to the editor; there are no hardcoded lists of components, commands or panels outside registration modules. | review + `knip` (unused registration = failure) |

## 13. Decision index

| Decision | ADR |
| --- | --- |
| Languages | ADR-0001 |
| Document-first scene model | ADR-0002 |
| Yjs as document store, fractional ordering | ADR-0003 |
| Command bus as sole mutation path; structural undo | ADR-0004 |
| three.js WebGPU + TSL, vanilla three in engine, React for panels only | ADR-0005 |
| Zod 4 as single source of truth | ADR-0006 |
| Interface/implementation package split for providers | ADR-0007 |
| Local-first, zero backend | ADR-0008 |
| glTF + extras + sidecar as interchange, built with gltf-transform | ADR-0009 |
| MCP server mirrors the command bus | ADR-0010 |
| Licensing | ADR-0011 |
| Monorepo toolchain | ADR-0012 |
| Rotation as Euler degrees in the document | ADR-0013 |
| Units, axes, light units | ADR-0014 |
| Sandboxed scripting via QuickJS in a worker | ADR-0015 |
| Agent review model: live apply in reviewable run groups | ADR-0016 |
