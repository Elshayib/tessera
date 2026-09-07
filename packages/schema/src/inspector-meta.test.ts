import { expect, test } from "vitest";
import { z } from "zod";
import { inspectorGaps, missingInspectorMeta } from "./inspector-meta.js";

const meta = { label: "N", widget: "number" } as const;

test("INV-DOC-09 every field has inspector metadata", () => {
  expect(missingInspectorMeta()).toEqual([]);
});

test("inspectorGaps reports object fields without meta", () => {
  const schema = z.object({
    n: z.number().optional(),
  });
  expect(inspectorGaps(schema, "x")).toEqual(["x.n"]);
});

test("inspectorGaps accepts meta on optional, default, and nullable wrappers", () => {
  const schema = z.object({
    optional: z.string().optional().meta({ label: "Optional", widget: "text" }),
    fallback: z.string().default("x").meta({ label: "Default", widget: "text" }),
    nullable: z.string().nullable().meta({ label: "Nullable", widget: "text" }),
  });
  expect(inspectorGaps(schema, "x")).toEqual([]);
});

test("inspectorGaps walks array object elements and shared nested objects", () => {
  const nested = z.object({ n: z.number().meta(meta) }).meta({ label: "Nested", widget: "json" });
  const schema = z.object({
    a: nested,
    b: nested,
    items: z.array(z.object({ n: z.number().meta(meta) })).meta({ label: "Items", widget: "json" }),
  });
  expect(inspectorGaps(schema, "x")).toEqual([]);
});

test("inspectorGaps treats non-object roots without meta as missing", () => {
  expect(inspectorGaps(z.string(), "bare")).toEqual(["bare"]);
});

test("inspectorGaps skips lazy schemas", () => {
  const schema = z.lazy(() => z.object({ n: z.number() }));
  expect(inspectorGaps(schema, "lazy")).toEqual(["lazy"]);
});

test("inspectorGaps walks array union elements", () => {
  const schema = z.object({
    items: z
      .array(
        z.union([
          z.object({
            kind: z.literal("a").meta({ label: "Kind", widget: "select" }),
            n: z.number().meta(meta),
          }),
          z.object({
            kind: z.literal("b").meta({ label: "Kind", widget: "select" }),
            n: z.number().meta(meta),
          }),
        ]),
      )
      .meta({ label: "Items", widget: "json" }),
  });
  expect(inspectorGaps(schema, "x")).toEqual([]);
});

test("inspectorGaps ignores invalid meta payloads", () => {
  const schema = z.object({
    empty: z.number().meta({ label: "", widget: "number" }),
    widget: z.number().meta({ label: "W", widget: "not-a-widget" }),
    nowidget: z.number().meta({ label: "N" }),
  });
  expect(inspectorGaps(schema, "x")).toEqual(["x.empty", "x.widget", "x.nowidget"]);
});
