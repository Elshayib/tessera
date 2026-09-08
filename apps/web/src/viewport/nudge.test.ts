import { createCommandBus, createDocument, fromYDoc } from "@tessera/core";
import { emptyDocument } from "@tessera/schema";
import { isOk } from "@tessera/std";
import { expect, test } from "vitest";
import { applyTransformIntent } from "./apply-intent.js";
import { loadViewportCamera, saveViewportCamera, VIEWPORT_CAMERA_KEY } from "./camera-store.js";
import { nudgeIntent, TRANSLATE_SNAP_M } from "./nudge.js";

const memory = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem(key: string): string | null {
      return memory.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      memory.set(key, value);
    },
  },
});

const author = { kind: "user" as const, id: "tester" };

function outputId(output: unknown): string | undefined {
  if (typeof output !== "object" || output === null || !("id" in output)) {
    return undefined;
  }
  const id = output.id;
  return typeof id === "string" ? id : undefined;
}

test("INV-CMD-06 gizmo release one transaction", () => {
  const { doc, reader } = createDocument({ snapshot: emptyDocument() });
  const bus = createCommandBus(doc);
  const created = bus.execute("entity.create", { name: "box" }, { author });
  expect(isOk(created)).toBe(true);
  if (!created.ok) {
    return;
  }
  const id = outputId(created.value.output);
  expect(id).toBeDefined();
  if (id === undefined) {
    return;
  }
  let committed = 0;
  const stop = bus.events.on("transaction.committed", () => {
    committed += 1;
  });
  const result = applyTransformIntent(bus, author, {
    kind: "transform.set",
    label: "Move box",
    targets: [
      {
        id,
        transform: {
          position: [1, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
      },
    ],
  });
  stop();
  expect(isOk(result)).toBe(true);
  expect(committed).toBe(1);
  expect(result.ok ? result.value.transaction.label : "").toBe("Move box");
  expect(reader.getEntity(id)?.components.transform.position[0]).toBe(1);
});

test("arrow nudge calls transform.set", () => {
  const { doc, reader } = createDocument({ snapshot: emptyDocument() });
  const bus = createCommandBus(doc);
  const created = bus.execute("entity.create", { name: "box" }, { author });
  expect(isOk(created)).toBe(true);
  if (!created.ok) {
    return;
  }
  const id = outputId(created.value.output);
  if (id === undefined) {
    return;
  }
  const names: string[] = [];
  const stop = bus.events.on("transaction.committed", (payload) => {
    for (const command of payload.transaction.commands) {
      names.push(command.name);
    }
  });
  const intent = nudgeIntent(fromYDoc(doc.ydoc), [id], "ArrowRight", false);
  expect(intent).toBeDefined();
  if (intent === undefined) {
    return;
  }
  expect(intent.label.startsWith("Move ")).toBe(true);
  expect(isOk(applyTransformIntent(bus, author, intent))).toBe(true);
  expect(names.filter((name) => name === "transform.set")).toHaveLength(1);
  const position = reader.getEntity(id)?.components.transform.position;
  expect(position?.[0]).toBe(TRANSLATE_SNAP_M);
  const shifted = nudgeIntent(fromYDoc(doc.ydoc), [id], "ArrowRight", true);
  expect(shifted).toBeDefined();
  if (shifted === undefined) {
    return;
  }
  expect(isOk(applyTransformIntent(bus, author, shifted))).toBe(true);
  stop();
  expect(names.filter((name) => name === "transform.set")).toHaveLength(2);
  const after = reader.getEntity(id)?.components.transform.position;
  expect(after?.[0]).toBe(TRANSLATE_SNAP_M + TRANSLATE_SNAP_M * 10);
});

test("INV-ARCH-04 viewport camera not in document", () => {
  const { reader } = createDocument({ snapshot: emptyDocument() });
  const before = JSON.stringify(reader.snapshot());
  saveViewportCamera({ position: [9, 8, 7], target: [1, 2, 3] });
  expect(JSON.stringify(reader.snapshot())).toBe(before);
  expect(localStorage.getItem(VIEWPORT_CAMERA_KEY)?.includes("9")).toBe(true);
  const loaded = loadViewportCamera();
  expect(loaded?.position[0]).toBe(9);
});
