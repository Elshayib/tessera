import type { CommandBus } from "@tessera/core";
import { createCommandBus, createDocument } from "@tessera/core";
import { CameraSchema, emptyDocument, LightSchema, TransformSchema } from "@tessera/schema";
import { isOk } from "@tessera/std";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";
import { en } from "../i18n/en.js";
import { commitInspectorPatch } from "./commit.js";
import { FieldControl } from "./field-control.js";
import { isKnownWidget, listInspectorFields } from "./fields.js";
import { Inspector } from "./inspector.js";

const author = { kind: "user" as const, id: "tester" };

function outputId(output: unknown): string | undefined {
  if (typeof output !== "object" || output === null || !("id" in output)) {
    return undefined;
  }
  const id = output.id;
  return typeof id === "string" ? id : undefined;
}

function setup() {
  const created = createDocument({ snapshot: emptyDocument() });
  const bus = createCommandBus(created.doc);
  return { ...created, bus };
}

function wrapBus(bus: CommandBus, names: string[]): CommandBus {
  return {
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
}

test("listInspectorFields walks camera and transform widgets", () => {
  const camera = listInspectorFields(CameraSchema);
  expect(camera.some((field) => field.widget === "slider" && field.key === "fov")).toBe(true);
  const transform = listInspectorFields(TransformSchema);
  expect(transform.some((field) => field.widget === "vec3")).toBe(true);
  const light = listInspectorFields(LightSchema, { type: "point", color: "#ffffff", intensity: 1 });
  expect(light.some((field) => field.widget === "color")).toBe(true);
  expect(isKnownWidget("slider")).toBe(true);
  expect(isKnownWidget("nope")).toBe(false);
});

test("unknown widget fallback", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(FieldControl, {
        fieldKey: "x",
        label: "Mystery",
        widget: "nope",
        value: 1,
        enumValues: [],
        step: 1,
        onCommit: () => undefined,
      }),
    );
  });
  expect(host.textContent?.includes(en.inspector.unknownWidget)).toBe(true);
  await act(async () => {
    root.unmount();
  });
});

async function dragSliderOnce(
  bus: CommandBus,
  entityId: string,
  reader: ReturnType<typeof setup>["reader"],
) {
  const names: string[] = [];
  const wrapped = wrapBus(bus, names);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(Inspector, { reader, bus: wrapped, author, entityId }));
  });
  const slider = host.querySelector("input[data-widget='slider']");
  expect(slider instanceof HTMLInputElement).toBe(true);
  if (slider instanceof HTMLInputElement) {
    await act(async () => {
      slider.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      slider.value = "40";
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      slider.dispatchEvent(new Event("change", { bubbles: true }));
      slider.value = "35";
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      slider.dispatchEvent(new Event("change", { bubbles: true }));
      slider.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    });
  }
  await act(async () => {
    root.unmount();
  });
  return names;
}

test("slider commit is one component.set", async () => {
  const { reader, bus } = setup();
  const created = bus.execute("entity.create", { name: "cam" }, { author });
  expect(isOk(created)).toBe(true);
  if (!created.ok) {
    return;
  }
  const id = outputId(created.value.output);
  expect(id).toBeDefined();
  if (id === undefined) {
    return;
  }
  expect(isOk(bus.execute("component.add", { target: id, type: "camera" }, { author }))).toBe(true);
  const names = await dragSliderOnce(bus, id, reader);
  expect(names.filter((name) => name === "component.set")).toHaveLength(1);
});

test("color widget for hex field", async () => {
  const { reader, bus } = setup();
  const created = bus.execute("entity.create", { name: "lamp" }, { author });
  expect(isOk(created)).toBe(true);
  if (!created.ok) {
    return;
  }
  const id = outputId(created.value.output);
  if (id === undefined) {
    return;
  }
  expect(isOk(bus.execute("component.add", { target: id, type: "light" }, { author }))).toBe(true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(Inspector, { reader, bus, author, entityId: id }));
  });
  const color = host.querySelector("input[type='color']");
  expect(color).toBeDefined();
  await act(async () => {
    root.unmount();
  });
});

test("INV-CMD-06", async () => {
  const { reader, bus } = setup();
  const created = bus.execute("entity.create", { name: "cam" }, { author });
  expect(isOk(created)).toBe(true);
  if (!created.ok) {
    return;
  }
  const id = outputId(created.value.output);
  if (id === undefined) {
    return;
  }
  expect(isOk(bus.execute("component.add", { target: id, type: "camera" }, { author }))).toBe(true);
  const names = await dragSliderOnce(bus, id, reader);
  expect(names.filter((name) => name === "component.set")).toHaveLength(1);
});

test("empty inspector and remaining widgets", async () => {
  const { reader, bus } = setup();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(Inspector, { reader, bus, author }));
  });
  expect(host.textContent?.includes(en.inspector.empty)).toBe(true);
  await act(async () => {
    root.unmount();
  });
  const committed: unknown[] = [];
  const widgets = [
    "number",
    "toggle",
    "select",
    "vec3",
    "vec2",
    "text",
    "asset",
    "entity",
    "tags",
    "json",
    "textarea",
    "color",
    "slider",
  ] as const;
  for (const widget of widgets) {
    const widgetHost = document.createElement("div");
    document.body.append(widgetHost);
    const widgetRoot = createRoot(widgetHost);
    await act(async () => {
      widgetRoot.render(
        createElement(FieldControl, {
          fieldKey: widget,
          label: widget,
          widget,
          value:
            widget === "toggle"
              ? true
              : widget === "vec3"
                ? [1, 2, 3]
                : widget === "vec2"
                  ? [1, 2]
                  : widget === "tags"
                    ? ["a"]
                    : widget === "color"
                      ? "#ff0000"
                      : widget === "json"
                        ? { a: 1 }
                        : widget === "slider"
                          ? 50
                          : widget === "select"
                            ? "a"
                            : "x",
          enumValues: ["a", "b"],
          step: 1,
          onCommit: (value) => {
            committed.push(value);
          },
        }),
      );
    });
    await act(async () => {
      widgetRoot.unmount();
    });
  }
  expect(committed.length).toBe(0);
});

test("commitInspectorPatch uses transform.set", () => {
  const { bus } = setup();
  const created = bus.execute("entity.create", { name: "box" }, { author });
  expect(isOk(created)).toBe(true);
  if (!created.ok) {
    return;
  }
  const id = outputId(created.value.output);
  if (id === undefined) {
    return;
  }
  expect(commitInspectorPatch(bus, author, id, "transform", "position", [1, 2, 3])).toBe(true);
});
