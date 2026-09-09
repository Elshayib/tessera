import type { QueryRegistry } from "@tessera/core";
import { expect, test } from "vitest";
import { captureVerificationScreenshots } from "./screenshots.js";

test("screenshots viewport iso and top when >5 entities", () => {
  const captured: { name: string; input: Record<string, unknown> }[] = [];
  const queries = {
    query(name: string, input: unknown) {
      captured.push({ name, input: input as Record<string, unknown> });
      return {
        ok: true as const,
        value: {
          imageRef: {
            hash: "sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            size: 12,
            mime: "image/jpeg",
          },
          camera: { position: [0, 0, 0], target: [0, 0, 0] },
        },
      };
    },
  };
  const ids = [
    "e_0000000000",
    "e_0000000001",
    "e_0000000002",
    "e_0000000003",
    "e_0000000004",
    "e_0000000005",
  ];
  const shots = captureVerificationScreenshots(queries as unknown as QueryRegistry, ids);
  expect(shots.ok).toBe(true);
  expect(captured.map((item) => item.input["camera"])).toEqual(["viewport", "iso", "top"]);
  for (const item of captured) {
    expect(item.name).toBe("view.screenshot");
    expect(item.input["width"]).toBe(1024);
    expect(item.input["height"]).toBe(576);
    expect(item.input["frame"]).toEqual(ids);
  }
});
