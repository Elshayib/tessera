import { createMemoryTranscriptStore, createUsageLedger } from "@tessera/agent/observability";
import { createAssetService } from "@tessera/assets";
import {
  createCommandBus,
  createDocument,
  createJobQueue,
  createQueryHost,
  createUndoService,
} from "@tessera/core";
import { createLogger, systemClock } from "@tessera/std";
import type { ProjectStore } from "@tessera/storage";
import { MemoryProjectStore } from "@tessera/storage";
import type { EditorContext } from "./editor-context.js";
import { bootstrapVerifyMode, parseFlags } from "./flags.js";

/**
 * Options for {@link bootstrap}.
 *
 * @public
 */
export interface BootstrapOptions {
  readonly storage?: ProjectStore;
  readonly search?: string;
  readonly isDev?: boolean;
}

/**
 * Builds {@link EditorContext} for an empty project.
 *
 * @example
 * ```ts
 * const ctx = bootstrap();
 * ```
 *
 * @public
 */
export function bootstrap(options: BootstrapOptions = {}): EditorContext {
  const clock = systemClock;
  const logger = createLogger([]);
  const created = createDocument({ clock, logger });
  const undoCreated = createUndoService(created.doc);
  const commands = createCommandBus(created.doc, { undo: undoCreated.capture });
  const jobs = createJobQueue(commands, { logger });
  const queryHost = createQueryHost(created.doc, { history: () => undoCreated.committed() });
  const storage = options.storage ?? new MemoryProjectStore({ clock });
  const flags = parseFlags(options.search ?? "", options.isDev === true);
  const context: EditorContext = {
    document: created.doc,
    commands,
    queries: queryHost.registry,
    undo: undoCreated.undo,
    jobs,
    components: { names: [] },
    storage,
    assets: createAssetService({ bus: commands }),
    logger,
    clock,
    flags,
    agentVerify: bootstrapVerifyMode(flags),
    transcripts: createMemoryTranscriptStore(),
    usage: createUsageLedger(),
  };
  return context;
}
