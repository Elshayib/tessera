import type { CommandSchema } from "@tessera/schema";
import type { Clock, Emitter, Logger, Result, TesseraError } from "@tessera/std";
import type { ChangeSet } from "./change-set.js";
import type { DocumentReader } from "./document-types.js";
import type { DocumentWriter } from "./internal/document-writer.js";

/**
 * Author of a transaction (`docs/04-command-bus.md` §2).
 *
 * @public
 */
export interface Author {
  readonly kind: "user" | "agent" | "remote" | "system";
  readonly id: string;
  readonly runId?: string;
}

/**
 * Registered command: catalog schema plus validate/handle (`docs/04-command-bus.md` §3).
 *
 * @public
 */
export interface CommandDefinition<I = unknown, O = unknown> extends CommandSchema<I, O> {
  validate?(ctx: ReadContext, input: I): Result<void, TesseraError>;
  handle(ctx: WriteContext, input: I): Result<O, TesseraError>;
}

/**
 * Blob existence check used by `asset.create` (`docs/04-command-bus.md` §8.3).
 *
 * @public
 */
export interface BlobPresence {
  has(hash: string): boolean;
}

/**
 * Read-only command context.
 *
 * @public
 */
export interface ReadContext {
  readonly doc: DocumentReader;
  readonly registry: object;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly blobs?: BlobPresence;
}

/**
 * Mutating command context. `write` is the only Yjs mutator.
 *
 * @public
 */
export interface WriteContext extends ReadContext {
  readonly write: DocumentWriter;
  readonly author: Author;
  readonly transactionId: string;
  run(name: string, input: unknown): Result<unknown, TesseraError>;
  newId(prefix: "e" | "a" | "b"): string;
}

/**
 * Options for {@link CommandBus.execute} / {@link CommandBus.transaction}.
 *
 * @public
 */
export interface ExecuteOptions {
  readonly author: Author;
  readonly label?: string;
  readonly runId?: string;
  readonly dryRun?: boolean;
}

/**
 * Outcome of a single {@link CommandBus.execute}.
 *
 * @public
 */
export interface CommandOutcome<O> {
  readonly output: O;
  readonly transaction: TransactionRecord;
}

/**
 * Outcome of {@link CommandBus.transaction}.
 *
 * @public
 */
export interface TransactionOutcome<T> {
  readonly value: T;
  readonly transaction: TransactionRecord;
}

/**
 * Recorded transaction (`docs/04-command-bus.md` §3).
 *
 * @public
 */
export interface TransactionRecord {
  readonly id: string;
  readonly author: Author;
  readonly label: string;
  readonly runId?: string;
  readonly startedAt: string;
  readonly durationMs: number;
  readonly commands: readonly { readonly name: string; readonly input: unknown }[];
  readonly changeSet: ChangeSet;
}

/**
 * Events emitted by the command bus.
 *
 * @public
 */
export type CommandBusEvents = {
  "transaction.committed": { readonly transaction: TransactionRecord };
  "transaction.rejected": {
    readonly name: string;
    readonly error: TesseraError;
    readonly author: Author;
  };
  "document.changed": {
    readonly changeSet: ChangeSet;
    readonly origin: Author | "remote-unknown";
  };
};

/**
 * Handle used inside {@link CommandBus.transaction}.
 *
 * @public
 */
export interface TransactionHandle {
  run(name: string, input: unknown): Result<unknown, TesseraError>;
  readonly id: string;
}

/**
 * Command registry (`INV-CMD-10`).
 *
 * @public
 */
export interface CommandRegistry {
  get(name: string): CommandDefinition | undefined;
  has(name: string): boolean;
  list(): readonly CommandDefinition[];
  register(definition: CommandDefinition): void;
}

/**
 * Command bus (`docs/04-command-bus.md` §3).
 *
 * @public
 */
export interface CommandBus {
  execute(
    name: string,
    input: unknown,
    options: ExecuteOptions,
  ): Result<CommandOutcome<unknown>, TesseraError>;
  transaction<T>(
    options: ExecuteOptions,
    fn: (tx: TransactionHandle) => Result<T, TesseraError>,
  ): Result<TransactionOutcome<T>, TesseraError>;
  readonly registry: CommandRegistry;
  readonly events: Emitter<CommandBusEvents>;
}
