import type { CSSProperties, ReactElement, ReactNode } from "react";
import type { ChatPanelProps } from "./chat/chat-panel.js";
import { ChatPanel } from "./chat/chat-panel.js";
import { en } from "./i18n/en.js";
import type { JobPanelProps } from "./jobs/job-panel.js";
import { JobPanel } from "./jobs/job-panel.js";
import { useLayoutStore } from "./layout-store.js";
import type { ReviewPanelProps } from "./review/review-panel.js";
import { ReviewPanel } from "./review/review-panel.js";
import { TOKENS_CSS } from "./tokens.js";
import { ViewportHost } from "./viewport-host.js";

const SHELL_CSS = `
.t-shell { height: 100%; overflow: hidden; box-sizing: border-box; }
.t-shell *, .t-shell *::before, .t-shell *::after { box-sizing: border-box; }
.t-shell header {
  display: flex; flex-wrap: wrap; align-items: center; gap: var(--t-space-1);
  padding: var(--t-space-2); font-weight: 600;
  border-bottom: 1px solid var(--t-color-border);
}
.t-shell button, .t-shell input, .t-shell select, .t-shell textarea {
  font: inherit; color: inherit; background: var(--t-color-bg);
  border: 1px solid var(--t-color-border); border-radius: var(--t-radius);
  padding: var(--t-space-1) var(--t-space-2);
}
.t-shell button:focus-visible, .t-shell input:focus-visible, .t-shell select:focus-visible {
  outline: var(--t-focus);
}
.t-region { min-height: 0; overflow: auto; }
.t-region-body { padding: var(--t-space-2); }
.t-toolbar {
  display: flex; flex-wrap: wrap; gap: var(--t-space-2); align-items: center;
  padding: var(--t-space-2); border-bottom: 1px solid var(--t-color-border);
  grid-column: 1 / -1;
}
.t-viewport-region { min-height: 0; overflow: hidden; position: relative; display: flex; flex-direction: column; }
.t-viewport-region canvas { width: 100%; height: 100%; display: block; flex: 1; min-height: 0; }
.t-chat-row { display: grid; grid-template-columns: minmax(12rem, 16rem) minmax(0, 1fr); min-height: 0; overflow: hidden; }
.t-chat-row > * { min-height: 0; overflow: auto; }
`;

const regionStyle = (extra?: CSSProperties): CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  ...extra,
});

/**
 * Editor chrome: resizable regions. Presentational only — no command bus (T-0112).
 *
 * @example
 * ```tsx
 * <Shell viewport={<Viewport />} outliner={<Outliner />} inspector={<Inspector />} />
 * ```
 *
 * @public
 */
export function Shell(
  props: {
    readonly toolbar?: ReactNode;
    readonly outliner?: ReactNode;
    readonly inspector?: ReactNode;
    readonly viewport?: ReactNode;
    readonly review?: ReviewPanelProps;
    readonly chat?: ChatPanelProps;
    readonly jobs?: JobPanelProps;
  } = {},
): ReactElement {
  const outlinerWidth = useLayoutStore((state) => state.outlinerWidth);
  const inspectorWidth = useLayoutStore((state) => state.inspectorWidth);
  const chatHeight = useLayoutStore((state) => state.chatHeight);
  const setOutlinerWidth = useLayoutStore((state) => state.setOutlinerWidth);
  const setInspectorWidth = useLayoutStore((state) => state.setInspectorWidth);
  const setChatHeight = useLayoutStore((state) => state.setChatHeight);
  const rows =
    props.toolbar === undefined
      ? `minmax(0, 1fr) ${String(chatHeight)}px`
      : `auto minmax(0, 1fr) ${String(chatHeight)}px`;
  return (
    <div
      className="t-shell"
      style={{
        display: "grid",
        gridTemplateColumns: `${String(outlinerWidth)}px minmax(0, 1fr) ${String(inspectorWidth)}px`,
        gridTemplateRows: rows,
        minHeight: "100%",
        height: "100%",
        fontFamily: "var(--t-font-sans)",
        background: "var(--t-color-bg)",
        color: "var(--t-color-fg)",
      }}
    >
      <style>{`${TOKENS_CSS}${SHELL_CSS}`}</style>
      {props.toolbar === undefined ? null : (
        <nav className="t-toolbar" aria-label={en.shell.toolbar}>
          {props.toolbar}
        </nav>
      )}
      <section
        className="t-region"
        aria-label={en.shell.outliner}
        style={regionStyle({ borderRight: "1px solid var(--t-color-border)" })}
      >
        <header>
          {en.shell.outliner}
          <button type="button" onClick={() => setOutlinerWidth(outlinerWidth - 16)}>
            {en.shell.narrowOutliner}
          </button>
          <button type="button" onClick={() => setOutlinerWidth(outlinerWidth + 16)}>
            {en.shell.widenOutliner}
          </button>
        </header>
        <div className="t-region-body">{props.outliner}</div>
      </section>
      <section className="t-viewport-region" aria-label={en.shell.viewport}>
        <header>{en.shell.viewport}</header>
        {props.viewport ?? <ViewportHost />}
      </section>
      <section
        className="t-region"
        aria-label={en.shell.inspector}
        style={regionStyle({ borderLeft: "1px solid var(--t-color-border)" })}
      >
        <header>
          {en.shell.inspector}
          <button type="button" onClick={() => setInspectorWidth(inspectorWidth - 16)}>
            {en.shell.narrowInspector}
          </button>
          <button type="button" onClick={() => setInspectorWidth(inspectorWidth + 16)}>
            {en.shell.widenInspector}
          </button>
        </header>
        <div className="t-region-body">{props.inspector}</div>
      </section>
      <section
        className="t-region"
        aria-label={en.shell.chat}
        style={regionStyle({ gridColumn: "1 / -1", borderTop: "1px solid var(--t-color-border)" })}
      >
        <header>
          {en.shell.chat}
          <button type="button" onClick={() => setChatHeight(chatHeight - 16)}>
            {en.shell.shorterChat}
          </button>
          <button type="button" onClick={() => setChatHeight(chatHeight + 16)}>
            {en.shell.tallerChat}
          </button>
        </header>
        <div className="t-chat-row t-region-body">
          {props.jobs === undefined ? null : <JobPanel {...props.jobs} />}
          <div>
            {props.review === undefined ? null : <ReviewPanel {...props.review} />}
            {props.chat === undefined ? null : <ChatPanel {...props.chat} />}
          </div>
        </div>
      </section>
    </div>
  );
}
