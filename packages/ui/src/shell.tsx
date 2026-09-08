import type { ReactElement, ReactNode } from "react";
import { en } from "./i18n/en.js";
import { useLayoutStore } from "./layout-store.js";
import { TOKENS_CSS } from "./tokens.js";
import { ViewportHost } from "./viewport-host.js";

/**
 * Editor chrome: resizable regions. Presentational only — no command bus (T-0112).
 *
 * @example
 * ```tsx
 * <Shell viewport={<Viewport />} />
 * ```
 *
 * @public
 */
export function Shell(props: { readonly viewport?: ReactNode } = {}): ReactElement {
  const outlinerWidth = useLayoutStore((state) => state.outlinerWidth);
  const inspectorWidth = useLayoutStore((state) => state.inspectorWidth);
  const chatHeight = useLayoutStore((state) => state.chatHeight);
  const setOutlinerWidth = useLayoutStore((state) => state.setOutlinerWidth);
  const setInspectorWidth = useLayoutStore((state) => state.setInspectorWidth);
  const setChatHeight = useLayoutStore((state) => state.setChatHeight);
  return (
    <div
      className="t-shell"
      style={{
        display: "grid",
        gridTemplateColumns: `${outlinerWidth}px minmax(0, 1fr) ${inspectorWidth}px`,
        gridTemplateRows: `minmax(0, 1fr) ${chatHeight}px`,
        minHeight: "100%",
        fontFamily: "var(--t-font-sans)",
        background: "var(--t-color-bg)",
        color: "var(--t-color-fg)",
      }}
    >
      <style>{TOKENS_CSS}</style>
      <section
        aria-label={en.shell.outliner}
        style={{ borderRight: "1px solid var(--t-color-border)" }}
      >
        <header>{en.shell.outliner}</header>
        <button type="button" onClick={() => setOutlinerWidth(outlinerWidth - 16)}>
          {en.shell.narrowOutliner}
        </button>
        <button type="button" onClick={() => setOutlinerWidth(outlinerWidth + 16)}>
          {en.shell.widenOutliner}
        </button>
      </section>
      <div style={{ display: "grid", gridTemplateRows: "minmax(0, 1fr)" }}>
        <section aria-label={en.shell.viewport}>
          <header>{en.shell.viewport}</header>
          {props.viewport ?? <ViewportHost />}
        </section>
      </div>
      <section
        aria-label={en.shell.inspector}
        style={{ borderLeft: "1px solid var(--t-color-border)" }}
      >
        <header>{en.shell.inspector}</header>
        <button type="button" onClick={() => setInspectorWidth(inspectorWidth - 16)}>
          {en.shell.narrowInspector}
        </button>
        <button type="button" onClick={() => setInspectorWidth(inspectorWidth + 16)}>
          {en.shell.widenInspector}
        </button>
      </section>
      <section
        aria-label={en.shell.chat}
        style={{ gridColumn: "1 / -1", borderTop: "1px solid var(--t-color-border)" }}
      >
        <header>{en.shell.chat}</header>
        <button type="button" onClick={() => setChatHeight(chatHeight - 16)}>
          {en.shell.shorterChat}
        </button>
        <button type="button" onClick={() => setChatHeight(chatHeight + 16)}>
          {en.shell.tallerChat}
        </button>
      </section>
    </div>
  );
}
