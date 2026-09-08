import type { ReactElement } from "react";
import { TOKEN_ACCENT } from "./tokens.js";

/**
 * Accessible-hidden viewport canvas (`01` a11y). The outliner is the scene tree.
 *
 * @example
 * ```tsx
 * <ViewportHost />
 * ```
 *
 * @public
 */
export function ViewportHost(props: {
  readonly canvasRef?: (canvas: HTMLCanvasElement | null) => void;
}): ReactElement {
  return (
    // biome-ignore lint/a11y/noAriaHiddenOnFocusable: viewport canvas is aria-hidden (01 §9)
    <canvas aria-hidden="true" data-accent={TOKEN_ACCENT} ref={props.canvasRef} />
  );
}
