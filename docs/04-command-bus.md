# 04 — Command bus, transactions, undo, queries

Status: Accepted · Last updated: 2026-09-06 · Package: `@tessera/core` (bus, document, undo, queries), `@tessera/schema` (command and query schemas), `@tessera/spatial` (macro commands) · Phase: 0–2

## 1. Purpose and scope

The command bus is the **only** way the document changes (`INV-ARCH-01`, ADR-0004). It gives every client — UI, built-in agent, MCP, remote, CLI — identical validation, attribution, undo, change tracking and events. Queries are the read-only counterpart. This document specifies the interfaces, the execution pipeline, the transaction and undo model, the change set format, and the v0.1 command and query catalogs.

## 2. Concepts

- **Command definition**: name, input schema, output schema, semantic validator, handler. Registered in the `CommandRegistry`.
- **Command bus**: validates, executes and records commands inside transactions.
- **Transaction**: atomic group of commands with one **author**, one **label**, one **change set**. Unit of undo, review and events.
- **Run group**: a set of transactions belonging to one agent run (`runId`), reviewed and reverted as one.
- **Author**: `{ kind: 'user' | 'agent' | 'remote' | 'system'; id: string; runId?: string }`. Serialized to a stable string used as the Yjs origin.
- **Change set**: structured before/after description derived from Yjs events.
- **Undo scope**: which authors' transactions an undo stack reverts.
- **Query definition**: name, input/output schema, handler; pure read.
- **Macro**: command whose handler computes and executes primitive commands (registered like any command; lives in `@tessera/spatial`).
- **Job**: asynchronous work producing commands on completion (import, generation, export).

## 3. Interfaces

