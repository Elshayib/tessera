import { expect, test } from "vitest";
import { Emitter } from "./emitter.js";
import { createLogger, createMemorySink } from "./logger.js";

test("Emitter unsubscribe; listener throw isolation", () => {
  const sink = createMemorySink();
  const logger = createLogger([sink.write]);
  const emitter = new Emitter<{ ping: number }>({ logger });

  const seen: number[] = [];
  const unsubscribeFirst = emitter.on("ping", (value) => {
    seen.push(value);
  });
  emitter.on("ping", () => {
    throw new Error("listener failed");
  });
  const unsubscribeLast = emitter.on("ping", (value) => {
    seen.push(value + 10);
  });

  emitter.emit("ping", 1);
  expect(seen).toEqual([1, 11]);
  expect(sink.entries.some((entry) => entry.level === "error")).toBe(true);

  unsubscribeFirst();
  unsubscribeLast();
  emitter.emit("ping", 2);
  expect(seen).toEqual([1, 11]);

  const silent = new Emitter<{ ping: number }>();
  silent.emit("ping", 0);
  silent.on("ping", () => {
    throw "not-an-error";
  });
  expect(() => {
    silent.emit("ping", 1);
  }).not.toThrow();
});
