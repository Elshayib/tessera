import { expect, test } from "vitest";
import { suggestionFor } from "./suggestions.js";

test("error suggestion table by group and code", () => {
  expect(suggestionFor("read", "NOT_FOUND")).toBe(
    "Call scene.find with name 'oak*' to list candidates.",
  );
  expect(suggestionFor("entities", "NOT_FOUND")).toBe(
    "Call scene.find with name 'oak*' to list candidates.",
  );
  expect(suggestionFor("assets", "CONFLICT")).toBe(
    "Pass force on asset.delete after ask_user, or pick an unreferenced asset.",
  );
  expect(suggestionFor("meta", "INVALID_INPUT")).toBe(
    "Call tools.catalog, then tools.enable with a listed group.",
  );
  expect(suggestionFor("layout", "INVALID_INPUT")).toBe(
    "Use layout macros with entity ids or { path } rather than guessed coordinates.",
  );
});
