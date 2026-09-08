import { fromYDoc } from "@tessera/core";
import type { EngineHandle } from "@tessera/engine";
import { useSelectionStore, ViewportHost } from "@tessera/ui";
import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import { useEditor } from "../editor-context.js";
import { applyTransformIntent } from "./apply-intent.js";
import { loadViewportCamera, saveViewportCamera } from "./camera-store.js";
import { nudgeIntent, TRANSLATE_SNAP_M } from "./nudge.js";

const VIEWPORT_AUTHOR = { kind: "user" as const, id: "viewport" };

/**
 * Hosts {@link EngineHandle}, applies gizmo intents, and handles arrow-key nudge.
 *
 * @public
 */
export function Viewport(): ReactElement {
  const editor = useEditor();
  const ids = useSelectionStore((state) => state.ids);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const engineRef = useRef<EngineHandle | undefined>(undefined);
  useEffect(() => {
    if (canvas === null) {
      return;
    }
    let disposed = false;
    let engine: EngineHandle | undefined;
    let stopIntent: (() => void) | undefined;
    void import("../engine-entry.js").then(async (mod) => {
      const created = await mod.createEngine({ canvas });
      if (!created.ok || disposed) {
        if (created.ok) {
          created.value.dispose();
        }
        return;
      }
      engine = created.value;
      engineRef.current = engine;
      const stored = loadViewportCamera();
      if (stored !== undefined) {
        engine.setViewportCamera({
          position: [stored.position[0], stored.position[1], stored.position[2]],
          target: [stored.target[0], stored.target[1], stored.target[2]],
        });
      }
      const parent = canvas.parentElement;
      if (parent !== null) {
        engine.mount(parent);
      }
      engine.setGizmo("translate", "world");
      engine.setSnapping({
        enabled: true,
        translate: TRANSLATE_SNAP_M,
        rotateDeg: 15,
        scale: 0.1,
      });
      stopIntent = engine.events.on("intent", (intent) => {
        if (intent.kind === "transform.set") {
          applyTransformIntent(editor.commands, VIEWPORT_AUTHOR, intent);
          return;
        }
        if (intent.kind === "select") {
          useSelectionStore.getState().setSelection(intent.ids);
        }
      });
    });
    return () => {
      disposed = true;
      stopIntent?.();
      engineRef.current = undefined;
      if (engine !== undefined) {
        saveViewportCamera(engine.getViewportCamera());
        engine.dispose();
      }
    };
  }, [canvas, editor.commands]);
  useEffect(() => {
    engineRef.current?.setSelection(ids);
  }, [ids]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      const intent = nudgeIntent(fromYDoc(editor.document.ydoc), ids, event.key, event.shiftKey);
      if (intent === undefined) {
        return;
      }
      event.preventDefault();
      applyTransformIntent(editor.commands, VIEWPORT_AUTHOR, intent);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [editor.commands, editor.document.ydoc, ids]);
  return <ViewportHost canvasRef={setCanvas} />;
}
