import { FakeClock } from "@tessera/testing";
import { expect, test } from "vitest";
import { createProbeCache, PROBE_CACHE_TTL_MS } from "./probe-cache.js";
import type { CapabilityProfile } from "./types.js";

const profile: CapabilityProfile = {
  ref: { providerId: "openai", modelId: "m" },
  tools: "native",
  parallelTools: false,
  vision: false,
  structuredOutput: false,
  streaming: false,
  contextTokens: 32_000,
  maxOutputTokens: 4_000,
  maxTools: 64,
  needsExamples: false,
};

test("probe cache ttl 7 days", () => {
  const cache = createProbeCache();
  const clock = new FakeClock();
  cache.set(profile.ref, profile, clock.now());
  expect(cache.get(profile.ref, clock.now())).toEqual(profile);
  clock.advance(PROBE_CACHE_TTL_MS - 1);
  expect(cache.get(profile.ref, clock.now())).toEqual(profile);
  clock.advance(2);
  expect(cache.get(profile.ref, clock.now())).toBeUndefined();
  expect(PROBE_CACHE_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
});
