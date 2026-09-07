import { validateDocument } from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import { Emitter, err, invariant, newId, ok, tesseraError } from "@tessera/std";
import type { ChangeSet } from "./change-set.js";
import { deriveChangeSet, isChangeSetEmpty } from "./change-set.js";
import type {
  Author,
  BlobPresence,
  CommandBus,
  CommandBusEvents,
  CommandDefinition,
  CommandRegistry,
  ExecuteOptions,
  ReadContext,
  TransactionHandle,
  TransactionOutcome,
  TransactionRecord,
  WriteContext,
} from "./command-types.js";
import { CATALOG_HANDLERS } from "./commands/index.js";
import { createDocumentReader } from "./document-reader.js";
import type { DocumentHandle } from "./document-types.js";
import { createDocumentWriter } from "./internal/document-writer.js";
import { summarizeChangeSet } from "./summarize-change-set.js";
import { isTransactionAbort, serializeAuthor, TransactionAbort } from "./transaction.js";
import { fromYDoc, restoreSnapshot } from "./yjs-mapping.js";

export type {
  Author,
  BlobPresence,
  CommandBus,
  CommandBusEvents,
  CommandDefinition,
  CommandOutcome,
  CommandRegistry,
  ExecuteOptions,
  ReadContext,
  TransactionHandle,
  TransactionOutcome,
  TransactionRecord,
  WriteContext,
} from "./command-types.js";

/**
 * Options for {@link createCommandBus}.
 *
 * @public
 */
export interface CreateCommandBusOptions {
  readonly blobs?: BlobPresence;
}

class Registry implements CommandRegistry {
  private readonly commands = new Map<string, CommandDefinition>();

  get(name: string): CommandDefinition | undefined {
    return this.commands.get(name);
  }

  has(name: string): boolean {
    return this.commands.has(name);
  }

  list(): readonly CommandDefinition[] {
    return [...this.commands.values()];
  }

  register(definition: CommandDefinition): void {
    invariant(!this.commands.has(definition.name), `duplicate command ${definition.name}`);
    this.commands.set(definition.name, definition);
  }
}

interface ActiveTransaction {
  readonly id: string;
  readonly author: Author;
  readonly commands: { name: string; input: unknown }[];
  label: string | undefined;
  changeSet: ChangeSet | undefined;
}

/**
 * Creates a command bus over a live document (`docs/04-command-bus.md` §3–§5).
 *
 * @example
 * ```ts
 * const { doc } = createDocument();
 * const bus = createCommandBus(doc);
 * bus.execute("entity.create", { name: "oak" }, { author: { kind: "user", id: "u1" } });
 * ```
 *
 * @public
 */
