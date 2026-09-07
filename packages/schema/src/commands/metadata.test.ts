import { expect, test } from "vitest";
import { metadataSetCommand } from "./metadata.js";

test("metadata command input rejects invalid payloads", () => {
  expect(metadataSetCommand.input.safeParse({ target: "e_aaaaaaaaaa" }).success).toBe(false);
  expect(
    metadataSetCommand.input.safeParse({
      target: "e_aaaaaaaaaa",
      patch: { note: "ok", gone: null },
    }).success,
  ).toBe(true);
});
