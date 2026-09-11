import { expect, test } from "vitest";
import { emptyRoleModels, ROLE_MODEL_KEYS } from "./models.js";

test("role model refs planner executor critic", () => {
  expect([...ROLE_MODEL_KEYS]).toEqual(["planner", "executor", "critic"]);
  const roles = emptyRoleModels();
  expect(roles.planner.providerId).toBe("openai");
  expect(roles.executor.modelId).toBe("");
  expect(roles.critic.providerId).toBe("openai");
});
