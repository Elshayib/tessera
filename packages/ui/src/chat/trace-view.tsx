import type { ReactElement } from "react";
import { en } from "../i18n/en.js";

/**
 * Minimal run-span timeline (`15` §4).
 *
 * @public
 */
export interface TraceViewProps {
  readonly spans: readonly {
    readonly name: string;
    readonly start: number;
    readonly end: number;
  }[];
}

/**
 * Lists spans for “Show trace”.
 *
 * @example
 * ```tsx
 * <TraceView spans={[{ name: "run", start: 0, end: 2 }]} />
 * ```
 *
 * @public
 */
export function TraceView(props: TraceViewProps): ReactElement {
  return (
    <ol aria-label={en.chat.trace}>
      {props.spans.map((span, index) => (
        <li key={`${span.name}:${String(index)}`}>
          {span.name} {String(span.start)}–{String(span.end)}
        </li>
      ))}
    </ol>
  );
}
