import { expect, test } from "vitest";
import { isId, newId } from "./id.js";

test("newId format and uniqueness", () => {
  const id = newId("e");
  expect(id).toMatch(/^e_[0-9a-z]{10}$/);

  const seen = new Set<string>();
  for (let i = 0; i < 10_000; i += 1) {
    seen.add(newId("e"));
  }
  expect(seen.size).toBe(10_000);
});

test("isId rejects wrong prefix and length", () => {
  expect(isId("e", newId("e"))).toBe(true);
  expect(isId("e", newId("a"))).toBe(false);
  expect(isId("e", "e_short")).toBe(false);
  expect(isId("e", "e_abcdefghijk")).toBe(false);
  expect(isId("e", "e_ABCDEFGHIJ")).toBe(false);
  expect(isId("t", "t_0123456789")).toBe(true);
});
