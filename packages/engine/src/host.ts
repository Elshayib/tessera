import type { EntityId, Vec3 } from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import { abortError, Emitter, err, ok, tesseraError } from "@tessera/std";
import type {
  CameraPose,
  CreateGpuRenderer,
  EngineCapabilities,
  EngineEvents,
  EngineHandle,
  GpuRenderer,
  HelperFlags,
  PickResult,
  RaycastHit,
  Screenshot,
  ScreenshotOptions,
  ViewportStats,
} from "./types.js";

const EMPTY_STATS: ViewportStats = {
  fps: 0,
  frameMs: 0,
  drawCalls: 0,
  triangles: 0,
  textures: 0,
  geometries: 0,
  programs: 0,
};

const DEFAULT_POSE: CameraPose = {
  position: [5, 5, 5],
  target: [0, 0, 0],
};

const COMPRESSED: readonly ("ktx2-etc1s" | "ktx2-uastc")[] = ["ktx2-etc1s", "ktx2-uastc"];

/**
 * Options for {@link createEngine}.
 *
 * @public
 */
export interface CreateEngineOptions {
  readonly canvas: HTMLCanvasElement;
  readonly events?: Emitter<EngineEvents>;
  readonly createRenderer?: CreateGpuRenderer;
  readonly requestFrame?: (callback: FrameRequestCallback) => number;
  readonly cancelFrame?: (id: number) => void;
}

/**
 * Creates the viewport host: WebGPU renderer with WebGL2 fallback, on-demand loop (`05` §2–§3).
 *
 * @example
 * ```ts
 * const created = await createEngine({ canvas });
 * if (created.ok) {
 *   created.value.mount(container);
 * }
 * ```
 *
 * @public
 */
export async function createEngine(
  options: CreateEngineOptions,
): Promise<Result<EngineHandle, TesseraError>> {
  const events = options.events ?? new Emitter<EngineEvents>();
  const createRenderer =
    options.createRenderer ?? (await import("./three-renderer.js")).createThreeRenderer;
  const requestFrame = options.requestFrame ?? defaultRequestFrame;
  const cancelFrame = options.cancelFrame ?? defaultCancelFrame;
  const gpuMissing = !hasGpu();
  let forceWebGL = gpuMissing;
  let renderer: GpuRenderer = createRenderer({
    canvas: options.canvas,
    antialias: true,
    forceWebGL,
  });
  try {
    await renderer.init();
  } catch {
    if (forceWebGL) {
      renderer.dispose();
      return err(tesseraError("IO_ERROR", "failed to initialize webgl2 renderer"));
    }
    renderer.dispose();
    forceWebGL = true;
    renderer = createRenderer({
      canvas: options.canvas,
      antialias: true,
      forceWebGL: true,
    });
    try {
      await renderer.init();
    } catch {
      renderer.dispose();
      return err(tesseraError("IO_ERROR", "failed to initialize webgl2 renderer"));
    }
  }
  const capabilities = capabilitiesFrom(renderer);
  if (forceWebGL) {
    events.emit("capabilities.changed", capabilities);
  }
  return ok(
    new EngineHost({
      canvas: options.canvas,
      capabilities,
      events,
      renderer,
      requestFrame,
      cancelFrame,
    }),
  );
}

class EngineHost implements EngineHandle {
  readonly canvas: HTMLCanvasElement;
  readonly capabilities: EngineCapabilities;
  readonly events: Emitter<EngineEvents>;
  readonly #renderer: GpuRenderer;
  readonly #requestFrame: (callback: FrameRequestCallback) => number;
  readonly #cancelFrame: (id: number) => void;
  #stats: ViewportStats = EMPTY_STATS;
  #mounted: HTMLElement | undefined;
  #observer: ResizeObserver | undefined;
  #dirty = false;
  #frameId: number | undefined;
  #disposed = false;
  #pose: CameraPose = DEFAULT_POSE;

  constructor(args: {
    readonly canvas: HTMLCanvasElement;
    readonly capabilities: EngineCapabilities;
    readonly events: Emitter<EngineEvents>;
    readonly renderer: GpuRenderer;
    readonly requestFrame: (callback: FrameRequestCallback) => number;
    readonly cancelFrame: (id: number) => void;
  }) {
    this.canvas = args.canvas;
    this.capabilities = args.capabilities;
    this.events = args.events;
    this.#renderer = args.renderer;
    this.#requestFrame = args.requestFrame;
    this.#cancelFrame = args.cancelFrame;
  }

  get stats(): Readonly<ViewportStats> {
    return this.#stats;
  }