export function createCommandBus(
  handle: DocumentHandle,
  options: CreateCommandBusOptions = {},
): CommandBus {
  const registry = new Registry();
  for (const definition of CATALOG_HANDLERS) {
    registry.register(definition);
  }
  const events = new Emitter<CommandBusEvents>({ logger: handle.logger });
  const reader = createDocumentReader(handle.ydoc);
  const writer = createDocumentWriter(handle.ydoc);
  const componentRegistry = {};

  let active = false;
  let inHandler = false;
  let nestedJoin: ActiveTransaction | undefined;

  const createRead = (): ReadContext => {
    const base = {
      doc: reader,
      registry: componentRegistry,
      clock: handle.clock,
      logger: handle.logger,
    };
    if (options.blobs === undefined) {
      return base;
    }
    return { ...base, blobs: options.blobs };
  };

  const runInside = (
    session: ActiveTransaction,
    name: string,
    input: unknown,
  ): Result<unknown, TesseraError> => {
    const definition = registry.get(name);
    if (definition === undefined) {
      return err(tesseraError("NOT_FOUND", "unknown command", { name }));
    }
    const parsed = definition.input.safeParse(input);
    if (!parsed.success) {
      return err(
        tesseraError("INVALID_INPUT", "invalid command input", {
          name,
          issues: parsed.error.issues,
        }),
      );
    }
    const writeCtx: WriteContext = {
      ...createRead(),
      write: writer,
      author: session.author,
      transactionId: session.id,
      run: (nestedName, nestedInput) => runInside(session, nestedName, nestedInput),
      newId: (prefix) => newId(prefix),
    };
    if (definition.validate !== undefined) {
      const validated = definition.validate(writeCtx, parsed.data);
      if (!validated.ok) {
        return validated;
      }
    }
    inHandler = true;
    let handled: Result<unknown, TesseraError>;
    try {
      handled = definition.handle(writeCtx, parsed.data);
    } catch (caught) {
      if (isTransactionAbort(caught)) {
        throw caught;
      }
      const message = caught instanceof Error ? caught.message : "handler threw";
      throw new TransactionAbort(tesseraError("INVARIANT_VIOLATION", message));
    } finally {
      inHandler = false;
    }
    if (!handled.ok) {
      throw new TransactionAbort(handled.error);
    }
    session.commands.push({ name, input: parsed.data });
    if (session.label === undefined) {
      session.label = definition.description;
    }
    return handled;
  };

  const commitTransaction = <T>(
    optionsIn: ExecuteOptions,
    fn: (tx: TransactionHandle) => Result<T, TesseraError>,
  ): Result<TransactionOutcome<T>, TesseraError> => {
    const outer = nestedJoin;
    if (outer !== undefined) {
      const tx: TransactionHandle = {
        id: outer.id,
        run: (name, input) => runInside(outer, name, input),
      };
      const joined = fn(tx);
      if (!joined.ok) {
        throw new TransactionAbort(joined.error);
      }
      return ok({
        value: joined.value,
        transaction: emptyRecord(outer, optionsIn),
      });
    }

    if (active) {
      return err(
        tesseraError("CONFLICT", "execute from a handler must use ctx.run", {
          invariant: "INV-CMD-05",
        }),
      );
    }

    const startedAtMs = handle.clock.now();
    const startedAt = handle.clock.nowIso();
    const session: ActiveTransaction = {
      id: newId("t"),
      author: optionsIn.author,
      commands: [],
      label: optionsIn.label,
      changeSet: undefined,
    };
    const origin = serializeAuthor(optionsIn.author);
    const before = fromYDoc(handle.ydoc);
    let stored: { readonly value: T } | undefined;
    active = true;
    nestedJoin = session;
    try {
      handle.ydoc.transact(() => {
        const tx: TransactionHandle = {
          id: session.id,
          run: (name, input) => runInside(session, name, input),
        };
        const ran = fn(tx);
        if (!ran.ok) {
          throw new TransactionAbort(ran.error);
        }
        stored = { value: ran.value };
        let after = fromYDoc(handle.ydoc);
        let changeSet = withSummary(deriveChangeSet(before, after, ""));
        if (!isChangeSetEmpty(changeSet)) {
          const bumped = writer.setMeta({ ...after.meta, updatedAt: handle.clock.nowIso() });
          if (!bumped.ok) {
            throw new TransactionAbort(bumped.error);
          }
          after = fromYDoc(handle.ydoc);
          changeSet = withSummary(deriveChangeSet(before, after, ""));
        }
        const report = validateDocument(after);
        if (!report.ok) {
          handle.logger.error("core.command.invariant", {
            name: session.commands[0]?.name ?? "transaction",
            issueCount: report.issues.length,
          });
          throw new TransactionAbort(
            tesseraError("INVARIANT_VIOLATION", "document failed post-check", {
              issues: report.issues,
            }),
          );
        }
        session.changeSet = changeSet;
      }, origin);
    } catch (caught) {
      active = false;
      nestedJoin = undefined;
      if (isTransactionAbort(caught)) {
        restoreSnapshot(handle.ydoc, before);
        events.emit("transaction.rejected", {
          name: session.commands[0]?.name ?? optionsIn.label ?? "transaction",
          error: caught.error,
          author: optionsIn.author,
        });
        return err(caught.error);
      }
      throw caught;
    }
    active = false;
    nestedJoin = undefined;
    invariant(stored !== undefined, "transaction produced a value");
    const changeSet = session.changeSet;
    invariant(changeSet !== undefined, "transaction produced a change set");
    const record = makeRecord(session, optionsIn, startedAt, handle.clock.now() - startedAtMs);
    if (isChangeSetEmpty(changeSet)) {
      return ok({ value: stored.value, transaction: record });
    }
    events.emit("transaction.committed", { transaction: record });
    events.emit("document.changed", { changeSet, origin: optionsIn.author });
    return ok({ value: stored.value, transaction: record });
  };

  return {
    registry,
    events,
    execute(name, input, executeOptions) {
      if (inHandler) {
        const conflict = tesseraError("CONFLICT", "execute from a handler must use ctx.run", {
          invariant: "INV-CMD-05",
        });
        events.emit("transaction.rejected", {
          name,
          error: conflict,
          author: executeOptions.author,
        });
        return err(conflict);
      }
      const result = commitTransaction(executeOptions, (tx) => tx.run(name, input));
      if (!result.ok) {
        return result;
      }
      return ok({
        output: result.value.value,
        transaction: result.value.transaction,
      });
    },
    transaction(executeOptions, fn) {
      return commitTransaction(executeOptions, fn);
    },
  };
}

function withSummary(changeSet: ChangeSet): ChangeSet {
  return { ...changeSet, summary: summarizeChangeSet(changeSet) };
}

function makeRecord(
  session: ActiveTransaction,
  optionsIn: ExecuteOptions,
  startedAt: string,
  durationMs: number,
): TransactionRecord {
  const changeSet = session.changeSet ?? {
    entities: { created: [], deleted: [], updated: [] },
    assets: { created: [], deleted: [], updated: [] },
    behaviors: { created: [], deleted: [], updated: [] },
    summary: "No changes",
  };
  const base = {
    id: session.id,
    author: optionsIn.author,
    label: session.label ?? optionsIn.label ?? "transaction",
    startedAt,
    durationMs,
    commands: session.commands,
    changeSet,
  };
  if (optionsIn.runId === undefined) {
    return base;
  }
  return { ...base, runId: optionsIn.runId };
}

function emptyRecord(session: ActiveTransaction, optionsIn: ExecuteOptions): TransactionRecord {
  return makeRecord(session, optionsIn, "", 0);
}
