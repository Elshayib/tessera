import { expect, test } from "vitest";
import { emptyDocument } from "./defaults.js";
import { validateDocument } from "./validate.js";

test("reserved component names rejected", () => {
  const doc = emptyDocument();
  const raw: Record<string, unknown> = {
    ...doc,
    entities: {
      e_reserved01: {
        id: "e_reserved01",
        name: "Reserved",
        parent: null,
        order: "a0",
        enabled: true,
        components: {
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          instance: {},
        },
      },
    },
  };
  const report = validateDocument(raw);
  expect(report.issues.some((item) => item.code === "UNSUPPORTED")).toBe(true);
});
