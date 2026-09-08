import { emptyDocument } from "@tessera/schema";
import { expect, test } from "vitest";
import { LAYOUT_STORAGE_KEY, useLayoutStore } from "./layout-store.js";

test("INV-ARCH-04 layout not in document", () => {
  const document = emptyDocument();
  const before = JSON.stringify(document);
  useLayoutStore.getState().setOutlinerWidth(320);
  useLayoutStore.getState().setInspectorWidth(300);
  useLayoutStore.getState().setChatHeight(180);
  expect(JSON.stringify(document)).toBe(before);
  expect(before.includes("outlinerWidth")).toBe(false);
  const stored = localStorage.getItem(LAYOUT_STORAGE_KEY);
  expect(stored).toBeDefined();
  if (stored === null) {
    return;
  }
  expect(stored.includes("outlinerWidth")).toBe(true);
  expect(useLayoutStore.getState().outlinerWidth).toBe(320);
  useLayoutStore.getState().setOutlinerWidth(0);
  expect(useLayoutStore.getState().outlinerWidth).toBe(160);
  useLayoutStore.getState().setOutlinerWidth(900);
  expect(useLayoutStore.getState().outlinerWidth).toBe(640);
});
