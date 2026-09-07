import { expect, test } from "vitest";
import {
  entityCreateCommand,
  entityDeleteCommand,
  entityDuplicateCommand,
  entityRenameCommand,
  entityReorderCommand,
  entitySetEnabledCommand,
  entitySetParentCommand,
} from "./entity.js";

const ENTITY = "e_aaaaaaaaaa";

test("entity command inputs reject invalid payloads", () => {
  expect(entityCreateCommand.input.safeParse({ name: "" }).success).toBe(false);
  expect(entityCreateCommand.input.safeParse({ parent: 1 }).success).toBe(false);
  expect(entityDeleteCommand.input.safeParse({}).success).toBe(false);
  expect(entityDeleteCommand.input.safeParse({ target: "e_short" }).success).toBe(false);
  expect(entityDuplicateCommand.input.safeParse({ target: ENTITY, count: 0 }).success).toBe(false);
  expect(entityDuplicateCommand.input.safeParse({ target: ENTITY, count: 101 }).success).toBe(
    false,
  );
  expect(entityRenameCommand.input.safeParse({ target: ENTITY, name: "has/slash" }).success).toBe(
    false,
  );
  expect(entitySetParentCommand.input.safeParse({ target: ENTITY }).success).toBe(false);
  expect(entityReorderCommand.input.safeParse({ target: { path: "" } }).success).toBe(false);
  expect(entitySetEnabledCommand.input.safeParse({ target: ENTITY, enabled: "yes" }).success).toBe(
    false,
  );
  expect(entityCreateCommand.input.safeParse({}).success).toBe(true);
});