```ts
// @tessera/schema
export interface CommandSchema<I, O> {
  readonly name: CommandName;                // 'entity.create'
  readonly description: string;              // one sentence, used for tool definitions
  readonly input: z.ZodType<I>;
  readonly output: z.ZodType<O>;
  readonly tier: 1 | 2 | 3 | 4;              // agent tool tier (06 §5); 0 is queries
  readonly tags: readonly ('mutating' | 'macro' | 'job' | 'engine')[];
}

// @tessera/core
export interface CommandDefinition<I, O> extends CommandSchema<I, O> {
  /** Cheap semantic checks against the current document; runs before the transaction. */
  validate?(ctx: ReadContext, input: I): Result<void, TesseraError>;
  /** Mutates the document through ctx.write.*; runs inside the transaction; must be synchronous. */
  handle(ctx: WriteContext, input: I): Result<O, TesseraError>;
}

export interface ReadContext {
  readonly doc: DocumentReader;              // getEntity, getAsset, children, resolvePath, snapshotEntity, …
  readonly registry: ComponentRegistry;
  readonly clock: Clock;
  readonly logger: Logger;
}

export interface WriteContext extends ReadContext {
  readonly write: DocumentWriter;            // the only object able to mutate Yjs maps (internal to core)
  readonly author: Author;
  readonly transactionId: TransactionId;
  /** Execute another command inside the same transaction (macros use this). */
  run<I, O>(name: CommandName, input: I): Result<O, TesseraError>;
  newId(prefix: 'e' | 'a' | 'b'): string;
}

export interface ExecuteOptions {
  readonly author: Author;
  readonly label?: string;                   // defaults to the command's description
  readonly runId?: string;                   // agent runs
  readonly dryRun?: boolean;                 // validate + compute change set on a forked doc, do not commit (phase 2)
}

export interface CommandBus {
  execute<I, O>(name: CommandName, input: I, options: ExecuteOptions): Result<CommandOutcome<O>, TesseraError>;
  transaction<T>(options: ExecuteOptions, fn: (tx: TransactionHandle) => Result<T, TesseraError>): Result<TransactionOutcome<T>, TesseraError>;
  readonly registry: CommandRegistry;
  readonly events: Emitter<CommandBusEvents>;
}

export interface TransactionHandle {
  run<I, O>(name: CommandName, input: I): Result<O, TesseraError>;
  readonly id: TransactionId;
}

export interface CommandOutcome<O> { readonly output: O; readonly transaction: TransactionRecord; }
export interface TransactionOutcome<T> { readonly value: T; readonly transaction: TransactionRecord; }

export interface TransactionRecord {
  readonly id: TransactionId;                // "t_…"
  readonly author: Author;
  readonly label: string;
  readonly runId?: string;
  readonly startedAt: string;
  readonly durationMs: number;
  readonly commands: readonly { readonly name: CommandName; readonly input: unknown }[];
  readonly changeSet: ChangeSet;
}

export interface ChangeSet {
  readonly entities: { readonly created: readonly EntityId[]; readonly deleted: readonly EntitySnapshot[]; readonly updated: readonly EntityChange[] };
  readonly assets:   { readonly created: readonly AssetId[];  readonly deleted: readonly AssetSnapshot[];  readonly updated: readonly AssetChange[] };
  readonly environment?: readonly FieldChange[];
  readonly settings?: readonly FieldChange[];
  readonly behaviors: { readonly created: readonly BehaviorId[]; readonly deleted: readonly BehaviorId[]; readonly updated: readonly BehaviorId[] };
  readonly summary: string;                  // "Moved oak_01; changed 2 materials" — generated, ≤ 200 chars
}
export interface EntityChange { readonly id: EntityId; readonly fields: readonly FieldChange[]; }
export interface FieldChange { readonly path: string /* "components.transform.position" */; readonly before: unknown; readonly after: unknown; }

export interface CommandBusEvents {
  'transaction.committed': { readonly transaction: TransactionRecord };
  'transaction.rejected': { readonly name: CommandName; readonly error: TesseraError; readonly author: Author };
  'document.changed': { readonly changeSet: ChangeSet; readonly origin: Author | 'remote-unknown' };  // also fired for remote updates
}

export interface UndoService {
  undo(scope: UndoScope): Result<TransactionRecord | null, TesseraError>;
  redo(scope: UndoScope): Result<TransactionRecord | null, TesseraError>;
  canUndo(scope: UndoScope): boolean;
  canRedo(scope: UndoScope): boolean;
  /** Reverts every transaction of an agent run in one step, regardless of interleaving. */
  revertRun(runId: string): Result<readonly TransactionRecord[], TesseraError>;
  history(scope: UndoScope, limit?: number): readonly TransactionRecord[];
}
export type UndoScope = { readonly kind: 'author'; readonly authorId: string } | { readonly kind: 'run'; readonly runId: string };

export interface QueryDefinition<I, O> {
  readonly name: QueryName;
  readonly description: string;
  readonly input: z.ZodType<I>;
  readonly output: z.ZodType<O>;
  readonly tags: readonly ('engine' | 'expensive')[];
  handle(ctx: ReadContext & { readonly engine?: EngineQueryContext }, input: I): Result<O, TesseraError> | Promise<Result<O, TesseraError>>;
}
```

`DocumentReader` exposes: `getEntity(id)`, `getAsset(id)`, `getBehavior(id)`, `children(id | null)` (ordered), `parentChain(id)`, `resolvePath(path)`, `pathOf(id)`, `entities()` (iterator), `assets(kind?)`, `snapshot()` (canonical `Document`), `subscribe(listener)`.

## 4. Execution pipeline

For `execute(name, input, options)`:

1. **Lookup** the definition; unknown name → `NOT_FOUND`.
2. **Parse** `input` with the Zod schema; failure → `INVALID_INPUT` with `details.issues` (Zod issues, paths included).
3. **Semantic validation** `definition.validate(ctx, input)`; failure returns its error. Nothing has been mutated yet.
4. **Open transaction** (or join the enclosing one when called via `TransactionHandle.run`). Set `author`, `label`, `runId`. Yjs origin = `serializeAuthor(author)`.
5. **Handle** inside `ydoc.transact(fn, origin)`. If `handle` returns `Err`, the Yjs transaction is aborted by throwing an internal sentinel and catching it outside; the document is unchanged (`INV-CMD-02`).
6. **Derive change set** from the Yjs events collected during the transaction (§7).
7. **Post-checks** (development builds and tests): `validateDocument` levels 1–3 on touched entities; a failure is an `INVARIANT_VIOLATION` — the transaction is rolled back via an immediate structural undo and the error is logged with the command name and input hash.
8. **Bump** `meta.updatedAt` inside the same transaction (before commit).
9. **Record** the `TransactionRecord`, push onto the author's undo stack (§6), emit `transaction.committed` then `document.changed`.
10. **Return** `Ok({ output, transaction })`.

