import { expect, test } from "vitest";
import { tagsAddCommand, tagsRemoveCommand } from "./tags.js";

const ENTITY = "e_aaaaaaaaaa";

test("tags command inputs reject invalid payloads", () => {
  expect(tagsAddCommand.input.safeParse({ target: ENTITY, tags: [] }).success).toBe(false);
  expect(tagsAddCommand.input.safeParse({ target: ENTITY, tags: ["Bad"] }).success).toBe(false);
  expect(tagsRemoveCommand.input.safeParse({ target: ENTITY, tags: ["ok"] }).success).toBe(true);
});
