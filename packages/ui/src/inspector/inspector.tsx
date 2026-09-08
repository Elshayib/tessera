import type { Author, CommandBus, DocumentReader } from "@tessera/core";
import type { Entity } from "@tessera/schema";
import {
  CameraSchema,
  ColliderSchema,
  LightSchema,
  MeshRendererSchema,
  MetadataSchema,
  RigidBodySchema,
  TransformSchema,
} from "@tessera/schema";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { en } from "../i18n/en.js";
import { useSelectionStore } from "../selection-store.js";
import { commitInspectorPatch } from "./commit.js";
import { FieldControl } from "./field-control.js";
import { type InspectorSchema, listInspectorFields } from "./fields.js";

/**
 * Props for {@link Inspector}.
 *
 * @public
 */
export interface InspectorProps {
  readonly reader: DocumentReader;
  readonly bus: CommandBus;
  readonly author: Author;
  readonly entityId?: string;
}

const SECTIONS: readonly { readonly type: string; readonly schema: InspectorSchema }[] = [
  { type: "transform", schema: TransformSchema },
  { type: "meshRenderer", schema: MeshRendererSchema },
  { type: "light", schema: LightSchema },
  { type: "camera", schema: CameraSchema },
  { type: "collider", schema: ColliderSchema },
  { type: "rigidBody", schema: RigidBodySchema },
  { type: "metadata", schema: MetadataSchema },
];

function componentValue(entity: Entity, type: string): unknown {
  if (type === "transform") {
    return entity.components.transform;
  }
  if (type === "meshRenderer") {
    return entity.components.meshRenderer;
  }
  if (type === "light") {
    return entity.components.light;
  }
  if (type === "camera") {
    return entity.components.camera;
  }
  if (type === "collider") {
    return entity.components.collider;
  }
  if (type === "rigidBody") {
    return entity.components.rigidBody;
  }
  if (type === "metadata") {
    return entity.components.metadata;
  }
  return undefined;
}

function readKey(record: unknown, key: string): unknown {
  if (typeof record !== "object" || record === null) {
    return undefined;
  }
  for (const [name, value] of Object.entries(record)) {
    if (name === key) {
      return value;
    }
  }
  return undefined;
}

/**
 * Schema-driven inspector. Values come from {@link DocumentReader}; edits use the command bus.
 *
 * @example
 * ```tsx
 * <Inspector reader={reader} bus={bus} author={author} />
 * ```
 *
 * @public
 */
export function Inspector(props: InspectorProps): ReactElement {
  const selected = useSelectionStore((state) => state.ids[0]);
  const entityId = props.entityId ?? selected;
  const [version, setVersion] = useState(0);
  useEffect(() => {
    return props.reader.subscribe(() => {
      setVersion((current) => current + 1);
    });
  }, [props.reader]);
  void version;
  if (entityId === undefined) {
    return <p>{en.inspector.empty}</p>;
  }
  const entity = props.reader.getEntity(entityId);
  if (entity === undefined) {
    return <p>{en.inspector.empty}</p>;
  }
  const blocks: ReactElement[] = [];
  for (const section of SECTIONS) {
    const record = componentValue(entity, section.type);
    if (record === undefined) {
      continue;
    }
    const fields = listInspectorFields(section.schema, record);
    for (const field of fields) {
      blocks.push(
        <FieldControl
          key={`${section.type}.${field.key}`}
          fieldKey={field.key}
          label={field.meta.label}
          widget={field.widget}
          value={readKey(record, field.key)}
          enumValues={field.enumValues}
          step={field.meta.step ?? 1}
          onCommit={(value) => {
            commitInspectorPatch(props.bus, props.author, entityId, section.type, field.key, value);
          }}
        />,
      );
    }
  }
  return <div className="t-inspector">{blocks}</div>;
}
