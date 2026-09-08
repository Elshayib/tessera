import { MemoryBlobStore } from "@tessera/storage";
import { describeError, en } from "@tessera/ui";
import type { ReactElement } from "react";
import { useEditor } from "../editor-context.js";
import {
  exportLiveArchive,
  importProjectArchive,
  liveSnapshot,
  persistLiveDocument,
} from "./project-io.js";

const AUTHOR_BLOBS = new MemoryBlobStore();

/**
 * Save / download / open archive controls (Q-0075).
 *
 * @public
 */
export function ProjectIo(): ReactElement {
  const editor = useEditor();
  return (
    <nav aria-label={en.projectIo.label}>
      <button
        type="button"
        onClick={() => {
          void persistLiveDocument({
            storage: editor.storage,
            snapshot: liveSnapshot(editor.document),
            blobs: AUTHOR_BLOBS,
            createdAt: editor.clock.nowIso(),
          }).then((result) => {
            if (!result.ok) {
              editor.logger.error("web.project_io.save", {
                text: describeError(result.error).text,
              });
            }
          });
        }}
      >
        {en.projectIo.save}
      </button>
      <button
        type="button"
        onClick={() => {
          void exportLiveArchive({
            snapshot: liveSnapshot(editor.document),
            blobs: AUTHOR_BLOBS,
            createdAt: editor.clock.nowIso(),
          }).then((result) => {
            if (!result.ok) {
              editor.logger.error("web.project_io.download", {
                text: describeError(result.error).text,
              });
              return;
            }
            const url = URL.createObjectURL(result.value);
            const link = document.createElement("a");
            link.href = url;
            link.download = "project.tessera";
            link.click();
            URL.revokeObjectURL(url);
          });
        }}
      >
        {en.projectIo.download}
      </button>
      <input
        type="file"
        accept=".tessera,application/zip"
        aria-label={en.projectIo.open}
        onChange={(event) => {
          const list = event.currentTarget.files;
          if (list === null) {
            return;
          }
          const file = list.item(0);
          if (file === null) {
            return;
          }
          void importProjectArchive(editor.storage, file).then((result) => {
            if (!result.ok) {
              editor.logger.error("web.project_io.open", {
                text: describeError(result.error).text,
              });
            }
          });
        }}
      />
    </nav>
  );
}
