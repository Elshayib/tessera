import type { Asset } from "@tessera/schema";

/**
 * Whether `license` requires attribution (`08` §8, `09` §9).
 *
 * @public
 */
export function licenseRequiresAttribution(license: string): boolean {
  return license.toUpperCase().startsWith("CC-BY");
}

/**
 * Whether `license` should be flagged on export without blocking (`08` §8).
 *
 * @public
 */
export function licenseIsFlagged(license: string): boolean {
  return license === "unknown" || license === "proprietary";
}

function assetNeedsAttribution(asset: Asset): boolean {
  return licenseRequiresAttribution(asset.license) || asset.provenance.generator !== undefined;
}

/**
 * Builds `ATTRIBUTIONS.md` when any exported asset requires it (`09` §9, INV-AST-03).
 *
 * @example
 * ```ts
 * buildAttributionMarkdown(assets);
 * ```
 *
 * @public
 */
export function buildAttributionMarkdown(assets: readonly Asset[]): string | undefined {
  const listed = [...assets].filter(assetNeedsAttribution);
  if (listed.length === 0) {
    return undefined;
  }
  listed.sort((left, right) => {
    if (left.license < right.license) {
      return -1;
    }
    if (left.license > right.license) {
      return 1;
    }
    return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
  });
  const lines: string[] = ["# Attributions", ""];
  let currentLicense: string | undefined;
  for (const asset of listed) {
    if (asset.license !== currentLicense) {
      currentLicense = asset.license;
      lines.push(`## ${currentLicense}`, "");
    }
    const author = asset.provenance.author ?? "unknown author";
    const url = asset.provenance.sourceUrl ?? asset.provenance.source;
    lines.push(`- **${asset.name}** — ${author} — ${url} — ${asset.license}`);
    const generator = asset.provenance.generator;
    if (generator !== undefined) {
      const model =
        generator.model === undefined
          ? generator.provider
          : `${generator.provider} (${generator.model})`;
      lines.push(`  - Provider terms: generated via ${model}.`);
    }
  }
  lines.push("");
  return lines.join("\n");
}
