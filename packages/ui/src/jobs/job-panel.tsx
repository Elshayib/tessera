import type { JobQueue, JobStatus } from "@tessera/core";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { en } from "../i18n/en.js";

/**
 * Job panel props (`04` §9).
 *
 * @public
 */
export interface JobPanelProps {
  readonly jobs: JobQueue;
}

/**
 * Lists job progress and cancel (`T-0306`).
 *
 * @example
 * ```tsx
 * <JobPanel jobs={queue} />
 * ```
 *
 * @public
 */
export function JobPanel(props: JobPanelProps): ReactElement {
  const [items, setItems] = useState<readonly JobStatus[]>(() => props.jobs.list());
  useEffect(() => {
    const off = props.jobs.events.on("job.updated", () => {
      setItems(props.jobs.list());
    });
    return off;
  }, [props.jobs]);
  return (
    <section aria-label={en.jobs.title}>
      {items.length === 0 ? <p>{en.jobs.empty}</p> : null}
      <ul>
        {items.map((job) => (
          <li key={job.id}>
            <span>
              {job.label} {Math.round(job.progress * 100)}% {job.state}
            </span>
            <progress value={job.progress} max={1} />
            <button
              type="button"
              onClick={() => {
                props.jobs.cancel(job.id);
              }}
            >
              {en.jobs.cancel}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
