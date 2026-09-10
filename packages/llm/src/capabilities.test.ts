import { expect, test } from "vitest";
import {
  DEFAULT_MAX_TOOLS,
  needsCapabilityProbe,
  resolveContextLimits,
  UNKNOWN_CONTEXT_TOKENS,
  UNKNOWN_MAX_OUTPUT_TOKENS,
  withDefaultMaxTools,
} from "./index.js";
import type { Capabilities } from "./types.js";

test("INV-PRV-04 needsCapabilityProbe is true when model is not in curated list", () => {
  expect(needsCapabilityProbe({ inCuratedDescriptorList: false })).toBe(true);
  expect(needsCapabilityProbe({ inCuratedDescriptorList: true })).toBe(false);
});

test("INV-PRV-04 declared Partial<Capabilities> is not a complete profile", () => {
  const declared: Partial<Capabilities> = { vision: true };
  expect("tools" in declared).toBe(false);
  expect(needsCapabilityProbe({ inCuratedDescriptorList: false })).toBe(true);
});

test("unknown contextTokens/maxOutputTokens use 32k/4k defaults", () => {
  expect(UNKNOWN_CONTEXT_TOKENS).toBe(32_000);
  expect(UNKNOWN_MAX_OUTPUT_TOKENS).toBe(4_000);
  expect(resolveContextLimits({})).toEqual({
    contextTokens: 32_000,
    maxOutputTokens: 4_000,
  });
  expect(resolveContextLimits({ contextTokens: 128_000 })).toEqual({
    contextTokens: 128_000,
    maxOutputTokens: 4_000,
  });
  expect(resolveContextLimits({ maxOutputTokens: 8_000 })).toEqual({
    contextTokens: 32_000,
    maxOutputTokens: 8_000,
  });
  expect(resolveContextLimits({ contextTokens: 128_000, maxOutputTokens: 8_000 })).toEqual({
    contextTokens: 128_000,
    maxOutputTokens: 8_000,
  });
});

test("maxTools default is 64", () => {
  expect(DEFAULT_MAX_TOOLS).toBe(64);
  expect(withDefaultMaxTools(undefined)).toBe(64);
  expect(withDefaultMaxTools(16)).toBe(16);
});
