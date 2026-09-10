import { Emitter, isErr, isOk } from "@tessera/std";
import { afterEach, expect, test } from "vitest";
import { createEngine } from "./host.js";
import type {
  CreateGpuRenderer,
  EngineCapabilities,
  EngineEvents,
  EngineHandle,
  GpuRenderer,
} from "./types.js";

afterEach(() => {
  deleteGpu();
});

test("capabilities fallback is webgl2 or webgpu", async () => {
  setGpu({});
  const canvas = document.createElement("canvas");
  const events = new Emitter<EngineEvents>();
  const seen: EngineCapabilities[] = [];
  events.on("capabilities.changed", (capabilities) => {
    seen.push(capabilities);
  });
  const created = await createEngine({
    canvas,
    events,
    createRenderer: fakeRenderer({ failUnlessWebGL: true }),
    requestFrame: idleFrame,
    cancelFrame: () => {
      return;
    },
  });
  expect(isOk(created)).toBe(true);
  if (!isOk(created)) {
    return;
  }
  expect(
    created.value.capabilities.backend === "webgl2" ||
      created.value.capabilities.backend === "webgpu",
  ).toBe(true);
  expect(created.value.capabilities.backend).toBe("webgl2");
  expect(created.value.capabilities.compute).toBe(false);
  expect(created.value.capabilities.maxDynamicLights).toBe(8);
  expect(seen.length).toBe(1);
  created.value.dispose();
});

test("absent gpu uses webgl2", async () => {
  deleteGpu();
  const canvas = document.createElement("canvas");
  const events = new Emitter<EngineEvents>();
  const seen: EngineCapabilities[] = [];
  events.on("capabilities.changed", (capabilities) => {
    seen.push(capabilities);
  });
  const created = await createEngine({
    canvas,
    events,
    createRenderer: fakeRenderer({ failUnlessWebGL: false }),
    requestFrame: idleFrame,
    cancelFrame: () => {
      return;
    },
  });
  expect(isOk(created)).toBe(true);
  if (!isOk(created)) {
    return;
  }
  expect(created.value.capabilities.backend).toBe("webgl2");
  expect(seen.length).toBe(1);
  created.value.dispose();
});

test("webgpu init success does not emit fallback", async () => {
  setGpu({});
  const canvas = document.createElement("canvas");
  const events = new Emitter<EngineEvents>();
  const seen: EngineCapabilities[] = [];
  events.on("capabilities.changed", (capabilities) => {
    seen.push(capabilities);
  });
  const created = await createEngine({
    canvas,
    events,
    createRenderer: fakeRenderer({ failUnlessWebGL: false }),
    requestFrame: idleFrame,
    cancelFrame: () => {
      return;
    },
  });
  expect(isOk(created)).toBe(true);
  if (!isOk(created)) {
    return;
  }
  expect(created.value.capabilities.backend).toBe("webgpu");
  expect(created.value.capabilities.maxDynamicLights).toBe(64);
  expect(created.value.capabilities.compute).toBe(true);
  expect(seen.length).toBe(0);
  created.value.dispose();
});

test("dispose stops the loop", async () => {
  const canvas = document.createElement("canvas");
  const renders = { count: 0 };
  const queued: FrameRequestCallback[] = [];
  const created = await createEngine({
    canvas,
    createRenderer: fakeRenderer({
      failUnlessWebGL: false,
      onRender: () => {
        renders.count += 1;
      },
    }),
    requestFrame: (callback) => {
      queued.push(callback);
      return queued.length;
    },
    cancelFrame: () => {
      queued.length = 0;
    },
  });
  expect(isOk(created)).toBe(true);
  if (!isOk(created)) {
    return;
  }
  const engine = created.value;
  const container = document.createElement("div");
  document.body.appendChild(container);
  engine.mount(container);
  flush(queued);
  expect(renders.count).toBeGreaterThan(0);
  const afterMount = renders.count;
  engine.dispose();
  engine.requestRender();
  flush(queued);
  expect(renders.count).toBe(afterMount);
});

