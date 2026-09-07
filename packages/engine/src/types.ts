import type { EntityId, Transform, Vec3 } from "@tessera/schema";
import type { Emitter, Result, TesseraError } from "@tessera/std";

/**
 * GPU backend and limits (`05` §3).
 *
 * @public
 */
export interface EngineCapabilities {
  readonly backend: "webgpu" | "webgl2";
  readonly compute: boolean;
  readonly maxDynamicLights: number;
  readonly maxTextureSize: number;
  readonly compressedTextures: readonly ("ktx2-etc1s" | "ktx2-uastc")[];
  readonly float16Textures: boolean;
}

/**
 * Sampled renderer.info (`05` §9).
 *
 * @public
 */
export interface ViewportStats {
  readonly fps: number;
  readonly frameMs: number;
  readonly drawCalls: number;
  readonly triangles: number;
  readonly textures: number;
  readonly geometries: number;
  readonly programs: number;
}

/**
 * Viewport camera pose (Q-0039). Look-at form; `camera-controls` stores the same pair.
 *
 * @public
 */
export interface CameraPose {
  readonly position: Vec3;
  readonly target: Vec3;
}

/**
 * Helper visibility (`05` §7).
 *
 * @public
 */
export interface HelperFlags {
  readonly grid?: boolean;
  readonly axes?: boolean;
  readonly lights?: boolean;
  readonly cameras?: boolean;
  readonly colliders?: boolean;
}

/**
 * Nearest pick hit (`05` §6).
 *
 * @public
 */
export interface PickResult {
  readonly entityId: EntityId;
  readonly point: Vec3;
  readonly normal: Vec3;
  readonly distance: number;
}

/**
 * World-space ray hit (`05` §12).
 *
 * @public
 */
export interface RaycastHit {
  readonly entityId: EntityId;
  readonly point: Vec3;
  readonly normal: Vec3;
  readonly distance: number;
}

/**
 * Intents the UI turns into commands (`05` §12). The engine never writes the document.
 *
 * @public
 */
export type EngineIntent =
  | {
      readonly kind: "transform.set";
      readonly targets: readonly { readonly id: EntityId; readonly transform: Transform }[];
      readonly label: string;
    }
  | { readonly kind: "select"; readonly ids: readonly EntityId[]; readonly additive: boolean }
  | { readonly kind: "focus"; readonly id: EntityId };

/**
 * Engine event map (`05` §12).
 *
 * @public
 */
export type EngineEvents = {
  readonly intent: EngineIntent;
  readonly hover: { readonly id: EntityId | null };
  readonly pick: PickResult | null;
  readonly "capabilities.changed": EngineCapabilities;
  readonly device_lost: { readonly message: string };
  readonly "asset.state": { readonly id: string; readonly state: "loading" | "ready" | "error" };
};

/**
 * Screenshot request (`05` §10). T-0107 implements capture; T-0104 returns `UNSUPPORTED`.
 *
 * @public
 */
export interface ScreenshotOptions {
  readonly width: number;
  readonly height: number;
  readonly camera:
    | { readonly kind: "viewport" }
    | { readonly kind: "entity"; readonly id: EntityId }
    | {
        readonly kind: "preset";
        readonly preset: "top" | "front" | "iso";
        readonly frame: readonly EntityId[] | "all";
      };
  readonly includeHelpers?: boolean;
  readonly format?: "png" | "jpeg";
  readonly background?: "scene" | "neutral";
}

/**
 * Screenshot result (`05` §10).
 *
 * @public
 */
export interface Screenshot {
  readonly blob: Blob;
  readonly width: number;
  readonly height: number;
  readonly camera: CameraPose;
  readonly renderedAt: string;
}

/**
 * Public engine host (`05` §12). T-0104 implements mount/loop/dispose; later tickets fill sync, gizmos, and screenshots.
 *
 * @public
 */
export interface EngineHandle {
  readonly capabilities: EngineCapabilities;
  readonly canvas: HTMLCanvasElement;
  readonly stats: Readonly<ViewportStats>;
  readonly events: Emitter<EngineEvents>;
  mount(container: HTMLElement): void;
  unmount(): void;
  setSelection(ids: readonly EntityId[]): void;
  setGizmo(mode: "translate" | "rotate" | "scale" | "none", space: "world" | "local"): void;
  setSnapping(snapping: {
    enabled: boolean;
    translate: number;
    rotateDeg: number;
    scale: number;
  }): void;
  setHelpers(flags: Partial<HelperFlags>): void;
  frame(
    targets: readonly EntityId[] | "all",
    options?: { padding?: number; animate?: boolean },
  ): void;
  getViewportCamera(): CameraPose;
  setViewportCamera(pose: CameraPose): void;
  lookThrough(cameraEntity: EntityId | null): void;
  pick(x: number, y: number): PickResult | null;
  raycast(origin: Vec3, direction: Vec3, maxDistance?: number): readonly RaycastHit[];
  screenshot(
    options: ScreenshotOptions,
    signal?: AbortSignal,
  ): Promise<Result<Screenshot, TesseraError>>;
  requestRender(): void;
  dispose(): void;
}

/**
 * Abstract GPU renderer so tests can run without a GPU (Q-0040).
 *
 * @public
 */
export interface GpuRenderer {
  readonly backend: "webgpu" | "webgl2";
  readonly maxTextureSize: number;
  init(): Promise<void>;
  render(): void;
  setSize(width: number, height: number): void;
  setPixelRatio(ratio: number): void;
  dispose(): void;
}

/**
 * Factory for {@link GpuRenderer}.
 *
 * @public
 */
export type CreateGpuRenderer = (options: {
  readonly canvas: HTMLCanvasElement;
  readonly antialias: boolean;
  readonly forceWebGL: boolean;
}) => GpuRenderer;