  mount(container: HTMLElement): void {
    if (this.#disposed) {
      return;
    }
    this.unmount();
    this.#mounted = container;
    container.appendChild(this.canvas);
    this.#observer = new ResizeObserver(() => {
      this.#resizeToContainer();
      this.requestRender();
    });
    this.#observer.observe(container);
    this.#resizeToContainer();
    this.requestRender();
  }

  unmount(): void {
    const observer = this.#observer;
    if (observer !== undefined) {
      observer.disconnect();
      this.#observer = undefined;
    }
    this.#cancelScheduled();
    const parent = this.canvas.parentElement;
    if (parent !== null) {
      parent.removeChild(this.canvas);
    }
    this.#mounted = undefined;
  }

  setSelection(_ids: readonly EntityId[]): void {
    return;
  }

  setGizmo(_mode: "translate" | "rotate" | "scale" | "none", _space: "world" | "local"): void {
    return;
  }

  setSnapping(_snapping: {
    enabled: boolean;
    translate: number;
    rotateDeg: number;
    scale: number;
  }): void {
    return;
  }

  setHelpers(_flags: Partial<HelperFlags>): void {
    return;
  }

  frame(
    _targets: readonly EntityId[] | "all",
    _options?: { padding?: number; animate?: boolean },
  ): void {
    return;
  }

  getViewportCamera(): CameraPose {
    return this.#pose;
  }

  setViewportCamera(pose: CameraPose): void {
    this.#pose = pose;
    this.requestRender();
  }

  lookThrough(_cameraEntity: EntityId | null): void {
    return;
  }

  pick(_x: number, _y: number): PickResult | null {
    return null;
  }

  raycast(_origin: Vec3, _direction: Vec3, _maxDistance?: number): readonly RaycastHit[] {
    return [];
  }

  async screenshot(
    _options: ScreenshotOptions,
    signal?: AbortSignal,
  ): Promise<Result<Screenshot, TesseraError>> {
    if (signal?.aborted === true) {
      return err(abortError());
    }
    return err(tesseraError("UNSUPPORTED", "screenshot is not implemented"));
  }

  requestRender(): void {
    if (this.#disposed) {
      return;
    }
    this.#dirty = true;
    this.#schedule();
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.unmount();
    this.#renderer.dispose();
  }

  #resizeToContainer(): void {
    const container = this.#mounted;
    if (container === undefined) {
      return;
    }
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    const ratio = Math.min(2, globalThis.devicePixelRatio || 1);
    this.#renderer.setPixelRatio(ratio);
    this.#renderer.setSize(width, height);
  }

  #schedule(): void {
    if (this.#disposed || this.#mounted === undefined || this.#frameId !== undefined) {
      return;
    }
    this.#frameId = this.#requestFrame(() => {
      this.#frameId = undefined;
      this.#tick();
    });
  }

  #cancelScheduled(): void {
    const frameId = this.#frameId;
    if (frameId === undefined) {
      return;
    }
    this.#cancelFrame(frameId);
    this.#frameId = undefined;
  }

  #tick(): void {
    if (this.#disposed || !this.#dirty) {
      return;
    }
    this.#dirty = false;
    const started = nowMs();
    this.#renderer.render();
    const frameMs = Math.max(0, nowMs() - started);
    const fps = frameMs === 0 ? 0 : 1000 / frameMs;
    this.#stats = {
      fps,
      frameMs,
      drawCalls: 0,
      triangles: 0,
      textures: 0,
      geometries: 0,
      programs: 0,
    };
    if (this.#dirty) {
      this.#schedule();
    }
  }
}

function capabilitiesFrom(renderer: GpuRenderer): EngineCapabilities {
  const backend = renderer.backend;
  const webgpu = backend === "webgpu";
  return {
    backend,
    compute: webgpu,
    maxDynamicLights: webgpu ? 64 : 8,
    maxTextureSize: renderer.maxTextureSize,
    compressedTextures: COMPRESSED,
    float16Textures: webgpu,
  };
}

function hasGpu(): boolean {
  const navigator = globalThis.navigator;
  if (navigator === undefined) {
    return false;
  }
  const gpu = Reflect.get(navigator, "gpu");
  return gpu !== undefined && gpu !== null;
}

function defaultRequestFrame(callback: FrameRequestCallback): number {
  return globalThis.requestAnimationFrame(callback);
}

function defaultCancelFrame(id: number): void {
  globalThis.cancelAnimationFrame(id);
}

function nowMs(): number {
  return globalThis.performance.now();
}
