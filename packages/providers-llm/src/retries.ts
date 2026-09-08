import type { Clock, Result, TesseraError } from "@tessera/std";
import { abortError, err, isOk, ok } from "@tessera/std";

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;

function isCancelledError(value: unknown): value is TesseraError {
  return (
    typeof value === "object" && value !== null && "code" in value && value.code === "CANCELLED"
  );
}

/**
 * `07` §4: retry only rate limits, 5xx, and network failures.
 *
 * @public
 */
export function isRetryableProviderError(error: TesseraError): boolean {
  if (error.code === "RATE_LIMITED") {
    return true;
  }
  if (error.code !== "PROVIDER_ERROR") {
    return false;
  }
  return error.details?.["retryable"] === true;
}

/**
 * Delay for attempt `attemptIndex` (0-based) with clock-derived jitter (no `Math.random`).
 *
 * @public
 */
export function retryDelayMs(attemptIndex: number, clock: Clock): number {
  const exponential = BASE_DELAY_MS * 2 ** attemptIndex;
  const jitter = clock.now() % 51;
  return exponential + jitter;
}

async function defaultSleep(ms: number, signal?: AbortSignal): Promise<Result<void, TesseraError>> {
  if (signal?.aborted) {
    return err(abortError());
  }
  return await new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve(ok(undefined));
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      resolve(err(abortError()));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Runs `operation` up to 3 times with 500 ms exponential backoff (`07` §4).
 *
 * @example
 * ```ts
 * await withProviderRetries(clock, undefined, undefined, () => Promise.resolve(ok(1)));
 * ```
 *
 * @public
 */
export async function withProviderRetries<T>(
  clock: Clock,
  sleep: ((ms: number, signal?: AbortSignal) => Promise<void>) | undefined,
  signal: AbortSignal | undefined,
  operation: () => Promise<Result<T, TesseraError>>,
): Promise<Result<T, TesseraError>> {
  let last: Result<T, TesseraError> = err(abortError());
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (signal?.aborted) {
      return err(abortError());
    }
    last = await operation();
    if (isOk(last)) {
      return last;
    }
    if (!isRetryableProviderError(last.error) || attempt === MAX_ATTEMPTS - 1) {
      return last;
    }
    if (sleep !== undefined) {
      try {
        await sleep(retryDelayMs(attempt, clock), signal);
      } catch (error) {
        if (isCancelledError(error)) {
          return err(error);
        }
        throw error;
      }
    } else {
      const waited = await defaultSleep(retryDelayMs(attempt, clock), signal);
      if (!isOk(waited)) {
        return waited;
      }
    }
  }
  return last;
}
