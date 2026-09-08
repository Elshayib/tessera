import { expect, test } from "vitest";
import {
  buildAttributionMarkdown,
  licenseIsFlagged,
  licenseRequiresAttribution,
} from "./attribution.js";

const material = {
  createdAt: "2026-01-01T00:00:00.000Z",
  kind: "material" as const,
  model: "pbr" as const,
  baseColor: "#cccccc",
  metallic: 0,
  roughness: 0.6,
  emissive: "#000000",
  emissiveStrength: 1,
  opacity: 1,
  alphaMode: "opaque" as const,
  alphaCutoff: 0.5,
  doubleSided: false,
  normalScale: 1,
  occlusionStrength: 1,
};

test("CC-BY licenses require attribution and unknown is flagged", () => {
  expect(licenseRequiresAttribution("CC-BY-4.0")).toBe(true);
  expect(licenseRequiresAttribution("CC-BY-SA-4.0")).toBe(true);
  expect(licenseRequiresAttribution("CC0-1.0")).toBe(false);
  expect(licenseIsFlagged("unknown")).toBe(true);
  expect(licenseIsFlagged("proprietary")).toBe(true);
  expect(licenseIsFlagged("CC0-1.0")).toBe(false);
});

test("buildAttributionMarkdown groups CC-BY assets and notes generators", () => {
  expect(buildAttributionMarkdown([])).toBeUndefined();
  const markdown = buildAttributionMarkdown([
    {
      ...material,
      id: "a_aaaaaaaaaa",
      name: "oak",
      license: "CC-BY-4.0",
      provenance: {
        source: "polyhaven",
        author: "Ada",
        sourceUrl: "https://example.com/oak",
        importedAt: "2026-01-01T00:00:00.000Z",
      },
    },
    {
      ...material,
      id: "a_aaaaaaaaab",
      name: "gen",
      license: "CC0-1.0",
      provenance: {
        source: "generated",
        importedAt: "2026-01-01T00:00:00.000Z",
        generator: { provider: "meshy", promptHash: "abc", jobId: "j1" },
      },
    },
    {
      ...material,
      id: "a_aaaaaaaaac",
      name: "pine",
      license: "CC-BY-4.0",
      provenance: {
        source: "polyhaven",
        importedAt: "2026-01-01T00:00:00.000Z",
        generator: { provider: "meshy", model: "v1", promptHash: "def", jobId: "j2" },
      },
    },
  ]);
  expect(markdown?.includes("## CC-BY-4.0")).toBe(true);
  expect(markdown?.includes("oak")).toBe(true);
  expect(markdown?.includes("Provider terms")).toBe(true);
  expect(markdown?.includes("meshy (v1)")).toBe(true);
});
