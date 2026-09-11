import type { TransactionRecord, UndoService } from "@tessera/core";
import type { KeyboardEvent, ReactElement } from "react";
import { en } from "../i18n/en.js";
import { groupAgentRuns } from "./run-group.js";

/**
 * Review panel props (`06` §9).
 *
 * @public
 */
export interface ReviewPanelProps {
  readonly transactions: readonly TransactionRecord[];
  readonly undo: UndoService;
  readonly working?: boolean;
  readonly plan?: readonly { readonly text: string; readonly done: boolean }[];
  readonly conversationOpen?: boolean;
}

/**
 * Groups live agent transactions. Accept is a no-op; revert uses UndoService.
 *
 * @example
 * ```tsx
 * <ReviewPanel transactions={committed} undo={undo} />
 * ```
 *
 * @public
 */
export function ReviewPanel(props: ReviewPanelProps): ReactElement {
  const groups = groupAgentRuns(props.transactions);
  const last = groups[groups.length - 1];
  const revertLast = (): void => {
    if (last === undefined || props.conversationOpen === false) {
      return;
    }
    void props.undo.revertRun(last.runId);
  };
  const onRevertKey = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      revertLast();
    }
  };
  return (
    <section aria-label={en.review.title}>
      {props.working === true ? <p>{en.review.working}</p> : null}
      {props.plan !== undefined && props.plan.length > 0 ? (
        <ol aria-label={en.review.plan}>
          {props.plan.map((item, index) => (
            <li key={`${item.text}:${String(index)}`}>
              {item.done ? "[x] " : "[ ] "}
              {item.text}
            </li>
          ))}
        </ol>
      ) : null}
      {groups.length === 0 ? <p>{en.review.empty}</p> : null}
      {groups.map((group) => (
        <article key={group.runId} aria-label={group.runId}>
          <p>{group.changeSet.summary}</p>
          <ol>
            {group.steps.map((step) => (
              <li key={step.id}>
                {step.label}
                <button
                  type="button"
                  onClick={() => {
                    void props.undo.undo({ kind: "run", runId: group.runId });
                  }}
                >
                  {en.review.revertStep}
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => {
              void props.undo.revertRun(group.runId);
            }}
          >
            {en.review.revertRun}
          </button>
        </article>
      ))}
      <button type="button" onClick={() => undefined}>
        {en.review.accept}
      </button>
      {last !== undefined && props.conversationOpen !== false ? (
        <button
          type="button"
          aria-keyshortcuts="Enter Space"
          title={en.review.revertRunHint}
          onKeyDown={onRevertKey}
          onClick={revertLast}
        >
          {en.review.revertLastRun}
        </button>
      ) : null}
    </section>
  );
}
