import type { JobHandle } from "@tessera/core";
import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import type { ImportPlan } from "./import-plan.js";

/**
 * Job handle returned by the asset façade (`08` §10).
 *
 * @public
 */
export interface ImportJobHandle {
  readonly id: string;
  readonly etaSeconds: number;
  result(): Promise<Result<ImportPlan, TesseraError>>;
}

/**
 * Wraps a {@link JobHandle} whose spec result is an {@link ImportPlan}.
 *
 * @public
 */
export function importJobHandle(handle: JobHandle, etaSeconds: number): ImportJobHandle {
  return {
    id: handle.id,
    etaSeconds,
    async result() {
      const finished = await handle.result();
      if (!finished.ok) {
        return finished;
      }
      if (!isImportPlan(finished.value)) {
        return err(tesseraError("INVARIANT_VIOLATION", "job did not return an ImportPlan"));
      }
      return ok(finished.value);
    },
  };
}

function isImportPlan(value: unknown): value is ImportPlan {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("blobs" in value) || !("assets" in value) || !("warnings" in value)) {
    return false;
  }
  return Array.isArray(value.blobs) && Array.isArray(value.assets) && Array.isArray(value.warnings);
}
