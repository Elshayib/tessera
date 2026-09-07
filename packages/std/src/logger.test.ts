import { expect, test } from "vitest";
import { createLogger, createMemorySink } from "./logger.js";

test("Logger writes to sinks; redact applied to fields", () => {
  const sink = createMemorySink(8);
  const logger = createLogger([sink.write]);

  logger.info("std.logger.test", { token: "secret-value", id: "e_abc" });

  logger.debug("std.logger.debug");
  logger.warn("std.logger.warn", { id: "e_abc" });
  logger.error("std.logger.error");

  expect(sink.entries).toHaveLength(4);
  expect(sink.entries[1]).toEqual({ level: "debug", event: "std.logger.debug" });
  expect(sink.entries[2]).toMatchObject({ level: "warn", event: "std.logger.warn" });
  expect(sink.entries[3]).toEqual({ level: "error", event: "std.logger.error" });

  const tiny = createMemorySink(1);
  tiny.write("info", "std.logger.keep");
  tiny.write("info", "std.logger.drop");
  expect(tiny.entries).toHaveLength(1);
  expect(tiny.entries[0]).toMatchObject({ event: "std.logger.drop" });
});
