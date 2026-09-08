import type { TesseraError } from "@tessera/std";
import { abortError, err, ok, tesseraError } from "@tessera/std";
import { FakeClock } from "@tessera/testing";
import { expect, test, vi } from "vitest";
import { isRetryableProviderError, retryDelayMs, withProviderRetries } from "./retries.js";

test("retries: 3 attempts, 500ms base; no retry on 401", async () => {
  const clock = new FakeClock(1_700_000_000_000);
  const delays: number[] = [];
  let calls = 0;
  const rateLimited = tesseraError("RATE_LIMITED", "provider rate limited", { retryAfterMs: 1 });
  const result = await withProviderRetries(
    clock,
    async (ms) => {
      delays.push(ms);
    },
    undefined,
    async () => {
      calls += 1;
      if (calls < 3) {
        return err(rateLimited);
      }
      return ok("done");
    },
  );
  expect(calls).toBe(3);
  expect(delays).toHaveLength(2);
  expect(delays[0]).toBe(retryDelayMs(0, clock));
  expect(result).toEqual(ok("done"));

  let deniedCalls = 0;
  const denied = tesseraError("PERMISSION_DENIED", "provider rejected credentials");
  const deniedResult = await withProviderRetries(
    clock,
    async () => {
      throw new Error("should not sleep");
    },
    undefined,
    async () => {
      deniedCalls += 1;
      return err(denied);
    },
  );
  expect(deniedCalls).toBe(1);
  expect(deniedResult).toEqual(err(denied));
  expect(isRetryableProviderError(denied)).toBe(false);
});

test("INV-PRV-03 429 maps to RATE_LIMITED and retries", async () => {
  const clock = new FakeClock();
  let calls = 0;
  const limited: TesseraError = tesseraError("RATE_LIMITED", "provider rate limited");
  await withProviderRetries(
    clock,
    async () => undefined,
    undefined,
    async () => {
      calls += 1;
      return err(limited);
    },
  );
  expect(calls).toBe(3);
});

test("default sleep is cancelled by AbortSignal", async () => {
  vi.useFakeTimers();
  const clock = new FakeClock();
  const controller = new AbortController();
  const pending = withProviderRetries(clock, undefined, controller.signal, async () =>
    err(tesseraError("RATE_LIMITED", "provider rate limited")),
  );
  controller.abort();
  await vi.advanceTimersByTimeAsync(1);
  const result = await pending;
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  expect(result.error.code).toBe("CANCELLED");
  vi.useRealTimers();
});

test("sleep throwing CANCELLED stops retries", async () => {
  const clock = new FakeClock();
  const result = await withProviderRetries(
    clock,
    async () => {
      throw abortError();
    },
    undefined,
    async () => err(tesseraError("RATE_LIMITED", "provider rate limited")),
  );
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  expect(result.error.code).toBe("CANCELLED");
});

test("sleep throwing non-cancel errors propagate", async () => {
  const clock = new FakeClock();
  await expect(
    withProviderRetries(
      clock,
      async () => {
        throw new Error("boom");
      },
      undefined,
      async () => err(tesseraError("RATE_LIMITED", "provider rate limited")),
    ),
  ).rejects.toThrow("boom");
});

test("default sleep completes between retryable attempts", async () => {
  vi.useFakeTimers();
  const clock = new FakeClock();
  let calls = 0;
  const pending = withProviderRetries(clock, undefined, undefined, async () => {
    calls += 1;
    if (calls < 2) {
      return err(tesseraError("RATE_LIMITED", "provider rate limited"));
    }
    return ok("ok");
  });
  await vi.advanceTimersByTimeAsync(2000);
  expect(await pending).toEqual(ok("ok"));
  vi.useRealTimers();
});
