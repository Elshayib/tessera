import type { Logger, Result, TesseraError } from "@tessera/std";
import { Emitter, newId, ok, tesseraError } from "@tessera/std";
import type { Author, CommandBus } from "./command-types.js";

export type JobState = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type JobKind = "import" | "export" | "generate" | "bake" | (string & {});

export interface JobStatus {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
  readonly state: JobState;
  readonly progress: number;
  readonly message?: string;
  readonly error?: TesseraError;
}

export interface JobSpec<T> {
  readonly kind: JobKind;
  readonly label: string;
  readonly author: Author;
  run(ctx: {
    signal: AbortSignal;
    progress(p: number, message?: string): void;
    logger: Logger;
  }): Promise<Result<T, TesseraError>>;
  commit?(result: T, bus: CommandBus): Result<void, TesseraError>;
}

export interface JobHandle {
  readonly id: string;
  result(): Promise<Result<unknown, TesseraError>>;
}

export type JobQueueEvents = {
  "job.updated": { status: JobStatus };
};

export interface JobQueue {
  enqueue<T>(spec: JobSpec<T>): JobHandle;
  get(id: string): JobStatus | undefined;
  list(filter?: { kind?: string; state?: JobState }): readonly JobStatus[];
  cancel(id: string): void;
  readonly events: Emitter<JobQueueEvents>;
}

interface InternalJob<T = unknown> {
  readonly id: string;
  readonly spec: JobSpec<T>;
  state: JobState;
  progress: number;
  message: string | undefined;
  error: TesseraError | undefined;
  readonly controller: AbortController;
  readonly finish: Promise<Result<T, TesseraError>>;
  resolve: (result: Result<T, TesseraError>) => void;
}

const DEFAULT_MAX_RUNNING_PER_KIND = 2;

/**
 * In-memory job queue (`docs/04-command-bus.md` §9). At most 2 running jobs per kind.
 *
 * @example
 * ```ts
 * const jobs = createJobQueue(bus, { logger: doc.logger });
 * const handle = jobs.enqueue({
 *   kind: "bake",
 *   label: "demo",
 *   author: { kind: "user", id: "u1" },
 *   async run() { return ok(undefined); },
 * });
 * ```
 *
 * @public
 */
export function createJobQueue(
  bus: CommandBus,
  options: { readonly logger: Logger; readonly maxRunningPerKind?: number },
): JobQueue {
  const maxRunning = options.maxRunningPerKind ?? DEFAULT_MAX_RUNNING_PER_KIND;
  const events = new Emitter<JobQueueEvents>({ logger: options.logger });
  const jobs = new Map<string, InternalJob>();
  const order: string[] = [];

  const emit = (job: InternalJob): void => {
    events.emit("job.updated", { status: toStatus(job) });
  };

  const runningCount = (kind: string): number => {
    let count = 0;
    for (const job of jobs.values()) {
      if (job.spec.kind === kind && job.state === "running") {
        count += 1;
      }
    }
    return count;
  };

  const pump = (): void => {
    for (const id of order) {
      const job = jobs.get(id);
      if (job === undefined || job.state !== "queued") {
        continue;
      }
      if (runningCount(job.spec.kind) >= maxRunning) {
        continue;
      }
      start(job);
    }
  };

  const start = (job: InternalJob): void => {
    job.state = "running";
    emit(job);
    const runCtx = {
      signal: job.controller.signal,
      progress(progress: number, message?: string) {
        job.progress = progress;
        job.message = message;
        emit(job);
      },
      logger: options.logger,
    };
    void (async () => {
      try {
        const result = await job.spec.run(runCtx);
        if (job.controller.signal.aborted || job.state === "cancelled") {
          finishCancelled(job);
          return;
        }
        if (!result.ok) {
          job.state = "failed";
          job.error = result.error;
          emit(job);
          job.resolve(result);
          pump();
          return;
        }
        if (job.spec.commit !== undefined) {
          const committed = job.spec.commit(result.value, bus);
          if (!committed.ok) {
            job.state = "failed";
            job.error = committed.error;
            emit(job);
            job.resolve(committed);
            pump();
            return;
          }
        }
        job.state = "succeeded";
        job.progress = 1;
        emit(job);
        job.resolve(ok(result.value));
      } catch (caught) {
        if (job.controller.signal.aborted) {
          finishCancelled(job);
          return;
        }
        const message = caught instanceof Error ? caught.message : "job threw";
        const error = tesseraError("INVARIANT_VIOLATION", message);
        job.state = "failed";
        job.error = error;
        emit(job);
        job.resolve({ ok: false, error });
      }
      pump();
    })();
  };

  const finishCancelled = (job: InternalJob): void => {
    job.state = "cancelled";
    const error = tesseraError("CANCELLED", "job cancelled");
    job.error = error;
    emit(job);
    job.resolve({ ok: false, error });
    pump();
  };

  return {
    events,
    enqueue(spec) {
      const id = newId("j");
      let resolveFn: (result: Result<unknown, TesseraError>) => void = () => undefined;
      const finish = new Promise<Result<unknown, TesseraError>>((resolve) => {
        resolveFn = resolve;
      });
      const job: InternalJob = {
        id,
        spec,
        state: "queued",
        progress: 0,
        message: undefined,
        error: undefined,
        controller: new AbortController(),
        finish,
        resolve: resolveFn,
      };
      jobs.set(id, job);
      order.push(id);
      emit(job);
      pump();
      return {
        id,
        result: () => job.finish,
      };
    },
    get(id) {
      const job = jobs.get(id);
      if (job === undefined) {
        return undefined;
      }
      return toStatus(job);
    },
    list(filter) {
      const listed: JobStatus[] = [];
      for (const id of order) {
        const job = jobs.get(id);
        if (job === undefined) {
          continue;
        }
        if (filter?.kind !== undefined && job.spec.kind !== filter.kind) {
          continue;
        }
        if (filter?.state !== undefined && job.state !== filter.state) {
          continue;
        }
        listed.push(toStatus(job));
      }
      return listed;
    },
    cancel(id) {
      const job = jobs.get(id);
      if (job === undefined) {
        return;
      }
      if (job.state === "succeeded" || job.state === "failed" || job.state === "cancelled") {
        return;
      }
      if (job.state === "queued") {
        finishCancelled(job);
        return;
      }
      job.controller.abort();
    },
  };
}

function toStatus(job: InternalJob): JobStatus {
  const base = {
    id: job.id,
    kind: job.spec.kind,
    label: job.spec.label,
    state: job.state,
    progress: job.progress,
  };
  if (job.message !== undefined && job.error !== undefined) {
    return { ...base, message: job.message, error: job.error };
  }
  if (job.message !== undefined) {
    return { ...base, message: job.message };
  }
  if (job.error !== undefined) {
    return { ...base, error: job.error };
  }
  return base;
}
