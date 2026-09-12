import {
  en,
  Inspector,
  Outliner,
  SettingsPanel,
  Shell,
  useProviderSettingsStore,
  useSelectionStore,
} from "@tessera/ui";
import type { ReactElement } from "react";
import { useState } from "react";
import { AssetPanel } from "./asset-panel/asset-panel.js";
import { CreateMenu } from "./create-menu/create-menu.js";
import type { EditorContext } from "./editor-context.js";
import { EditorProvider, useEditor } from "./editor-context.js";
import { ProjectIo } from "./project-io/project-io-bar.js";
import { Viewport } from "./viewport/viewport.js";

const UI_AUTHOR = { kind: "user" as const, id: "ui" };

/**
 * Editor chrome around {@link EditorContext}.
 *
 * @public
 */
export function App(props: { readonly context: EditorContext }): ReactElement {
  return (
    <EditorProvider value={props.context}>
      <EditorShell />
    </EditorProvider>
  );
}

function EditorShell(): ReactElement {
  const editor = useEditor();
  const selection = useSelectionStore((state) => state.ids);
  const focusedId = useSelectionStore((state) => state.focusedId);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const inspectId = selection[0] ?? (focusedId === null ? undefined : focusedId);
  return (
    <Shell
      toolbar={
        <>
          <ProjectIo />
          <CreateMenu />
          <button
            type="button"
            aria-pressed={settingsOpen}
            onClick={() => {
              setSettingsOpen((open) => !open);
            }}
          >
            {en.shell.settings}
          </button>
        </>
      }
      outliner={
        <>
          <Outliner reader={editor.reader} bus={editor.commands} author={UI_AUTHOR} />
          <AssetPanel />
        </>
      }
      inspector={
        settingsOpen ? (
          <SettingsPanel
            vault={editor.keyVault}
            vaultEncrypted={false}
            usage={editor.usage}
            resolveClient={async (providerId) => {
              const settings = useProviderSettingsStore.getState();
              const { createWebLlmClient } = await import("./create-agent-runtime.js");
              return createWebLlmClient({
                vault: editor.keyVault,
                logger: editor.logger,
                clock: editor.clock,
                providerId,
                compatibleOrigin: settings.compatibleOrigin,
              });
            }}
          />
        ) : (
          <Inspector
            reader={editor.reader}
            bus={editor.commands}
            author={UI_AUTHOR}
            {...(inspectId === undefined ? {} : { entityId: inspectId })}
          />
        )
      }
      viewport={<Viewport />}
      jobs={{ jobs: editor.jobs }}
      chat={{
        transcripts: editor.transcripts,
        usage: editor.usage,
        projectId: "p_local00000",
        conversationId: "c_editor",
        selection,
        verify: editor.agentVerify,
        createRuntime: () => resolveEditorRuntime(editor),
        ...(focusedId === null ? {} : { focusedEntity: focusedId }),
      }}
    />
  );
}

async function resolveEditorRuntime(editor: EditorContext) {
  const settings = useProviderSettingsStore.getState();
  const { createWebAgentRuntime } = await import("./create-agent-runtime.js");
  const created = await createWebAgentRuntime({
    bus: editor.commands,
    queries: editor.queries,
    jobs: editor.jobs,
    logger: editor.logger,
    clock: editor.clock,
    vault: editor.keyVault,
    executor: settings.roles.executor,
    planner: settings.roles.planner,
    critic: settings.roles.critic,
    compatibleOrigin: settings.compatibleOrigin,
    transcripts: editor.transcripts,
    assets: editor.assets,
  });
  if (!created.ok) {
    return undefined;
  }
  return created.value;
}
