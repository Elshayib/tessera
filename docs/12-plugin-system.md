# 12 — Plugin system and sandboxed scripting

Status: Draft (interfaces fixed in phase 0 so built-ins use them; external loading in phase 8) · Last updated: 2026-09-06 · Packages: `@tessera/plugin-api`, `@tessera/core` (registries) · Phase: 0 (interfaces), 7 (sandbox), 8 (external plugins)

## 1. Purpose and scope

Every feature in Tessera attaches through registries (`INV-ARCH-08`). Plugins are packages that register into the same registries through a stable API. Sandboxed scripting (behaviors, procedural geometry) is a separate, more restricted mechanism for user- and agent-authored code that runs inside the document's lifecycle.

## 2. Extension points

| Registry | What a plugin contributes | Consumers |
| --- | --- | --- |
| `CommandRegistry` | Commands (with schemas, tiers) | UI, agent tools, MCP |
| `QueryRegistry` | Queries | UI, agent, MCP |
| `ComponentRegistry` | New component type: Zod schema + inspector metadata, `ComponentSyncHandler` (engine), exporter mapping (glTF extras + sidecar section), validation hooks | schema validation, inspector, engine, exporters |
| `ToolRegistry` | Additional agent tools (usually derived automatically from commands/queries) | agent, MCP |
| `ProviderRegistry` | LLM providers | settings, agent |
| `GenerationProviderRegistry` | Generation providers | assets, agent |
| `AssetSourceRegistry` | Asset sources | asset panel, agent |
| `ExporterRegistry` | Exporters | export dialog, CLI |
| `PanelRegistry` | UI panels (React) with placement hints | editor layout |
| `MacroRegistry` (part of `CommandRegistry`, tier 2) | Deterministic layout algorithms | agent |

## 3. Plugin API

```ts
export interface TesseraPlugin {
  readonly id: string;                              // reverse-DNS or scoped npm name
  readonly version: string;                         // semver
  readonly displayName: string;
  readonly apiVersion: '1';
  readonly permissions: readonly PluginPermission[];
  activate(ctx: PluginContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}
export type PluginPermission = 'document:write' | 'engine' | 'llm' | 'generation' | 'storage' | 'ui' | `network:${string}`;   // network:<origin>

export interface PluginContext {
  readonly commands: CommandRegistry;               // only with 'document:write'
  readonly queries: QueryRegistry;
  readonly components: ComponentRegistry;
  readonly tools: ToolRegistry;
  readonly providers: ProviderRegistry;             // 'llm'
  readonly generation: GenerationProviderRegistry;  // 'generation'
  readonly sources: AssetSourceRegistry;
  readonly exporters: ExporterRegistry;
  readonly panels: PanelRegistry;                   // 'ui'
  readonly storage: ScopedKeyValueStore;            // 'storage' — namespaced by plugin id
  readonly fetch: typeof fetch;                     // restricted to declared network origins
  readonly logger: Logger;
  readonly flags: Readonly<Record<string, boolean>>;
}
```

Rules:
- Built-in features are written as plugins against this API (`packages/*/src/plugin.ts` exports a `TesseraPlugin`); the app's bootstrap activates them in dependency order. This keeps the API honest.
- Plugin ids namespace everything they register (`myplugin.component.wind`); collisions are `CONFLICT` at activation.
- Components contributed by plugins are stored in the document under their namespaced type; documents remain loadable without the plugin (unknown components are preserved verbatim and shown read-only).

## 4. Loading modes

| Mode | Phase | Trust | Mechanism |
| --- | --- | --- | --- |
| Built-in | 0 | full | compiled into the app |
| Workspace (npm) | 8 | full (user installs) | resolved at build time in a self-built app or the desktop app's plugin folder |
| Dynamic sandboxed | post-1.0 | partial | iframe/worker with RPC proxies for registries; no `engine` or `ui` permission |

## 5. Versioning

`@tessera/plugin-api` follows semver; `apiVersion` gates activation; deprecated members carry `@deprecated` for one minor before removal (post-1.0: one major).

## 6. Sandboxed scripting (ADR-0015)

Used by behaviors (phase 7) and procedural geometry (phase 7). Scripts are TypeScript compiled by the app (esbuild-wasm in a worker) and executed with QuickJS (WASM) inside `sandbox.worker`.

API surface `tessera.script` v1 (exposed as globals inside the sandbox; typed via `packages/plugin-api/script-api.d.ts`):
```ts
declare const self: { readonly entity: EntityView; readonly params: Readonly<Record<string, unknown>>; readonly time: number; readonly deltaTime: number };
declare const scene: { get(idOrPath: string): EntityView | null; find(query: FindQuery): readonly EntityView[]; };
declare const geometry: { box(size: Vec3): GeometryBuilder; /* … */ merge(...): GeometryBuilder; };  // procedural only
declare const out: { transform?(patch: Partial<Transform>): void; emit(event: string, payload?: unknown): void; geometry?(g: GeometryBuilder): void };
declare const rng: (seed?: number) => () => number;   // deterministic
```
Limits: 100 ms CPU per invocation (interrupt handler), 64 MB memory, no network, no DOM, no timers beyond the frame callback, deterministic RNG. Violations terminate the script and surface an error on the entity. Script outputs enter the document only through commands issued by the host (procedural geometry → `asset.update` of the derived geometry blob), never directly.

## 7. Invariants

| Id | Invariant |
| --- | --- |
| INV-PLG-01 | Removing all plugins except built-ins leaves the app fully functional; removing a built-in plugin removes exactly its feature (no hidden coupling). |
| INV-PLG-02 | A document containing unknown component types loads, renders (ignoring them) and saves them unchanged. |
| INV-PLG-03 | Sandboxed scripts cannot access `fetch`, `XMLHttpRequest`, `WebSocket`, `indexedDB`, `postMessage` targets other than the host, or any DOM API; a conformance test attempts each. |
| INV-PLG-04 | Script execution is deterministic for a fixed seed and inputs. |

## 8. Test plan

- Activation order and permission enforcement tests with fake plugins.
- Unknown-component preservation round-trip.
- Sandbox escape attempts (`INV-PLG-03`) and CPU/memory limit tests.
