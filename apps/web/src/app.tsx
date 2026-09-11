import { SettingsPanel, Shell, useProviderSettingsStore, useSelectionStore } from "@tessera/ui";
import type { ReactElement } from "react";
import { AssetPanel } from "./asset-panel/asset-panel.js";
import { CreateMenu } from "./create-menu/create-menu.js";
import type { EditorContext } from "./editor-context.js";
import { EditorProvider, useEditor } from "./editor-context.js";
import { ProjectIo } from "./project-io/project-io-bar.js";
import { Viewport } from "./viewport/viewport.js";

/**
 * Editor chrome around {@link EditorContext}.
 *
 * @public
 */
export function App(props: { readonly context: EditorContext }): ReactElement {
  return (
    <EditorProvider value={props.context}>
      <CreateMenu />
      <AssetPanel />
      <ProjectIo />
      <SettingsPanel
        vault={props.context.keyVault}
        vaultEncrypted={false}
        usage={props.context.usage}
        resolveClient={async (providerId) => {
          const settings = useProviderSettingsStore.getState();
          const { createWebLlmClient } = await import("./create-agent-runtime.js");
          return createWebLlmClient({
            vault: props.context.keyVault,
            logger: props.context.logger,
            clock: props.context.clock,
            providerId,
            compatibleOrigin: settings.compatibleOrigin,
          });
        }}
      />
      <EditorShell />
    </EditorProvider>
  );
}

function EditorShell(): ReactElement {
  const editor = useEditor();
  const selection = useSelectionStore((state) => state.ids);
  const focusedId = useSelectionStore((state) => state.focusedId);
  return (
    <Shell
      viewport={<Viewport />}
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
  });
  if (!created.ok) {
    return undefined;
  }
  return created.value;
}
