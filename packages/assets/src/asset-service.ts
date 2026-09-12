import type {
  Author,
  CommandBus,
  DocumentReader,
  JobQueue,
  TransactionRecord,
} from "@tessera/core";
import type { GenerationProvider, GenerationRequest } from "@tessera/generation";
import type { AssetId, EntityId, Vec3 } from "@tessera/schema";
import { AssetIdSchema, EntityIdSchema } from "@tessera/schema";
import type { Clock, Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import type { BlobStore } from "@tessera/storage";
import { planFromFetched, postCommitApply } from "./apply-fetched.js";
import type { DelayFn } from "./generate.js";
import { generateToPlan } from "./generate.js";
import type { ImportFile } from "./import-files.js";
import { planFromFile } from "./import-files.js";
import type {
  AssetInput,
  CommitPlanIds,
  CommitPlanOptions,
  EntityInput,
  ImportPlan,
} from "./import-plan.js";
import { type ImportJobHandle, importJobHandle } from "./job-handle.js";
import type { AssetSource, SearchItem, SearchPage } from "./sources/polyhaven.js";
import {
  type AssetSourceRegistry,
  createAssetSourceRegistry,
  requireSource,
} from "./sources/registry.js";
import type { ThumbnailService } from "./thumbnails.js";
import { nullThumbnailService } from "./thumbnails.js";

/**
 * Result of {@link AssetService.commitPlan}.
 *
 * @public
 */
export interface CommitPlanResult extends CommitPlanIds {
  readonly transaction: TransactionRecord;
}

/**
 * Search query (`08` §6 / §10).
 *
 * @public
 */
export interface SearchQuery {
  readonly text: string;
  readonly kind: "model" | "texture" | "hdri";
  readonly tags?: readonly string[];
  readonly page?: number;
  readonly pageSize?: number;
}

/**
 * Commit options for façade methods (`08` §10).
 *
 * @public
 */
export interface CommitOptions extends CommitPlanOptions {
  readonly setSky?: boolean;
  readonly target?: EntityId;
  readonly resolution?: "1k" | "2k" | "4k";
}

/**
 * Main-thread import façade (`08` §7.5 / §10).
 *
 * @public
 */
export interface AssetService {
  commitPlan(plan: ImportPlan, options: CommitPlanOptions): Result<CommitPlanResult, TesseraError>;
  importFiles(
    files: readonly ImportFile[],
    options?: CommitOptions,
    signal?: AbortSignal,
  ): Promise<Result<readonly ImportJobHandle[], TesseraError>>;
  search(
    sourceId: string,
    query: SearchQuery,
    signal?: AbortSignal,
  ): Promise<Result<SearchPage, TesseraError>>;
  addFromSource(
    sourceId: string,
    item: SearchItem,
    options?: CommitOptions,
    signal?: AbortSignal,
  ): Promise<Result<ImportJobHandle, TesseraError>>;
  generate(
    providerId: string,
    request: GenerationRequest,
    options?: CommitOptions,
    signal?: AbortSignal,
  ): Promise<Result<ImportJobHandle, TesseraError>>;
  listUnused(): readonly AssetId[];
  thumbnails: ThumbnailService;
  readonly sources: AssetSourceRegistry;
}

/**
 * Options for {@link createAssetService}.
 *
 * @public
 */
export interface CreateAssetServiceOptions {
  readonly bus: CommandBus;
  readonly jobs?: JobQueue;
  readonly blobs?: BlobStore;
  readonly clock?: Clock;
  readonly sources?: readonly AssetSource[];
  readonly providers?: Readonly<Record<string, GenerationProvider>>;
  readonly reader?: DocumentReader;
  readonly thumbnails?: ThumbnailService;
  readonly delay?: DelayFn;
}

/**
 * Creates an {@link AssetService} that commits import plans through the command bus.
 *
 * @example
 * ```ts
 * const service = createAssetService({ bus });
 * service.commitPlan(plan, { author: { kind: "user", id: "u1" } });
 * ```
 *
 * @public
 */
export function createAssetService(options: CreateAssetServiceOptions): AssetService {
  const sources = createAssetSourceRegistry(options.sources ?? []);
  const thumbnails = options.thumbnails ?? nullThumbnailService();
  const providers = options.providers ?? {};
  const missing = (code: TesseraError["code"], message: string): TesseraError =>
    tesseraError(code, message);

  const enqueuePlan = (
    kind: "import" | "generate",
    label: string,
    author: Author,
    etaSeconds: number,
    run: (ctx: {
      signal: AbortSignal;
      progress: (p: number, message?: string) => void;
    }) => Promise<Result<ImportPlan, TesseraError>>,
    after?: (
      ids: CommitPlanIds,
      run: (name: string, payload: unknown) => Result<unknown, TesseraError>,
    ) => Result<void, TesseraError>,
  ): Result<ImportJobHandle, TesseraError> => {
    const jobs = options.jobs;
    if (jobs === undefined) {
      return err(missing("UNSUPPORTED", "JobQueue is required for import and generate jobs"));
    }
    const handle = jobs.enqueue({
      kind,
      label,
      author,
      async run(ctx) {
        return run({ signal: ctx.signal, progress: ctx.progress });
      },
      commit(plan, bus) {
        const committed = commitPlan(bus, plan, { author }, after);
        if (!committed.ok) {
          return committed;
        }
        return ok(undefined);
      },
    });
    return ok(importJobHandle(handle, etaSeconds));
  };

  return {
    sources,
    thumbnails,
    commitPlan(plan, commitOptions) {
      return commitPlan(options.bus, plan, commitOptions);
    },
    async importFiles(files, commitOptions, signal) {
      const blobs = options.blobs;
      const clock = options.clock;
      if (blobs === undefined || clock === undefined) {
        return err(missing("UNSUPPORTED", "blobs and clock are required for importFiles"));
      }
      const author = commitOptions?.author ?? { kind: "user", id: "user" };
      const handles: ImportJobHandle[] = [];
      for (const file of files) {
        const queued = enqueuePlan("import", `Import ${file.name}`, author, 2, async (ctx) => {
          const merged = signal === undefined ? ctx.signal : abortEither(signal, ctx.signal);
          return planFromFile({ file, blobs, clock, signal: merged });
        });
        if (!queued.ok) {
          return queued;
        }
        handles.push(queued.value);
      }
      return ok(handles);
    },
    async search(sourceId, query, signal) {
      const source = requireSource(sources, sourceId);
      if (!source.ok) {
        return source;
      }
      return source.value.search(query, signal ?? new AbortController().signal);
    },
    async addFromSource(sourceId, item, commitOptions, signal) {
      const blobs = options.blobs;
      const clock = options.clock;
      if (blobs === undefined || clock === undefined) {
        return err(missing("UNSUPPORTED", "blobs and clock are required for addFromSource"));
      }
      const source = requireSource(sources, sourceId);
      if (!source.ok) {
        return source;
      }
      const author = commitOptions?.author ?? { kind: "user", id: "user" };
      return enqueuePlan(
        "import",
        `Import ${item.name}`,
        author,
        4,
        async (ctx) => {
          const merged = signal === undefined ? ctx.signal : abortEither(signal, ctx.signal);
          const fetched = await source.value.fetch(
            item,
            { resolution: commitOptions?.resolution ?? "1k" },
            blobs,
            merged,
          );
          if (!fetched.ok) {
            return fetched;
          }
          return planFromFetched({
            fetched: fetched.value,
            item,
            blobs,
            clock,
            signal: merged,
            ...(commitOptions?.setSky === undefined ? {} : { setSky: commitOptions.setSky }),
          });
        },
        (ids, run) => {
          if (commitOptions === undefined) {
            return ok(undefined);
          }
          return postCommitApply({
            item,
            assetIds: ids.assetIds,
            options: commitOptions,
            run,
          });
        },
      );
    },
    async generate(providerId, request, commitOptions, signal) {
      const blobs = options.blobs;
      const clock = options.clock;
      const provider = providers[providerId];
      if (blobs === undefined || clock === undefined) {
        return err(missing("UNSUPPORTED", "blobs and clock are required for generate"));
      }
      if (provider === undefined) {
        return err(tesseraError("NOT_FOUND", "generation provider not found", { providerId }));
      }
      const author = commitOptions?.author ?? { kind: "user", id: "user" };
      const estimated = await provider.estimate(request);
      const etaSeconds = estimated.ok
        ? estimated.value.seconds
        : provider.descriptor.typicalSeconds.mesh;
      return enqueuePlan(
        "generate",
        `Generate ${request.kind}`,
        author,
        etaSeconds,
        async (ctx) => {
          const merged = signal === undefined ? ctx.signal : abortEither(signal, ctx.signal);
          return generateToPlan({
            provider,
            request,
            blobs,
            clock,
            signal: merged,
            ...(options.delay === undefined ? {} : { delay: options.delay }),
            progress: ctx.progress,
          });
        },
      );
    },
    listUnused() {
      const reader = options.reader;
      if (reader === undefined) {
        return [];
      }
      return listUnusedAssets(reader);
    },
  };
}

/**
 * Executes `asset.create` and `entity.create` in one transaction labeled `Import <fileName>`.
 *
 * @public
 */
export function commitPlan(
  bus: CommandBus,
  plan: ImportPlan,
  options: CommitPlanOptions,
  after?: (
    ids: CommitPlanIds,
    run: (name: string, payload: unknown) => Result<unknown, TesseraError>,
  ) => Result<void, TesseraError>,
): Result<CommitPlanResult, TesseraError> {
  const fileName =
    plan.blobs.find((blob) => blob.mime === "model/gltf-binary")?.fileName ??
    plan.blobs[0]?.fileName ??
    "untitled";
  const author: Author = options.author;
  const idMap = new Map<string, string>();
  const result = bus.transaction({ author, label: `Import ${fileName}` }, (tx) => {
    const assetIds: AssetId[] = [];
    for (const asset of sortForCommit(plan.assets)) {
      const created = tx.run("asset.create", { asset: remapUnknown(omitId(asset), idMap) });
      if (!created.ok) {
        return created;
      }
      const id = readAssetId(created.value);
      if (!id.ok) {
        return id;
      }
      idMap.set(asset.id, id.value);
      assetIds.push(id.value);
    }
    const entityIds: EntityId[] = [];
    for (const entity of plan.entities ?? []) {
      const created = tx.run("entity.create", entityCreateInput(entity, idMap, options));
      if (!created.ok) {
        return created;
      }
      const id = readEntityId(created.value);
      if (!id.ok) {
        return id;
      }
      idMap.set(entity.id, id.value);
      entityIds.push(id.value);
    }
    const ids = { assetIds, entityIds };
    if (after !== undefined) {
      const extra = after(ids, (name, payload) => tx.run(name, payload));
      if (!extra.ok) {
        return extra;
      }
    }
    return ok(ids);
  });
  if (!result.ok) {
    return result;
  }
  return ok({
    assetIds: result.value.value.assetIds,
    entityIds: result.value.value.entityIds,
    transaction: result.value.transaction,
  });
}

function listUnusedAssets(reader: DocumentReader): AssetId[] {
  const used = new Set<string>();
  const visit = (value: unknown): void => {
    if (typeof value === "string" && value.startsWith("a_")) {
      used.add(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        visit(entry);
      }
      return;
    }
    if (typeof value === "object" && value !== null) {
      for (const entry of Object.values(value)) {
        visit(entry);
      }
    }
  };
  for (const entity of reader.entities()) {
    visit(entity.components);
  }
  const unused: AssetId[] = [];
  for (const asset of reader.assets()) {
    if (!used.has(asset.id)) {
      unused.push(asset.id);
    }
  }
  return unused;
}

function abortEither(left: AbortSignal, right: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const abort = (): void => {
    controller.abort();
  };
  if (left.aborted || right.aborted) {
    controller.abort();
    return controller.signal;
  }
  left.addEventListener("abort", abort, { once: true });
  right.addEventListener("abort", abort, { once: true });
  return controller.signal;
}

function entityCreateInput(
  entity: EntityInput,
  idMap: Map<string, string>,
  options: CommitPlanOptions,
): {
  readonly name: string;
  readonly parent: CommitPlanOptions["parent"] | string | null;
  readonly components?: EntityInput["components"];
} {
  const parent =
    entity.parent === null ? (options.parent ?? null) : (idMap.get(entity.parent) ?? entity.parent);
  const remapped = remapUnknown(entity.components ?? {}, idMap);
  const components = isPartialComponents(remapped)
    ? offsetRoot(entity, remapped, options.position)
    : undefined;
  return {
    name: entity.name,
    parent,
    ...(components === undefined ? {} : { components }),
  };
}

function offsetRoot(
  entity: EntityInput,
  components: NonNullable<EntityInput["components"]>,
  position: Vec3 | undefined,
): NonNullable<EntityInput["components"]> {
  if (entity.parent !== null || position === undefined) {
    return components;
  }
  const transform = components.transform;
  if (transform === undefined) {
    return {
      ...components,
      transform: { position, rotation: [0, 0, 0], scale: [1, 1, 1] },
    };
  }
  return {
    ...components,
    transform: {
      ...transform,
      position: [
        transform.position[0] + position[0],
        transform.position[1] + position[1],
        transform.position[2] + position[2],
      ],
    },
  };
}

function isPartialComponents(value: unknown): value is NonNullable<EntityInput["components"]> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function omitId(asset: AssetInput): unknown {
  const { id: _id, ...rest } = asset;
  return rest;
}

function sortForCommit(assets: readonly AssetInput[]): AssetInput[] {
  const order = { texture: 0, material: 1, geometry: 2, environment: 3, script: 4 };
  return [...assets].sort((left, right) => order[left.kind] - order[right.kind]);
}

function remapUnknown(value: unknown, idMap: Map<string, string>): unknown {
  if (typeof value === "string") {
    return idMap.get(value) ?? value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => remapUnknown(entry, idMap));
  }
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = remapUnknown(entry, idMap);
    }
    return out;
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readAssetId(value: unknown): Result<AssetId, TesseraError> {
  const id = readId(value);
  if (!id.ok) {
    return id;
  }
  const parsed = AssetIdSchema.safeParse(id.value);
  if (!parsed.success) {
    return err(tesseraError("INVARIANT_VIOLATION", "create did not return an asset id"));
  }
  return ok(parsed.data);
}

function readEntityId(value: unknown): Result<EntityId, TesseraError> {
  const id = readId(value);
  if (!id.ok) {
    return id;
  }
  const parsed = EntityIdSchema.safeParse(id.value);
  if (!parsed.success) {
    return err(tesseraError("INVARIANT_VIOLATION", "create did not return an entity id"));
  }
  return ok(parsed.data);
}

function readId(value: unknown): Result<string, TesseraError> {
  if (!isRecord(value)) {
    return err(tesseraError("INVARIANT_VIOLATION", "create did not return an id"));
  }
  const idKey = "id";
  const id = value[idKey];
  if (typeof id !== "string") {
    return err(tesseraError("INVARIANT_VIOLATION", "create did not return an id"));
  }
  return ok(id);
}
