import { Shell } from "@tessera/ui";
import type { ReactElement } from "react";
import type { EditorContext } from "./editor-context.js";
import { EditorProvider } from "./editor-context.js";

/**
 * Editor chrome around {@link EditorContext}.
 *
 * @public
 */
export function App(props: { readonly context: EditorContext }): ReactElement {
  return (
    <EditorProvider value={props.context}>
      <Shell />
    </EditorProvider>
  );
}