test("on-demand loop idles when clean and coalesces frames", async () => {
  const canvas = document.createElement("canvas");
  const renders = { count: 0 };
  const queued: FrameRequestCallback[] = [];
  const created = await createEngine({
    canvas,
    createRenderer: fakeRenderer({
      failUnlessWebGL: false,
      onRender: () => {
        renders.count += 1;
      },
    }),
    requestFrame: (callback) => {
      queued.push(callback);
      return queued.length;
    },
    cancelFrame: () => {
      queued.length = 0;
    },
  });
  expect(isOk(created)).toBe(true);
  if (!isOk(created)) {
    return;
  }
  const engine = created.value;
  const container = document.createElement("div");
  document.body.appendChild(container);
  engine.mount(container);
  engine.requestRender();
  engine.requestRender();
  expect(queued.length).toBe(1);
  flush(queued);
  const afterFirst = renders.count;
  flush(queued);
  expect(renders.count).toBe(afterFirst);
  engine.dispose();
});

test("requestRender during a frame schedules one more", async () => {
  const canvas = document.createElement("canvas");
  const renders = { count: 0 };
  const queued: FrameRequestCallback[] = [];
  let engine: EngineHandle | undefined;
  const created = await createEngine({
    canvas,
    createRenderer: fakeRenderer({
      failUnlessWebGL: false,
      onRender: () => {
        renders.count += 1;
        if (renders.count === 1) {
          engine?.requestRender();
        }
      },
    }),
    requestFrame: (callback) => {
      queued.push(callback);
      return queued.length;
    },
    cancelFrame: () => {
      queued.length = 0;
    },
  });
  expect(isOk(created)).toBe(true);
  if (!isOk(created)) {
    return;
  }
  engine = created.value;
  const container = document.createElement("div");
  document.body.appendChild(container);
  engine.mount(container);
  flush(queued);
  flush(queued);
  expect(renders.count).toBe(2);
  flush(queued);
  expect(renders.count).toBe(2);
  engine.dispose();
});

test("init failures return IO_ERROR", async () => {
  deleteGpu();
  const missingGpu = await createEngine({
    canvas: document.createElement("canvas"),
    createRenderer: fakeRenderer({ failAlways: true }),
    requestFrame: idleFrame,
    cancelFrame: () => {
      return;
    },
  });
  expect(isErr(missingGpu) && missingGpu.error.code === "IO_ERROR").toBe(true);

  setGpu({});
  const bothFail = await createEngine({
    canvas: document.createElement("canvas"),
    createRenderer: fakeRenderer({ failAlways: true }),
    requestFrame: idleFrame,
    cancelFrame: () => {
      return;
    },
  });
  expect(isErr(bothFail) && bothFail.error.code === "IO_ERROR").toBe(true);
});

test("screenshot is unsupported", async () => {
  const canvas = document.createElement("canvas");
  const created = await createEngine({
    canvas,
    createRenderer: fakeRenderer({ failUnlessWebGL: false }),
    requestFrame: idleFrame,
    cancelFrame: () => {
      return;
    },
  });
  expect(isOk(created)).toBe(true);
  if (!isOk(created)) {
    return;
  }
  const shot = await created.value.screenshot({
    width: 64,
    height: 64,
    camera: { kind: "viewport" },
  });
  expect(isErr(shot) && shot.error.code === "UNSUPPORTED").toBe(true);
  const cancelled = await created.value.screenshot(
    { width: 64, height: 64, camera: { kind: "viewport" } },
    AbortSignal.abort(),
  );
  expect(isErr(cancelled) && cancelled.error.code === "CANCELLED").toBe(true);
  created.value.dispose();
});

