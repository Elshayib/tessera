import { historyListQuery } from "@tessera/schema";
import { err, ok, tesseraError } from "@tessera/std";
import { defineQuery } from "./define.js";

export const historyList = defineQuery(historyListQuery, (ctx, input) => {
  let records = [...ctx.history()];
  if (input.runId !== undefined) {
    records = records.filter((record) => record.runId === input.runId);
  }
  if (input.limit !== undefined) {
    records = records.slice(-input.limit);
  }
  const parsed = historyListQuery.output.safeParse(records);
  if (!parsed.success) {
    return err(
      tesseraError("INVARIANT_VIOLATION", "history.list output mismatch", {
        issues: parsed.error.issues,
      }),
    );
  }
  return ok(parsed.data);
});
