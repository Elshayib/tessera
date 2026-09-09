import type { ModelRef } from "@tessera/llm";
import type { CapabilityProfile } from "./types.js";

/**
 * Probe cache lifetime (`07` §3).
 *
 * @public
 */
export const PROBE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface Entry {
  readonly profile: CapabilityProfile;
  readonly storedAtMs: number;
}

function keyOf(ref: ModelRef): string {
  return `${ref.providerId}:${ref.modelId}`;
}

/**
 * In-memory probe cache keyed by {@link ModelRef}.
 *
 * @public
 */
export interface ProbeCache {
  get(ref: ModelRef, nowMs: number): CapabilityProfile | undefined;
  set(ref: ModelRef, profile: CapabilityProfile, nowMs: number): void;
}

/**
 * Creates a 7-day {@link ProbeCache}.
 *
 * @example
 * ```ts
 * const cache = createProbeCache();
 * cache.set(ref, profile, clock.now());
 * ```
 *
 * @public
 */
export function createProbeCache(): ProbeCache {
  const entries = new Map<string, Entry>();
  return {
    get(ref, nowMs) {
      const entry = entries.get(keyOf(ref));
      if (entry === undefined) {
        return undefined;
      }
      if (nowMs - entry.storedAtMs >= PROBE_CACHE_TTL_MS) {
        entries.delete(keyOf(ref));
        return undefined;
      }
      return entry.profile;
    },
    set(ref, profile, nowMs) {
      entries.set(keyOf(ref), { profile, storedAtMs: nowMs });
    },
  };
}