test("pixel ratio is capped at 2 and stubs do not write", async () => {
  const ratios: number[] = [];
  const created = await createEngine({
    canvas: document.createElement("canvas"),
    createRenderer: fakeRenderer({
      failUnlessWebGL: false,
      onPixelRatio: (ratio) => {
        ratios.push(ratio);
      },
    }),
    requestFrame: idleFrame,
    cancelFrame: () => {
      return;
    },
  });
  expect(isOk(created)).toBe(true);
  if (!isOk(created)) {
    return;
  }
  const engine = created.value;
  Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 3 });
  const container = document.createElement("div");
  document.body.appendChild(container);
  engine.mount(container);
  expect(ratios.includes(2)).toBe(true);
  engine.setSelection(["e_abcdefghij"]);
  engine.setGizmo("translate", "world");
  engine.setSnapping({ enabled: true, translate: 0.1, rotateDeg: 15, scale: 0.1 });
  engine.setHelpers({ grid: true });
  engine.frame("all", { padding: 0.5, animate: false });
  engine.lookThrough(null);
  expect(engine.pick(0, 0)).toBeNull();
  expect(engine.raycast([0, 0, 0], [0, 0, 1]).length).toBe(0);
  engine.setViewportCamera({ position: [1, 2, 3], target: [0, 0, 0] });
  expect(engine.getViewportCamera()).toEqual({ position: [1, 2, 3], target: [0, 0, 0] });
  expect(engine.stats.drawCalls).toBe(0);
  engine.unmount();
  engine.mount(container);
  engine.dispose();
  engine.dispose();
});

test("identical container size does not call setSize again", async () => {
  const Original = globalThis.ResizeObserver;
  const observers: Array<() => void> = [];
  class FakeObserver {
    readonly #callback: () => void;
    constructor(callback: ResizeObserverCallback) {
      this.#callback = () => {
        callback([], this);
      };
      observers.push(this.#callback);
    }
    observe(_target: Element): void {
      return;
    }
    disconnect(): void {
      return;
    }
    takeRecords(): ResizeObserverEntry[] {
      return [];
    }
    unobserve(_target: Element): void {
      return;
    }
  }
  globalThis.ResizeObserver = FakeObserver;
  let sizeCalls = 0;
  const created = await createEngine({
    canvas: document.createElement("canvas"),
    createRenderer: fakeRenderer({
      failUnlessWebGL: false,
      onSize: () => {
        sizeCalls += 1;
      },
    }),
    requestFrame: idleFrame,
    cancelFrame: () => {
      return;
    },
  });
  expect(isOk(created)).toBe(true);
  if (!isOk(created)) {
    globalThis.ResizeObserver = Original;
    return;
  }
  const box = document.createElement("div");
  Object.defineProperty(box, "clientWidth", { configurable: true, value: 320 });
  Object.defineProperty(box, "clientHeight", { configurable: true, value: 180 });
  document.body.appendChild(box);
  created.value.mount(box);
  expect(sizeCalls).toBe(1);
  const notify = observers[0];
  expect(notify !== undefined).toBe(true);
  if (notify !== undefined) {
    notify();
    notify();
  }
  expect(sizeCalls).toBe(1);
  created.value.dispose();
  globalThis.ResizeObserver = Original;
});

function idleFrame(_callback: FrameRequestCallback): number {
  return 0;
}

function flush(queued: FrameRequestCallback[]): void {
  const pending = [...queued];
  queued.length = 0;
  for (const callback of pending) {
    callback(0);
  }
}

function setGpu(value: object): void {
  Object.defineProperty(globalThis.navigator, "gpu", {
    configurable: true,
    enumerable: true,
    value,
  });
}

function deleteGpu(): void {
  Reflect.deleteProperty(globalThis.navigator, "gpu");
}

function fakeRenderer(options: {
  readonly failUnlessWebGL?: boolean;
  readonly failAlways?: boolean;
  readonly onRender?: () => void;
  readonly onPixelRatio?: (ratio: number) => void;
  readonly onSize?: () => void;
}): CreateGpuRenderer {
  return ({ forceWebGL }): GpuRenderer => {
    const backend = forceWebGL ? "webgl2" : "webgpu";
    return {
      backend,
      maxTextureSize: backend === "webgpu" ? 16384 : 8192,
      init: async () => {
        if (options.failAlways === true) {
          throw new Error("renderer unavailable");
        }
        if (options.failUnlessWebGL === true && !forceWebGL) {
          throw new Error("webgpu unavailable");
        }
      },
      render: () => {
        options.onRender?.();
      },
      setSize: () => {
        options.onSize?.();
      },
      setPixelRatio: (ratio) => {
        options.onPixelRatio?.(ratio);
      },
      dispose: () => {
        return;
      },
    };
  };
}
