import { EnvironmentSchema, environmentSetCommand } from "@tessera/schema";
import { err, ok, tesseraError } from "@tessera/std";
import { defineCommand, mergeDeep } from "./helpers.js";

export const environmentSet = defineCommand(environmentSetCommand, {
  validate() {
    return ok(undefined);
  },
  handle(ctx, input) {
    const current = ctx.doc.snapshot().environment;
    const parsed = EnvironmentSchema.safeParse(mergeDeep(current, input.patch));
    if (!parsed.success) {
      return err(
        tesseraError("INVALID_INPUT", "invalid environment", { issues: parsed.error.issues }),
      );
    }
    const updated = ctx.write.setEnvironment(parsed.data);
    if (!updated.ok) {
      return updated;
    }
    return ok({});
  },
});