Rejections emit `transaction.rejected` and return `Err`. Commands are synchronous; `execute` never awaits (`INV-CMD-05`). Asynchronous work belongs to jobs (§9).

## 5. Transactions and grouping

- `bus.transaction(options, fn)` opens one transaction; `fn` runs commands through the handle. All-or-nothing.
- Nested `transaction()` calls join the outer transaction (no savepoints in v0.1).
- Gizmo drags, slider drags and text inputs must commit **one** transaction at the end of the interaction, never per frame (`05 §7`, `INV-CMD-06`).
- Agent runs: every model step's tool calls form one transaction labeled with the step summary; all transactions share `runId`. `UndoService.revertRun(runId)` reverts them all.

## 6. Undo model

- One Yjs `UndoManager` per **author id**, created lazily, with `trackedOrigins = new Set([serializeAuthor(author)])` and `captureTimeout = 0` (grouping is explicit via transactions; consecutive commands in one transaction are one stack item because they happen in one Yjs transaction).
- Users undo only their own transactions; agent runs have their own stack per `runId`; remote peers' changes are never on a local stack (ADR-0004, Yjs origin filtering).
- `revertRun(runId)` undoes every stack item of that run's manager, newest first, as one Tessera transaction with `author.kind = 'system'`, label `Revert run <id>`.
- Redo stacks clear when a new transaction by the same author commits.
- Undo of an operation whose target was concurrently modified by another author applies structurally (Yjs semantics); the resulting document must still satisfy the invariants — the post-check in §4.7 verifies and, on violation, applies a repair transaction (e.g., re-parents an orphan to root) and logs `core.undo.repaired`.
- History entries carry the change set so the UI can render a timeline without replaying.

## 7. Change set derivation

- During a transaction, core subscribes to `ydoc.on('afterTransaction')` and to deep observers on `entities`, `assets`, `behaviors`, `environment`, `settings` collected for that transaction only.
- For each Y.Map key event: `action: 'add' | 'update' | 'delete'`, `oldValue` from the event's `changes.keys`. Field paths are built from the map's position in the tree.
- Entity created = `entities.<id>` added; deleted = removed (its `EntitySnapshot` comes from `oldValue`); updated = any nested field change.
- Changes are coalesced per path (first `before`, last `after`); no-op changes (`before` deep-equals `after`) are dropped.
- `summary` is generated by `summarizeChangeSet` with fixed templates (no model call), e.g. `Created 3 entities; moved oak_01; changed material bark`.
- Remote updates (Yjs updates whose origin is not a local author) also produce change sets and fire `document.changed` with `origin: 'remote-unknown'` or the peer's author when known.

## 8. Command catalog v0.1

All names are also the LLM tool names. Inputs are Zod objects; `EntityRef = EntityId | { path: string }` is accepted wherever an entity is addressed and resolved during semantic validation (`NOT_FOUND` on failure).

### 8.1 Entities (tier 1)
| Command | Input | Output | Validation / behavior |
| --- | --- | --- | --- |
| `entity.create` | `{ name?: string; parent?: EntityRef \| null; components?: Partial<Components> (transform optional, defaulted); after?: EntityRef; strictName?: boolean }` | `{ id }` | parent exists; name resolved per `03 §4.3`; order key generated after `after` or at end |
| `entity.delete` | `{ target: EntityRef }` | `{ deleted: EntityId[] }` | deletes subtree; clears `settings.mainCamera` if it pointed inside; detaches behaviors |
| `entity.duplicate` | `{ target: EntityRef; count?: 1–100; offset?: Vec3; parent?: EntityRef }` | `{ ids: EntityId[] }` | deep copy of subtree with new ids and `_NN` names; assets shared, not copied |
| `entity.rename` | `{ target; name: string; strictName? }` | `{ name }` | sibling uniqueness |
| `entity.setParent` | `{ target; parent: EntityRef \| null; after?: EntityRef; keepWorldTransform?: boolean (default true) }` | `{}` | cycle check; when `keepWorldTransform`, recomputes local transform (requires `spatial` math available in core: uses `three` math? No — core implements 4×4 TRS math itself in `internal/math`, ≤ 200 lines, tested) |
| `entity.reorder` | `{ target; after?: EntityRef \| null }` | `{ order }` | among current siblings |
| `entity.setEnabled` | `{ target; enabled: boolean }` | `{}` | |

