import { SettingsPanel, Shell, useSelectionStore } from "@tessera/ui";
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
        ...(focusedId === null ? {} : { focusedEntity: focusedId }),
      }}
    />
  );
}
