import type { AssetService } from "@tessera/assets";
import type {
  CommandBus,
  DocumentHandle,
  JobQueue,
  QueryRegistry,
  UndoService,
} from "@tessera/core";
import type { EngineHandle } from "@tessera/engine";
import type { Clock, Logger } from "@tessera/std";
import { invariant } from "@tessera/std";
import type { ProjectStore } from "@tessera/storage";
import type { ReactElement, ReactNode } from "react";
import { createContext, useContext } from "react";
import type { Flags } from "./flags.js";

/**
 * Placeholder until plugin ComponentRegistry exists (Q-0065).
 *
 * @public
 */
export interface ComponentRegistry {
  readonly names: readonly string[];
}

/**
 * Composition root (`02` §7).
 *
 * @public
 */
export interface EditorContext {
  readonly document: DocumentHandle;
  readonly commands: CommandBus;
  readonly queries: QueryRegistry;
  readonly undo: UndoService;
  readonly jobs: JobQueue;
  readonly components: ComponentRegistry;
  readonly storage: ProjectStore;
  readonly assets: AssetService;
  readonly engine?: EngineHandle;
  readonly logger: Logger;
  readonly clock: Clock;
  readonly flags: Flags;
  readonly agentVerify: "none" | "spatial" | "spatial+vision";
}

const EditorReactContext = createContext<EditorContext | undefined>(undefined);

/**
 * Provides {@link EditorContext} to the editor tree.
 *
 * @public
 */
export function EditorProvider(props: {
  readonly value: EditorContext;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <EditorReactContext.Provider value={props.value}>{props.children}</EditorReactContext.Provider>
  );
}

/**
 * Reads {@link EditorContext} from React context.
 *
 * @public
 */
export function useEditor(): EditorContext {
  const value = useContext(EditorReactContext);
  invariant(value !== undefined, "EditorProvider is required");
  return value;
}
