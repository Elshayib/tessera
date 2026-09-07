import { isErr, isOk } from "@tessera/std";
import { expect, test } from "vitest";
import { emptyDocument } from "../defaults.js";
import { migrate } from "./index.js";

test("migrate unknown version → UNSUPPORTED", () => {
  const current = migrate(emptyDocument());
  expect(isOk(current)).toBe(true);

  const newer = migrate({ ...emptyDocument(), version: "9.0.0" });
  expect(isErr(newer)).toBe(true);
  if (isErr(newer)) {
    expect(newer.error.code).toBe("UNSUPPORTED");
  }

  const missingVersion = migrate({ hello: true });
  expect(isErr(missingVersion)).toBe(true);

  expect(isErr(migrate(null))).toBe(true);
  expect(isErr(migrate([]))).toBe(true);
  expect(isErr(migrate({ version: "0.1.0" }))).toBe(true);
});
