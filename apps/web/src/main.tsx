import { invariant } from "@tessera/std";
import { createIndexedDbProjectStore } from "@tessera/storage";
import { createRoot } from "react-dom/client";
import { App } from "./app.js";
import { bootstrap } from "./bootstrap.js";

/**
 * Loads the engine module as a separate chunk without blocking first paint.
 *
 * @public
 */
export function loadEngineModule(): Promise<typeof import("./engine-entry.js")> {
  return import("./engine-entry.js");
}

const root = document.getElementById("root");
invariant(root !== null, "root element missing");

void createIndexedDbProjectStore().then((storage) => {
  const context = bootstrap({
    storage,
    search: window.location.search,
    isDev: import.meta.env.DEV,
  });
  createRoot(root).render(<App context={context} />);
  void loadEngineModule();
});
