import { expect, test } from "vitest";
import { createAgentRuntime } from "./runtime.js";

test("createAgentRuntime is a factory", () => {
  expect(typeof createAgentRuntime).toBe("function");
});
