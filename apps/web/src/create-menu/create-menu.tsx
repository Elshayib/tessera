import { en } from "@tessera/ui";
import type { ReactElement } from "react";
import { useEditor } from "../editor-context.js";
import type { CreateLightType, CreatePrimitiveType } from "./create-actions.js";
import { createCameraEntity, createLightEntity, createPrimitiveEntity } from "./create-actions.js";

const PRIMITIVES: readonly CreatePrimitiveType[] = [
  "box",
  "sphere",
  "cylinder",
  "cone",
  "plane",
  "torus",
  "capsule",
];

const LIGHTS: readonly CreateLightType[] = ["directional", "point", "spot"];

const AUTHOR = { kind: "user" as const, id: "create-menu" };

/**
 * Create menu. Visible when `flags.createMenu` is on (Q-0068).
 *
 * @public
 */
export function CreateMenu(): ReactElement | null {
  const editor = useEditor();
  if (!editor.flags.createMenu) {
    return null;
  }
  return (
    <nav aria-label={en.createMenu.label}>
      {PRIMITIVES.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => {
            void createPrimitiveEntity(editor.commands, AUTHOR, editor.clock, type);
          }}
        >
          {en.createMenu.primitives[type]}
        </button>
      ))}
      {LIGHTS.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => {
            void createLightEntity(editor.commands, AUTHOR, type);
          }}
        >
          {en.createMenu.lights[type]}
        </button>
      ))}
      <button
        type="button"
        onClick={() => {
          void createCameraEntity(editor.commands, AUTHOR);
        }}
      >
        {en.createMenu.camera}
      </button>
    </nav>
  );
}
