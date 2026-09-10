import { expect, test } from "vitest";
import {
  assistantText,
  DEFAULT_MAX_TOOLS,
  mapProviderError,
  needsCapabilityProbe,
  PACKAGE_NAME,
  systemMessage,
  UNKNOWN_CONTEXT_TOKENS,
} from "./index.js";

test("exports PACKAGE_NAME", () => {
  expect(PACKAGE_NAME).toBe("@tessera/llm");
  expect(DEFAULT_MAX_TOOLS).toBe(64);
  expect(UNKNOWN_CONTEXT_TOKENS).toBe(32_000);
  expect(needsCapabilityProbe({ inCuratedDescriptorList: true })).toBe(false);
  expect(systemMessage("x").role).toBe("system");
  expect(assistantText("y").role).toBe("assistant");
  expect(mapProviderError({ kind: "abort" }).code).toBe("CANCELLED");
});
