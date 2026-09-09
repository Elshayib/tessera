import type { ModelRef } from "@tessera/llm";
import { isOk } from "@tessera/std";
import { expect, test } from "vitest";
import { resolveRoles } from "./roles.js";

const cheap: ModelRef = { providerId: "openai", modelId: "small" };
const strong: ModelRef = { providerId: "openai", modelId: "large" };
const vision: ModelRef = { providerId: "openai", modelId: "vision" };

test("roles request overrides project overrides global", () => {
  const resolved = resolveRoles({
    request: { planner: strong },
    project: { executor: cheap },
    global: { executor: vision, planner: vision },
    executorVision: true,
  });
  expect(isOk(resolved)).toBe(true);
  if (!isOk(resolved)) {
    return;
  }
  expect(resolved.value.models.executor).toEqual(cheap);
  expect(resolved.value.models.planner).toEqual(strong);
  expect(resolved.value.criticEnabled).toBe(true);
  expect(resolved.value.models.critic).toEqual(cheap);
});

test("critic disabled when executor has no vision", () => {
  const resolved = resolveRoles({
    global: { executor: cheap },
    executorVision: false,
  });
  expect(isOk(resolved)).toBe(true);
  if (!isOk(resolved)) {
    return;
  }
  expect(resolved.value.models.executor).toEqual(cheap);
  expect(resolved.value.models.planner).toEqual(cheap);
  expect(resolved.value.criticEnabled).toBe(false);
  expect(resolved.value.models.critic).toBeUndefined();
});

test("explicit critic overrides vision default", () => {
  const critic: ModelRef = { providerId: "openai", modelId: "critic" };
  const resolved = resolveRoles({
    global: { executor: cheap, critic },
    executorVision: false,
  });
  expect(isOk(resolved) && resolved.value.criticEnabled).toBe(true);
  expect(isOk(resolved) && resolved.value.models.critic?.modelId === "critic").toBe(true);
});

test("executor model is required", () => {
  const resolved = resolveRoles({ executorVision: false });
  expect(isOk(resolved)).toBe(false);
});
