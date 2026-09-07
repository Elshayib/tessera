import { isOk } from "@tessera/std";
import { expect, test } from "vitest";
import { createCommandBus } from "../command-bus.js";
import { createDocument } from "../create-document.js";
import { createQueryHost } from "./host.js";

const author = { kind: "user" as const, id: "tester" };

test("scene.find glob/tag/component", () => {
  const { doc } = createDocument();
  const bus = createCommandBus(doc);
  const oak1 = bus.execute("entity.create", { name: "oak_01" }, { author });
  const oak2 = bus.execute("entity.create", { name: "oak_02" }, { author });
  const pine = bus.execute("entity.create", { name: "pine" }, { author });
  expect(isOk(oak1) && isOk(oak2) && isOk(pine)).toBe(true);
  if (!oak1.ok) {
    return;
  }
  const oakId = outputId(oak1.value.output);
  expect(oakId !== undefined).toBe(true);
  if (oakId === undefined) {
    return;
  }
  expect(isOk(bus.execute("tags.add", { target: oakId, tags: ["tree"] }, { author }))).toBe(true);
  expect(
    isOk(
      bus.execute(
        "component.add",
        { target: oakId, type: "light", value: { type: "point", intensity: 10 } },
        { author },
      ),
    ),
  ).toBe(true);
  const queries = createQueryHost(doc, { history: () => [] });
  const byName = queries.query("scene.find", { name: "oak_*" });
  expect(matchCount(byName)).toBe(2);
  const byTag = queries.query("scene.find", { tag: "tree" });
  expect(matchCount(byTag)).toBe(1);
  const byComponent = queries.query("scene.find", { component: "light" });
  expect(matchCount(byComponent)).toBe(1);
});

function outputId(output: unknown): string | undefined {
  if (typeof output !== "object" || output === null) {
    return undefined;
  }
  for (const [key, value] of Object.entries(output)) {
    if (key === "id" && typeof value === "string") {
      return value;
    }
  }
  return undefined;
}

function matchCount(result: { ok: boolean; value?: unknown }): number {
  if (!result.ok) {
    return -1;
  }
  const value = result.value;
  if (typeof value !== "object" || value === null) {
    return -1;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (key === "matches" && Array.isArray(entry)) {
      return entry.length;
    }
  }
  return -1;
}
