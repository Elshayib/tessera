import { Shell } from "@tessera/ui";
import type { ReactElement } from "react";
import { AssetPanel } from "./asset-panel/asset-panel.js";
import { CreateMenu } from "./create-menu/create-menu.js";
import type { EditorContext } from "./editor-context.js";
import { EditorProvider } from "./editor-context.js";
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
      <Shell viewport={<Viewport />} />
    </EditorProvider>
  );
}
