import type { AssetSourceKind, SearchItem } from "@tessera/assets";
import { createFetchTransport, createPolyHavenSource } from "@tessera/assets";
import type { TesseraError } from "@tessera/std";
import { MemoryBlobStore } from "@tessera/storage";
import { describeError, en } from "@tessera/ui";
import type { ReactElement } from "react";
import { useState } from "react";
import { useEditor } from "../editor-context.js";
import { applyFetchedModel, applyHdri } from "./apply-source.js";

const AUTHOR = { kind: "user" as const, id: "asset-panel" };
const BLOBS = new MemoryBlobStore();
const KINDS: readonly AssetSourceKind[] = ["hdri", "model", "texture"];

/**
 * Poly Haven search and apply. Visible when `flags.polyhaven` is on (Q-0082).
 *
 * @public
 */
export function AssetPanel(): ReactElement | null {
  const editor = useEditor();
  const [text, setText] = useState("");
  const [kind, setKind] = useState<AssetSourceKind>("hdri");
  const [items, setItems] = useState<readonly SearchItem[]>([]);
  const [page, setPage] = useState(1);
  const [nextPage, setNextPage] = useState<number | undefined>(undefined);
  if (!editor.flags.polyhaven) {
    return null;
  }
  const source = createPolyHavenSource({
    transport: createFetchTransport(),
    clock: editor.clock,
  });

  function logFailure(
    event: string,
    result: { readonly ok: false; readonly error: TesseraError },
  ): void {
    editor.logger.error(event, { text: describeError(result.error).text });
  }

  return (
    <nav aria-label={en.assetPanel.label}>
      <label>
        {en.assetPanel.search}
        <input
          type="search"
          value={text}
          onChange={(event) => {
            setText(event.currentTarget.value);
          }}
        />
      </label>
      <label>
        {en.assetPanel.kind}
        <select
          value={kind}
          onChange={(event) => {
            const next = event.currentTarget.value;
            if (next === "hdri" || next === "model" || next === "texture") {
              setKind(next);
            }
          }}
        >
          {KINDS.map((entry) => (
            <option key={entry} value={entry}>
              {en.assetPanel.kinds[entry]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => {
          void source
            .search({ text, kind, page: 1, pageSize: 20 }, new AbortController().signal)
            .then((result) => {
              if (!result.ok) {
                logFailure("web.asset_panel.search", result);
                return;
              }
              setItems(result.value.items);
              setPage(1);
              setNextPage(result.value.nextPage);
            });
        }}
      >
        {en.assetPanel.search}
      </button>
      {nextPage !== undefined ? (
        <button
          type="button"
          onClick={() => {
            void source
              .search({ text, kind, page: nextPage, pageSize: 20 }, new AbortController().signal)
              .then((result) => {
                if (!result.ok) {
                  logFailure("web.asset_panel.search", result);
                  return;
                }
                setItems(result.value.items);
                setPage(nextPage);
                setNextPage(result.value.nextPage);
              });
          }}
        >
          {en.assetPanel.nextPage}
        </button>
      ) : null}
      <p>
        {en.assetPanel.page} {page}
      </p>
      <label>
        {en.assetPanel.upload}
        <input
          type="file"
          multiple
          onChange={(event) => {
            const list = event.currentTarget.files;
            if (list === null || list.length === 0) {
              return;
            }
            const files = Array.from(list);
            void editor.assets
              .importFiles(files, { author: AUTHOR }, new AbortController().signal)
              .then((result) => {
                if (!result.ok) {
                  logFailure("web.asset_panel.upload", result);
                }
              });
          }}
        />
      </label>
      <p>{en.assetPanel.licenseNudge}</p>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <span>{item.name}</span>
            {item.kind === "hdri" || item.kind === "model" || item.kind === "texture" ? (
              <button
                type="button"
                onClick={() => {
                  void source
                    .fetch(item, { resolution: "1k" }, BLOBS, new AbortController().signal)
                    .then((fetched) => {
                      if (!fetched.ok) {
                        logFailure("web.asset_panel.fetch", fetched);
                        return;
                      }
                      if (item.kind === "hdri") {
                        const applied = applyHdri(editor.commands, fetched.value, item, AUTHOR);
                        if (!applied.ok) {
                          logFailure("web.asset_panel.apply", applied);
                        }
                        return;
                      }
                      if (item.kind === "texture") {
                        return editor.assets
                          .addFromSource(
                            "polyhaven",
                            item,
                            { author: AUTHOR },
                            new AbortController().signal,
                          )
                          .then((applied) => {
                            if (!applied.ok) {
                              logFailure("web.asset_panel.apply", applied);
                            }
                          });
                      }
                      return applyFetchedModel(
                        editor.assets,
                        BLOBS,
                        editor.clock,
                        fetched.value,
                        item,
                        AUTHOR,
                        new AbortController().signal,
                      ).then((applied) => {
                        if (!applied.ok) {
                          logFailure("web.asset_panel.apply", applied);
                        }
                      });
                    });
                }}
              >
                {en.assetPanel.apply}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </nav>
  );
}