### 8.2 Components (tier 1)
| Command | Input | Output | Validation |
| --- | --- | --- | --- |
| `component.add` | `{ target; type: ComponentType; value?: Partial<…> }` | `{}` | not already present; requirements (`rigidBody` needs `collider`) |
| `component.remove` | `{ target; type }` | `{}` | `transform` cannot be removed; removing `collider` removes `rigidBody` |
| `component.set` | `{ target; type; patch: Partial<…> }` | `{}` | deep-partial patch validated against the component schema |
| `transform.set` | `{ target; position?; rotation?; scale? }` | `{ transform }` | convenience for `component.set(transform)` |
| `transform.translate` | `{ target; delta: Vec3; space?: 'local' \| 'world' \| 'parent' (default parent) }` | `{ transform }` | |
| `transform.rotate` | `{ target; delta: Vec3 (deg); space? }` | `{ transform }` | result normalized |
| `transform.scale` | `{ target; factor: Vec3 \| number }` | `{ transform }` | result > 0 |
| `tags.add` / `tags.remove` | `{ target; tags: string[] }` | `{ tags }` | pattern per `03 §5.7` |
| `metadata.set` | `{ target; patch: Record<string, JsonValue \| null> }` | `{}` | `null` deletes a key; size limits |

### 8.3 Assets and materials (tier 1; `asset.import` tier 3)
| Command | Input | Output | Validation |
| --- | --- | --- | --- |
| `asset.create` | `{ asset: AssetInput }` | `{ id }` | full asset minus id/createdAt; blobs referenced must exist in the blob store (checked through `ReadContext.blobs.has(hash)`) |
| `asset.update` | `{ target: AssetId; patch }` | `{}` | kind cannot change |
| `asset.delete` | `{ target: AssetId; force?: boolean }` | `{}` | referenced assets → `CONFLICT` unless `force`, which clears references (slots → default) |
| `material.create` | `{ name?; material?: Partial<MaterialFields>; license?; provenance? }` | `{ id }` | shorthand for `asset.create(kind material)` with `provenance.source = 'derived'` default |
| `material.set` | `{ target: AssetId; patch }` | `{}` | |
| `material.assign` | `{ target: EntityRef; material: AssetId; slot?: number (default all) }` | `{ materials }` | entity has `meshRenderer` |
| `asset.import` | `{ blob: BlobRef \| { fileName, bytesRef } ; options? }` | `{ jobId }` | starts an import job (§9); the job's completion runs `asset.create` commands |

### 8.4 Environment and settings (tier 1)
| Command | Input |
| --- | --- |
| `environment.set` | `{ patch: Partial<Environment> }` |
| `settings.set` | `{ patch: { mainCamera?: EntityRef \| null; physics?: … } }` (units/up/handedness rejected) |
| `camera.setMain` | `{ target: EntityRef }` — must have a camera component |

