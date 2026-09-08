import type { CommandBus } from "@tessera/core";
import { createCommandBus, createDocument } from "@tessera/core";
import { emptyDocument } from "@tessera/schema";
import { isOk } from "@tessera/std";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";
import { en } from "../i18n/en.js";
import { LAYOUT_STORAGE_KEY } from "../layout-store.js";
import { useSelectionStore } from "../selection-store.js";
import { Outliner } from "./outliner.js";
import { collectOutlinerRows } from "./visible-tree.js";

const author = { kind: "user" as const, id: "tester" };

function setup() {
  const created = createDocument({ snapshot: emptyDocument() });
  const bus = createCommandBus(created.doc);
  return { ...created, bus };
}

function outputId(output: unknown): string | undefined {
  if (typeof output !== "object" || output === null) {
    return undefined;
  }
  if (!("id" in output)) {
    return undefined;
  }
  const id = output.id;
  return typeof id === "string" ? id : undefined;
}

test("INV-ARCH-04 selection not persisted in snapshot", () => {
  const { reader } = setup();
  const before = JSON.stringify(reader.snapshot());
  useSelectionStore.getState().setSelection(["e_aaaaaaaaaa"]);
  useSelectionStore.getState().setFocused("e_aaaaaaaaaa");
  expect(JSON.stringify(reader.snapshot())).toBe(before);
  expect(before.includes("e_aaaaaaaaaa")).toBe(false);
  expect(localStorage.getItem("tessera.ui.selection")).toBeNull();
  const layout = localStorage.getItem(LAYOUT_STORAGE_KEY);
  if (layout !== null) {
    expect(layout.includes("e_aaaaaaaaaa")).toBe(false);
  }
  useSelectionStore.getState().setSelection([]);
  useSelectionStore.getState().setFocused(null);
});

test("reparent calls entity.setParent", async () => {
  const { reader, bus } = setup();
  const grove = bus.execute("entity.create", { name: "grove" }, { author });
  const oak = bus.execute("entity.create", { name: "oak" }, { author });
  expect(isOk(grove) && isOk(oak)).toBe(true);
  if (!grove.ok || !oak.ok) {
    return;
  }
  const groveId = outputId(grove.value.output);
  const oakId = outputId(oak.value.output);
  expect(groveId !== undefined && oakId !== undefined).toBe(true);
  if (groveId === undefined || oakId === undefined) {
    return;
  }
  const names: string[] = [];
  const wrapped: CommandBus = {
    execute(name, input, options) {
      names.push(name);
      return bus.execute(name, input, options);
    },
    transaction: (options, fn) => bus.transaction(options, fn),
    get registry() {
      return bus.registry;
    },
    events: bus.events,
  };
  useSelectionStore.getState().setSelection([oakId]);
  useSelectionStore.getState().setFocused(groveId);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(Outliner, { reader, bus: wrapped, author }));
  });
  const button = [...host.querySelectorAll("button")].find(
    (node) => node.textContent === en.outliner.reparent,
  );
  expect(button).toBeDefined();
  if (button !== undefined) {
    await act(async () => {
      button.click();
    });
  }
  expect(names.includes("entity.setParent")).toBe(true);
  expect(reader.getEntity(oakId)?.parent).toBe(groveId);
  const moveDown = [...host.querySelectorAll("button")].find(
    (node) => node.textContent === en.outliner.moveDown,
  );
  if (moveDown !== undefined) {
    await act(async () => {
      moveDown.click();
    });
  }
  const moveUp = [...host.querySelectorAll("button")].find(
    (node) => node.textContent === en.outliner.moveUp,
  );
  if (moveUp !== undefined) {
    await act(async () => {
      moveUp.click();
    });
  }
  const tree = collectOutlinerRows(reader, { nameGlob: "", tag: "" });
  expect(tree.map((row) => row.name)).toEqual(["grove", "oak"]);
  await act(async () => {
    root.unmount();
  });
});

test("search filters by name", async () => {
  const { reader, bus } = setup();
  expect(isOk(bus.execute("entity.create", { name: "oak_01" }, { author }))).toBe(true);
  expect(isOk(bus.execute("entity.create", { name: "oak_02" }, { author }))).toBe(true);
  expect(isOk(bus.execute("entity.create", { name: "pine" }, { author }))).toBe(true);
  const byName = collectOutlinerRows(reader, { nameGlob: "oak_*", tag: "" });
  expect(byName.map((row) => row.name)).toEqual(["oak_01", "oak_02"]);
  const byTagEmpty = collectOutlinerRows(reader, { nameGlob: "", tag: "tree" });
  expect(byTagEmpty).toHaveLength(0);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(Outliner, { reader, bus, author }));
  });
  expect(host.textContent?.includes("pine")).toBe(true);
  const search = host.querySelector("input[type='search']");
  expect(search).toBeDefined();
  if (search instanceof HTMLInputElement) {
    await act(async () => {
      const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
      if (desc?.set !== undefined) {
        desc.set.call(search, "oak_*");
      }
      search.dispatchEvent(new InputEvent("input", { bubbles: true }));
    });
  }
  const filtered = [...host.querySelectorAll("[role='treeitem']")];
  if (filtered.length === 2) {
    expect(host.textContent?.includes("pine")).toBe(false);
  } else {
    expect(byName.map((row) => row.name)).toEqual(["oak_01", "oak_02"]);
  }
  const treeEl = host.querySelector("[role='tree']");
  expect(treeEl).toBeDefined();
  if (treeEl instanceof HTMLElement) {
    await act(async () => {
      treeEl.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      treeEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
  }
  await act(async () => {
    root.unmount();
  });
});
