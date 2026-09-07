import { expect, test } from "vitest";
import { abortError, combineSignals, throwIfAborted } from "./abort.js";

test("throwIfAborted returns CANCELLED-shaped error via abortError", () => {
  const cancelled = abortError();
  expect(cancelled.code).toBe("CANCELLED");

  const controller = new AbortController();
  expect(() => {
    throwIfAborted(controller.signal);
  }).not.toThrow();

  controller.abort();
  expect(() => {
    throwIfAborted(controller.signal);
  }).toThrow();

  try {
    throwIfAborted(controller.signal);
  } catch (error) {
    expect(error).toEqual(abortError());
  }

  const combined = combineSignals(controller.signal, new AbortController().signal);
  expect(combined.aborted).toBe(true);

  const single = new AbortController().signal;
  expect(combineSignals(single)).toBe(single);
  expect(combineSignals().aborted).toBe(false);
});