### 8.5 Macros (tier 2; `@tessera/spatial`, phase 2)
Deterministic; documented algorithms in `spatial`; each expands to primitive commands in one transaction.
| Command | Input | Behavior |
| --- | --- | --- |
| `layout.placeOn` | `{ target; surface: EntityRef; anchor?: 'center' \| 'random' \| Vec2 (uv on the top face); margin?: number; align?: 'bottom' (default) }` | Positions `target` so its bounds rest on the top of `surface`'s bounds; keeps rotation |
| `layout.snapToGround` | `{ targets: EntityRef[]; ground?: EntityRef \| 'y0' }` | Moves along Y until bottom touches ground plane or the ground entity's top |
| `layout.alignTo` | `{ targets; reference: EntityRef; axes: ('x'\|'y'\|'z')[]; mode: 'min' \| 'center' \| 'max' }` | Aligns bounds faces/centers |
| `layout.distribute` | `{ targets; axis; spacing?: number \| 'even'; from?: Vec3; to?: Vec3 }` | Even distribution or fixed gap along a line |
| `layout.arrangeGrid` | `{ targets; columns: number; spacing: Vec2; origin?: Vec3; plane?: 'xz' \| 'xy' }` | Grid placement in order |
| `layout.scatter` | `{ template: EntityRef; surface: EntityRef; count: 1–500; seed: number; minDistance?: number; alignToNormal?: boolean; randomYaw?: boolean; scaleJitter?: number }` | Deterministic Poisson-disk scatter of duplicates on the surface top |
| `layout.lookAt` | `{ target; point: Vec3 \| EntityRef; up?: Vec3 }` | Rotation so local −Z faces the point |
| `layout.resolveOverlaps` | `{ targets; iterations?: number; ground?: … }` | Pushes overlapping bounds apart on XZ by minimal translation, ≤ N iterations |
| `camera.fit` | `{ camera: EntityRef; targets: EntityRef[] \| 'all'; padding?: number; direction?: 'keep' \| 'front' \| 'iso' \| 'top' }` | Positions a camera entity to frame targets |

Macro inputs accept `seed` where randomness exists; the same document + input yields the same output (`INV-CMD-08`).

## 9. Jobs

```ts
export interface JobQueue {
  enqueue<T>(spec: JobSpec<T>): JobHandle<T>;
  get(id: JobId): JobStatus | undefined;
  list(filter?: { kind?: string; state?: JobState }): readonly JobStatus[];
  cancel(id: JobId): void;
  readonly events: Emitter<{ 'job.updated': { status: JobStatus } }>;
}
export interface JobSpec<T> {
  readonly kind: 'import' | 'export' | 'generate' | 'bake' | (string & {});
  readonly label: string;
  readonly author: Author;
  run(ctx: { signal: AbortSignal; progress(p: number, message?: string): void; logger: Logger }): Promise<Result<T, TesseraError>>;
  /** Runs on the main thread after success; the only place a job touches the document. */
  commit?(result: T, bus: CommandBus): Result<void, TesseraError>;
}
export type JobState = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
```
Concurrency: at most 2 running jobs per kind by default; the queue is in-memory; results become document changes only through `commit` → command bus.

## 10. Queries v0.1 (tier 0)

| Query | Input | Output | Notes |
| --- | --- | --- | --- |
| `entity.get` | `{ target: EntityRef; includeChildren?: boolean }` | `Entity` (+ children ids) | |
| `entity.children` | `{ target: EntityRef \| null }` | `EntityId[]` ordered | |
| `scene.describe` | `{ root?: EntityRef; detail?: 'summary' \| 'outline' \| 'full'; maxDepth?: number (default 4); maxChars?: number (default 8000); includeAssets?: boolean }` | `{ text: string; truncated: boolean; entityCount: number }` | Format in §11 |
| `scene.find` | `{ name?: string (glob); tag?: string; component?: ComponentType; within?: EntityRef; limit?: number }` | `{ matches: { id; path }[] }` | |
| `scene.stats` | `{}` | counts, triangle totals (from asset stats), bounds of all | |
| `scene.measure` | `{ a: EntityRef; b?: EntityRef; mode: 'distance' \| 'bounds' \| 'gap' }` | numbers | uses `spatial` bounds |
| `asset.get` / `asset.list` | `{ id }` / `{ kind?; unused?: boolean }` | asset(s) | |
| `history.list` | `{ limit?: number; runId? }` | `TransactionRecord[]` | |
| `view.screenshot` | `{ width?: ≤ 2048; height?; camera?: EntityRef \| 'viewport' \| 'top' \| 'front' \| 'iso'; frame?: EntityRef[] \| 'all'; includeHelpers?: false }` | `{ imageRef: BlobRef; camera: CameraPose }` | engine-backed; `UNSUPPORTED` headless |
| `scene.raycast` | `{ origin: Vec3; direction: Vec3; maxDistance? }` | `{ hits: { id; point; normal; distance }[] }` | engine-backed |
| `view.getCamera` | `{}` | `CameraPose` | engine-backed |

