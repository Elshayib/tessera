import type { Author, CommandBus, DocumentReader } from "@tessera/core";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { en } from "../i18n/en.js";
import { useSelectionStore } from "../selection-store.js";
import { reorderEntity, reparentEntity } from "./actions.js";
import { collectOutlinerRows } from "./visible-tree.js";

/**
 * Props for {@link Outliner}.
 *
 * @public
 */
export interface OutlinerProps {
  readonly reader: DocumentReader;
  readonly bus: CommandBus;
  readonly author: Author;
}

/**
 * Accessible entity tree. Selection is UI-only; mutations go through the command bus.
 *
 * @example
 * ```tsx
 * <Outliner reader={reader} bus={bus} author={author} />
 * ```
 *
 * @public
 */
export function Outliner(props: OutlinerProps): ReactElement {
  const [nameGlob, setNameGlob] = useState("");
  const [tag, setTag] = useState("");
  const [version, setVersion] = useState(0);
  const ids = useSelectionStore((state) => state.ids);
  const focusedId = useSelectionStore((state) => state.focusedId);
  const setSelection = useSelectionStore((state) => state.setSelection);
  const setFocused = useSelectionStore((state) => state.setFocused);
  useEffect(() => {
    return props.reader.subscribe(() => {
      setVersion((current) => current + 1);
    });
  }, [props.reader]);
  const rows = collectOutlinerRows(props.reader, { nameGlob, tag });
  void version;
  const selectedId = ids[0];
  const onKeyDown = (event: { readonly key: string; preventDefault(): void }): void => {
    if (rows.length === 0) {
      return;
    }
    const current = focusedId ?? rows[0]?.id;
    if (current === undefined) {
      return;
    }
    let index = 0;
    for (let i = 0; i < rows.length; i += 1) {
      if (rows[i]?.id === current) {
        index = i;
        break;
      }
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = rows[index + 1]?.id ?? current;
      setFocused(next);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      const prev = rows[index - 1]?.id ?? current;
      setFocused(prev);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      const row = rows[index];
      if (row?.parent !== null && row !== undefined) {
        setFocused(row.parent);
      }
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      const next = rows[index + 1];
      const row = rows[index];
      if (next !== undefined && row !== undefined && next.depth > row.depth) {
        setFocused(next.id);
      }
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelection([current]);
    }
  };
  return (
    <div className="t-outliner">
      <label>
        {en.outliner.search}
        <input
          type="search"
          value={nameGlob}
          onChange={(event) => setNameGlob(event.target.value)}
          aria-label={en.outliner.search}
        />
      </label>
      <label>
        {en.outliner.tag}
        <input
          type="text"
          value={tag}
          onChange={(event) => setTag(event.target.value)}
          aria-label={en.outliner.tag}
        />
      </label>
      <button
        type="button"
        onClick={() => {
          if (selectedId === undefined || focusedId === null || selectedId === focusedId) {
            return;
          }
          reparentEntity(props.bus, props.author, selectedId, focusedId);
        }}
      >
        {en.outliner.reparent}
      </button>
      <button
        type="button"
        onClick={() => {
          if (selectedId === undefined) {
            return;
          }
          reorderEntity(props.bus, props.reader, props.author, selectedId, "up");
        }}
      >
        {en.outliner.moveUp}
      </button>
      <button
        type="button"
        onClick={() => {
          if (selectedId === undefined) {
            return;
          }
          reorderEntity(props.bus, props.reader, props.author, selectedId, "down");
        }}
      >
        {en.outliner.moveDown}
      </button>
      <div role="tree" aria-label={en.outliner.tree} tabIndex={0} onKeyDown={onKeyDown}>
        {rows.map((row) => (
          <div
            key={row.id}
            role="treeitem"
            tabIndex={focusedId === row.id ? 0 : -1}
            aria-selected={ids.includes(row.id)}
            aria-level={row.depth + 1}
            data-entity-id={row.id}
            style={{ paddingLeft: `${row.depth * 12}px` }}
            onClick={() => {
              setSelection([row.id]);
              setFocused(row.id);
            }}
            onKeyDown={onKeyDown}
          >
            {row.name}
          </div>
        ))}
      </div>
    </div>
  );
}
