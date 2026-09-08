import type { QuerySchema } from "@tessera/schema";
import type { Clock, Logger, Result, TesseraError } from "@tessera/std";
import type { TransactionRecord } from "../command-types.js";
import type { DocumentReader } from "../document-types.js";

/**
 * Read context for headless queries (`docs/04-command-bus.md` §3).
 *
 * @public
 */
export interface QueryContext {
  readonly doc: DocumentReader;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly history: () => readonly TransactionRecord[];
}

/**
 * Registered query: catalog schema plus handle.
 *
 * @public
 */
export interface QueryDefinition<I = unknown, O = unknown> extends QuerySchema<I, O> {
  handle(ctx: QueryContext, input: I): Result<O, TesseraError>;
}

/**
 * Query registry (`INV-CMD-10`).
 *
 * @public
 */
export interface QueryRegistry {
  get(name: string): QueryDefinition | undefined;
  has(name: string): boolean;
  list(): readonly QueryDefinition[];
  register(definition: QueryDefinition): void;
}

/**
 * Headless query host.
 *
 * @public
 */
export interface QueryHost {
  readonly registry: QueryRegistry;
  query(name: string, input: unknown): Result<unknown, TesseraError>;
}
