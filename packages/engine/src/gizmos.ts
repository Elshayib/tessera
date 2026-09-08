import type { Transform } from "@tessera/schema";
import type { Emitter } from "@tessera/std";
import type { Camera, Object3D, Scene } from "three";
import { MathUtils, type Vector3 } from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import type { EngineEvents, EngineIntent } from "./types.js";

const LAYER_GIZMO = 2;

/**
 * Options for {@link createGizmoController}.
 *
 * @public
 */
export interface CreateGizmoControllerOptions {
  readonly scene: Scene;
  readonly camera: Camera;
  readonly domElement: HTMLElement;
  readonly events: Emitter<EngineEvents>;
}

/**
 * TransformControls wrapper that emits one `transform.set` intent per drag (`INV-RND-04`).
 *
 * @public
 */
export interface GizmoController {
  setMode(mode: "translate" | "rotate" | "scale" | "none", space: "world" | "local"): void;
  setSnapping(snapping: {
    enabled: boolean;
    translate: number;
    rotateDeg: number;
    scale: number;
  }): void;
  setSelection(objects: readonly Object3D[]): void;
  setDragging(dragging: boolean): void;
  cancelDrag(): void;
  dispose(): void;
}

/**
 * Creates gizmo controls. The engine never writes the document; the UI executes emitted intents.
 *
 * @example
 * ```ts
 * const gizmo = createGizmoController({ scene, camera, domElement, events });
 * gizmo.setSelection([group]);
 * ```
 *
 * @public
 */
export function createGizmoController(options: CreateGizmoControllerOptions): GizmoController {
  return new GizmoControllerImpl(options);
}

class GizmoControllerImpl implements GizmoController {
  readonly #controls: TransformControls;
  readonly #events: Emitter<EngineEvents>;
  readonly #helper: Object3D;
  readonly #scene: Scene;
  readonly #onKey: (event: KeyboardEvent) => void;
  readonly #document: Document;
  #targets: Object3D[] = [];
  #snapshot: Snapshot[] = [];
  #dragging = false;
  #emitRelease = true;
  #mode: "translate" | "rotate" | "scale" | "none" = "translate";

  constructor(options: CreateGizmoControllerOptions) {
    this.#events = options.events;
    this.#scene = options.scene;
    this.#document = options.domElement.ownerDocument;
    this.#controls = new TransformControls(options.camera, options.domElement);
    this.#helper = this.#controls.getHelper();
    this.#helper.traverse((object) => {
      object.layers.set(LAYER_GIZMO);
    });
    this.#scene.add(this.#helper);
    this.#controls.addEventListener("dragging-changed", (event) => {
      const value = Reflect.get(event, "value");
      if (value === true) {
        this.#beginDrag();
      } else if (value === false) {
        this.#endDrag();
      }
    });
    this.#onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        this.cancelDrag();
      }
    };
    this.#document.addEventListener("keydown", this.#onKey);
  }

  setMode(mode: "translate" | "rotate" | "scale" | "none", space: "world" | "local"): void {
    this.#mode = mode;
    if (mode === "none") {
      this.#controls.enabled = false;
      this.#controls.detach();
      return;
    }
    this.#controls.enabled = true;
    this.#controls.mode = mode;
    this.#controls.space = space;
    this.#attachFirst();
  }

  setSnapping(snapping: {
    enabled: boolean;
    translate: number;
    rotateDeg: number;
    scale: number;
  }): void {
    if (snapping.enabled) {
      this.#controls.translationSnap = snapping.translate;
      this.#controls.rotationSnap = MathUtils.degToRad(snapping.rotateDeg);
      this.#controls.scaleSnap = snapping.scale;
      return;
    }
    this.#controls.translationSnap = null;
    this.#controls.rotationSnap = null;
    this.#controls.scaleSnap = null;
  }

  setSelection(objects: readonly Object3D[]): void {
    this.#targets = [...objects];
    this.#attachFirst();
  }

  setDragging(dragging: boolean): void {
    this.#controls.dragging = dragging;
  }

  cancelDrag(): void {
    if (!this.#dragging) {
      return;
    }
    restore(this.#snapshot);
    this.#emitRelease = false;
    this.#controls.dragging = false;
    this.#emitRelease = true;
  }

  dispose(): void {
    this.#document.removeEventListener("keydown", this.#onKey);
    this.#scene.remove(this.#helper);
    this.#controls.dispose();
  }

  #attachFirst(): void {
    const first = this.#targets[0];
    if (first === undefined || this.#mode === "none") {
      this.#controls.detach();
      return;
    }
    this.#controls.attach(first);
  }

  #beginDrag(): void {
    if (this.#dragging) {
      return;
    }
    this.#dragging = true;
    this.#snapshot = this.#targets.map(capture);
  }

  #endDrag(): void {
    const wasDragging = this.#dragging;
    this.#dragging = false;
    if (!wasDragging || !this.#emitRelease) {
      this.#snapshot = [];
      return;
    }
    const targets = this.#targets
      .map((object) => {
        const id = object.userData["entityId"];
        if (typeof id !== "string") {
          return undefined;
        }
        return { id, transform: toTransform(object) };
      })
      .filter((entry): entry is { id: string; transform: Transform } => entry !== undefined);
    this.#snapshot = [];
    if (targets.length === 0) {
      return;
    }
    const intent: EngineIntent = {
      kind: "transform.set",
      targets,
      label: dragLabel(this.#mode, this.#targets[0]),
    };
    this.#events.emit("intent", intent);
  }
}

interface Snapshot {
  readonly object: Object3D;
  readonly position: Vector3;
  readonly rotation: { x: number; y: number; z: number };
  readonly scale: Vector3;
}

function capture(object: Object3D): Snapshot {
  return {
    object,
    position: object.position.clone(),
    rotation: { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z },
    scale: object.scale.clone(),
  };
}

function restore(snapshot: readonly Snapshot[]): void {
  for (const entry of snapshot) {
    entry.object.position.copy(entry.position);
    entry.object.rotation.set(entry.rotation.x, entry.rotation.y, entry.rotation.z);
    entry.object.scale.copy(entry.scale);
    entry.object.updateMatrix();
  }
}

function toTransform(object: Object3D): Transform {
  object.rotation.order = "XYZ";
  return {
    position: [object.position.x, object.position.y, object.position.z],
    rotation: [
      MathUtils.radToDeg(object.rotation.x),
      MathUtils.radToDeg(object.rotation.y),
      MathUtils.radToDeg(object.rotation.z),
    ],
    scale: [object.scale.x, object.scale.y, object.scale.z],
  };
}

function dragLabel(
  mode: "translate" | "rotate" | "scale" | "none",
  object: Object3D | undefined,
): string {
  const verb = mode === "rotate" ? "Rotate" : mode === "scale" ? "Scale" : "Move";
  const name = object?.userData["name"];
  const label = typeof name === "string" && name.length > 0 ? name : "Entity";
  return `${verb} ${label}`;
}
