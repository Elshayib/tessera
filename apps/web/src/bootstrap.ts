import { createUsageLedger } from "@tessera/agent/observability";
import { createAssetService, createFetchTransport, createPolyHavenSource } from "@tessera/assets";
import {
  createCommandBus,
  createDocument,
  createJobQueue,
  createQueryHost,
  createUndoService,
} from "@tessera/core";
import type { KeyVault } from "@tessera/llm";
import { createLogger, systemClock } from "@tessera/std";
import type { ProjectStore } from "@tessera/storage";
import { MemoryBlobStore, MemoryProjectStore } from "@tessera/storage";
import { createBrowserKeyVault } from "./browser-key-vault.js";
import { createBrowserTranscriptStore } from "./browser-transcript-store.js";
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
  readonly keyVault?: KeyVault;
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
  const queries = Object.assign(queryHost.registry, {
    query: queryHost.query.bind(queryHost),
  });
  const storage = options.storage ?? new MemoryProjectStore({ clock });
  const flags = parseFlags(options.search ?? "", options.isDev === true);
  const context: EditorContext = {
    document: created.doc,
    commands,
    queries,
    undo: undoCreated.undo,
    jobs,
    components: { names: [] },
    storage,
    assets: createAssetService({
      bus: commands,
      jobs,
      blobs: new MemoryBlobStore(),
      clock,
      sources: [createPolyHavenSource({ transport: createFetchTransport(), clock })],
      reader: created.reader,
    }),
    logger,
    clock,
    flags,
    agentVerify: bootstrapVerifyMode(flags),
    transcripts: createBrowserTranscriptStore(),
    usage: createUsageLedger(),
    keyVault: options.keyVault ?? createBrowserKeyVault({ clock, logger }),
  };
  return context;
}
