import { emptyDocument } from "@tessera/schema";
import { isOk } from "@tessera/std";
import { expect, test } from "vitest";
import { createCommandBus } from "./command-bus.js";
import { createDocument } from "./create-document.js";

const author = { kind: "user" as const, id: "tester" };

test("INV-CMD-03 empty transaction dropped", () => {
  const { doc } = createDocument({ snapshot: emptyDocument() });
  const bus = createCommandBus(doc);
  let committed = 0;
  let changed = 0;
  bus.events.on("transaction.committed", () => {
    committed += 1;
  });
  bus.events.on("document.changed", () => {
    changed += 1;
  });
  const result = bus.transaction(authorOptions(), () => ({ ok: true, value: "idle" }));
  expect(isOk(result)).toBe(true);
  expect(committed).toBe(0);
  expect(changed).toBe(0);
});

function authorOptions() {
  return { author };
}