Engine-backed queries are registered by `@tessera/engine` into the same `QueryRegistry` and are absent headless (`INV-ARCH-06`).

## 11. `scene.describe` output format

Designed for language models: compact, hierarchical, one line per entity, stable ordering (sibling order), fixed decimal precision (2 decimals for meters and degrees, 1 for scale unless non-uniform).

```
scene "Forest clearing" · 42 entities · 17 assets · env hdri:forest_1k exposure 1 tonemap neutral · main camera: /cameras/main
/
├─ ground [e_q1w2e3r4t5] mesh plane 40×40 mat:grass @0,0,0 tags:static
├─ forest [e_ab12cd34ef] group @0,0,0 (12 children)
│  ├─ oak_01 [e_7f3a9k2m1p] mesh oak(a_oak) mat:bark,leaves @3,0,-2 rot 0,45,0 bounds 2.1×6.3×2.0
│  ├─ oak_02 [e_…] mesh oak @-1.5,0,-4.2 rot 0,120,0
│  └─ … +9 more (use scene.describe root=/forest for all)
├─ sun [e_…] light directional 3lx #fff8e7 rot -45,30,0 shadows
└─ cameras [e_…] group (1 child)
   └─ main [e_…] camera persp fov50 @6,3,8 rot -15,35,0
```
Rules: transform fields omitted when default (`@0,0,0`, no `rot`, no `scale`); bounds shown for meshes at `outline` detail only for the first 2 levels; truncation per parent with a hint line; `full` detail prints every component field as `key=value`. The output for D1 stays ≤ 8 KB at default detail (`01 §8`).

## 12. Invariants

| Id | Invariant |
| --- | --- |
| INV-CMD-01 | A command whose input fails schema or semantic validation leaves the document byte-identical. |
| INV-CMD-02 | A handler returning `Err` or throwing leaves the document byte-identical (transaction aborted). |
| INV-CMD-03 | Every committed transaction has a non-empty change set or is dropped (no empty history entries). |
| INV-CMD-04 | `undo(scope)` followed by `redo(scope)` restores the exact canonical snapshot. |
| INV-CMD-05 | `execute` and `transaction` are synchronous and non-re-entrant: calling `execute` from inside a handler (instead of `ctx.run`) returns `CONFLICT`. |
| INV-CMD-06 | Interactive drags commit exactly one transaction. |
| INV-CMD-07 | Change set `before` values equal the pre-transaction snapshot and `after` values equal the post-transaction snapshot for every listed path. |
| INV-CMD-08 | Macros are deterministic given document + input (+ seed). |
| INV-CMD-09 | `revertRun(runId)` leaves no transaction of that run applied, even when interleaved with other authors' transactions. |
| INV-CMD-10 | Every command and query name in the registry has a Zod input schema, output schema, description and tier; a test enumerates the registry. |

## 13. Performance

Budgets from `01 §8`: primitive command ≤ 0.5 ms p95 on D1; 100-command transaction ≤ 16 ms; undo ≤ 16 ms; `scene.describe` ≤ 20 ms. Implementation notes: keep an in-memory index `Map<EntityId, { parent, children: sorted array }>` updated from Yjs events (never rebuilt per command); cache `pathOf`; derive change sets from events rather than diffing snapshots.

## 14. Test plan

- Registry enumeration test (`INV-CMD-10`).
- For every command: schema rejection, semantic rejection, success path, change set contents, undo/redo round-trip.
- Property test: random sequences of commands on D1 keep `validateDocument` green and `undo` all the way back reproduces the initial snapshot.
- Concurrency tests with two `Y.Doc`s exchanging updates: per-author undo isolation, `revertRun` with interleaving.
- Macro determinism tests with seeds; golden outputs for `scene.describe` on fixtures.
- Benchmarks: `command-bus.bench.ts`, `describe.bench.ts` with thresholds.
