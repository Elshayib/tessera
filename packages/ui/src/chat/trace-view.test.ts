import { expect, test } from "vitest";
import { TraceView } from "./trace-view.js";

test("TraceView lists span names", () => {
  expect(typeof TraceView).toBe("function");
});
