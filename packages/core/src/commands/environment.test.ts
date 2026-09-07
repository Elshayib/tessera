import { emptyDocument } from "@tessera/schema";
import { isOk } from "@tessera/std";
import { expect, test } from "vitest";
import { createCommandBus } from "../command-bus.js";
import { createDocument } from "../create-document.js";

const author = { kind: "user" as const, id: "tester" };

test("environment.set reject / success / change set", () => {
  const { doc, reader } = createDocument({ snapshot: emptyDocument() });
  const bus = createCommandBus(doc);
  const invalid = bus.execute("environment.set", { patch: { exposure: 0 } }, { author });
  expect(invalid.ok).toBe(false);
  const set = bus.execute("environment.set", { patch: { exposure: 1.5 } }, { author });
  expect(isOk(set)).toBe(true);
  if (!set.ok) {
    return;
  }
  expect(reader.snapshot().environment.exposure).toBe(1.5);
  expect(set.value.transaction.changeSet.environment?.length).toBeGreaterThan(0);
});
