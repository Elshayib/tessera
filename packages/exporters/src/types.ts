import type { Document } from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import type { BlobStore } from "@tessera/storage";
import type { z } from "zod";

/**
 * Base export options (`09` §2).
 *
 * @public
 */
export interface ExportOptions {
  readonly selection?: readonly string[];
  readonly includeDisabled?: boolean;
  readonly outputName: string;
}

/**
 * Files produced by an {@link Exporter} (`09` §2).
 *
 * @public
 */
export interface ExportBundle {
  readonly files: readonly { readonly path: string; readonly blob: Blob }[];
  readonly warnings: readonly string[];
  readonly attribution?: string;
}

/**
 * Headless exporter over a document snapshot and blob store (`09` §2, INV-EXP-01).
 *
 * @public
 */
export interface Exporter<O = ExportOptions> {
  readonly id: string;
  readonly displayName: string;
  readonly fileExtensions: readonly string[];
  readonly optionsSchema: z.ZodType<O, unknown>;
  export(
    input: {
      readonly document: Document;
      readonly blobs: BlobStore;
      readonly options: O;
    },
    signal?: AbortSignal,
  ): Promise<Result<ExportBundle, TesseraError>>;
}
