import { Shell } from "@tessera/ui";
import type { ReactElement } from "react";
import { CreateMenu } from "./create-menu/create-menu.js";
import type { EditorContext } from "./editor-context.js";
import { EditorProvider } from "./editor-context.js";
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
      <Shell viewport={<Viewport />} />
    </EditorProvider>
  );
}
