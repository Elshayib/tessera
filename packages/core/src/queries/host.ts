import { ENGINE_QUERY_NAMES } from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import { err, invariant, tesseraError } from "@tessera/std";
import { createDocumentReader } from "../document-reader.js";
import type { DocumentHandle } from "../document-types.js";
import { assetGet, assetList } from "./asset.js";
import { invalidQueryInput } from "./define.js";
import { entityChildren, entityGet } from "./entity.js";
import { historyList } from "./history.js";
import { sceneDescribe, sceneFind, sceneMeasure, sceneStats } from "./scene.js";
import type { QueryContext, QueryDefinition, QueryHost, QueryRegistry } from "./types.js";

class Registry implements QueryRegistry {
  private readonly queries = new Map<string, QueryDefinition>();

  get(name: string): QueryDefinition | undefined {
    return this.queries.get(name);
  }

  has(name: string): boolean {
    return this.queries.has(name);
  }

  list(): readonly QueryDefinition[] {
    return [...this.queries.values()];
  }

  register(definition: QueryDefinition): void {
    invariant(!this.queries.has(definition.name), `duplicate query ${definition.name}`);
    this.queries.set(definition.name, definition);
  }
}

const CATALOG_HANDLERS: readonly QueryDefinition[] = [
  entityGet,
  entityChildren,
  sceneDescribe,
  sceneFind,
  sceneStats,
  sceneMeasure,
  assetGet,
  assetList,
  historyList,
];

/**
 * Headless query host for `QUERY_CATALOG` (`docs/04-command-bus.md` §10).
 *
 * @example
 * ```ts
 * const queries = createQueryHost(doc, { history: () => created.committed() });
 * queries.query("scene.describe", {});
 * ```
 *
 * @public
 */
export function createQueryHost(
  handle: DocumentHandle,
  options: { readonly history: QueryContext["history"] },
): QueryHost {
  const registry = new Registry();
  for (const definition of CATALOG_HANDLERS) {
    registry.register(definition);
  }
  const reader = createDocumentReader(handle.ydoc);
  const ctx: QueryContext = {
    doc: reader,
    clock: handle.clock,
    logger: handle.logger,
    history: options.history,
  };
  return {
    registry,
    query(name, input) {
      return runQuery(registry, ctx, name, input);
    },
  };
}

function runQuery(
  registry: QueryRegistry,
  ctx: QueryContext,
  name: string,
  input: unknown,
): Result<unknown, TesseraError> {
  if (isEngineQuery(name)) {
    return err(tesseraError("UNSUPPORTED", "engine query is not registered headless", { name }));
  }
  const definition = registry.get(name);
  if (definition === undefined) {
    return err(tesseraError("NOT_FOUND", "unknown query", { name }));
  }
  const parsed = definition.input.safeParse(input);
  if (!parsed.success) {
    return invalidQueryInput(name, parsed.error.issues);
  }
  return definition.handle(ctx, parsed.data);
}

function isEngineQuery(name: string): boolean {
  for (const engineName of ENGINE_QUERY_NAMES) {
    if (engineName === name) {
      return true;
    }
  }
  return false;
}
