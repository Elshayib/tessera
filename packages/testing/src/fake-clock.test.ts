import type { Clock } from "@tessera/std";
import { InvariantError } from "@tessera/std";
import { expect, test } from "vitest";
import { FakeClock } from "./index.js";

test("FakeClock advance", () => {
  const clock = new FakeClock();
  const asClock: Clock = clock;
  expect(asClock.now()).toBe(1_700_000_000_000);
  expect(clock.nowIso()).toBe("2023-11-14T22:13:20.000Z");
  expect(clock.now()).toBe(clock.now());
  clock.advance(1500);
  expect(clock.now()).toBe(1_700_000_001_500);
  const custom = new FakeClock(10);
  expect(custom.now()).toBe(10);
  custom.advance(0);
  expect(custom.now()).toBe(10);
  expect(() => clock.advance(-1)).toThrow(InvariantError);
});
