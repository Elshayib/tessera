import type { Document } from "@tessera/schema";
import { emptyDocument } from "@tessera/schema";
import type { Clock, Logger } from "@tessera/std";
import { createLogger, systemClock } from "@tessera/std";
import { createDocumentReader } from "./document-reader.js";
import type { DocumentHandle, DocumentReader } from "./document-types.js";
import { toYDoc } from "./yjs-mapping.js";

export interface CreateDocumentOptions {
  readonly snapshot?: Document;
  readonly clock?: Clock;
  readonly logger?: Logger;
}

export interface CreateDocumentResult {
  readonly doc: DocumentHandle;
  readonly reader: DocumentReader;
}

/**
 * Creates a live Yjs document and a reader.
 *
 * @example
 * ```ts
 * const { reader } = createDocument();
 * reader.snapshot().version === "0.1.0";
 * ```
 *
 * @public
 */
export function createDocument(opts: CreateDocumentOptions = {}): CreateDocumentResult {
  const snapshot = opts.snapshot ?? emptyDocument();
  const ydoc = toYDoc(snapshot);
  const doc: DocumentHandle = {
    ydoc,
    clock: opts.clock ?? systemClock,
    logger: opts.logger ?? createLogger([]),
  };
  return { doc, reader: createDocumentReader(ydoc) };
}
