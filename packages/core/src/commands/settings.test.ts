import { emptyDocument } from "@tessera/schema";
import { isErr, isOk } from "@tessera/std";
import { expect, test } from "vitest";
import { createCommandBus } from "../command-bus.js";
import { createDocument } from "../create-document.js";

const author = { kind: "user" as const, id: "tester" };

test("settings.set reject / success / change set", () => {
  const { doc, reader } = createDocument({ snapshot: emptyDocument() });
  const bus = createCommandBus(doc);
  const invalid = bus.execute("settings.set", { patch: { units: "m" } }, { author });
  expect(isErr(invalid) && invalid.error.code === "INVALID_INPUT").toBe(true);
  const set = bus.execute(
    "settings.set",
    { patch: { physics: { gravity: [0, -1, 0] } } },
    { author },
  );
  expect(isOk(set)).toBe(true);
  if (!set.ok) {
    return;
  }
  expect(reader.snapshot().settings.physics.gravity).toEqual([0, -1, 0]);
  expect(set.value.transaction.changeSet.settings?.length).toBeGreaterThan(0);
});
