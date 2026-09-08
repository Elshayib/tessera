import { expect, test } from "vitest";
import { systemClock } from "./clock.js";

test("systemClock exposes epoch millis and an ISO timestamp", () => {
  const now = systemClock.now();
  const iso = systemClock.nowIso();
  expect(Number.isFinite(now)).toBe(true);
  expect(Number.isNaN(Date.parse(iso))).toBe(false);
});
