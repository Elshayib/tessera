import type { BlobRef, License, Provenance } from "@tessera/schema";
import type { Clock, Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import type { BlobStore } from "@tessera/storage";

/**
 * Kinds from `08` §6.
 *
 * @public
 */
export type FakeAssetSourceKind = "model" | "texture" | "hdri";

/**
 * One search hit (`08` §6 / `13` §3).
 *
 * @public
 */
export interface FakeSearchItem {
  readonly id: string;
  readonly name: string;
  readonly kind: FakeAssetSourceKind;
  readonly thumbnailUrl: string;
  readonly tags: readonly string[];
  readonly license: License;
  readonly author?: string;
  readonly sizeHint?: { readonly meters?: number; readonly triangles?: number };
  readonly untrustedDescription?: string;
}

/**
 * A page of {@link FakeSearchItem}.
 *
 * @public
 */
export interface FakeSearchPage {
  readonly items: readonly FakeSearchItem[];
  readonly total?: number;
  readonly nextPage?: number;
}

/**
 * Bytes written by {@link FakeAssetSource.fetch}.
 *
 * @public
 */
export interface FakeFetchedAsset {
  readonly blobs: readonly BlobRef[];
  readonly license: License;
  readonly provenance: Provenance;
  readonly attribution?: string;
}

/**
 * Options for {@link FakeAssetSource}.
 *
 * @public
 */
export interface FakeAssetSourceOptions {
  readonly items?: readonly FakeSearchItem[];
  readonly latencyMs?: number;
  readonly failSearch?: TesseraError;
  readonly failFetch?: TesseraError;
  readonly clock?: Clock;
  readonly license?: License;
}

/**
 * Deterministic `AssetSource` (`13` §3). Structural match for `08` §6.
 *
 * @example
 * ```ts
 * const source = new FakeAssetSource({ items: [{ id: "barrel", name: "Barrel", kind: "model", thumbnailUrl: "https://example.invalid/b.png", tags: [], license: "CC0-1.0" }] });
 * ```
 *
 * @public
 */
export class FakeAssetSource {
  readonly descriptor: {
    readonly id: string;
    readonly displayName: string;
    readonly kinds: readonly FakeAssetSourceKind[];
    readonly defaultLicense: License;
    readonly requiresKey: boolean;
    readonly attributionRequired: boolean;
    readonly docsUrl: string;
  };
  private readonly items: readonly FakeSearchItem[];
  private readonly latencyMs: number;
  private readonly failSearch: TesseraError | undefined;
  private readonly failFetch: TesseraError | undefined;
  private readonly clock: Clock | undefined;
  private readonly license: License;

  constructor(options: FakeAssetSourceOptions = {}) {
    this.items = options.items ?? [];
    this.latencyMs = options.latencyMs ?? 0;
    this.failSearch = options.failSearch;
    this.failFetch = options.failFetch;
    this.clock = options.clock;
    this.license = options.license ?? "CC0-1.0";
    this.descriptor = {
      id: "fake-source",
      displayName: "Fake source",
      kinds: ["model", "texture", "hdri"],
      defaultLicense: this.license,
      requiresKey: false,
      attributionRequired: false,
      docsUrl: "https://example.invalid/assets",
    };
  }

  async search(
    query: {
      readonly text: string;
      readonly kind: FakeAssetSourceKind;
      readonly tags?: readonly string[];
      readonly page?: number;
      readonly pageSize?: number;
    },
    signal: AbortSignal,
  ): Promise<Result<FakeSearchPage, TesseraError>> {
    if (signal.aborted) {
      return err(tesseraError("CANCELLED", "search cancelled"));
    }
    if (this.failSearch !== undefined) {
      return err(this.failSearch);
    }
    await delay(this.latencyMs);
    const needle = query.text.trim().toLowerCase();
    const filtered = this.items.filter((item) => {
      if (item.kind !== query.kind) {
        return false;
      }
      if (
        needle.length > 0 &&
        !item.name.toLowerCase().includes(needle) &&
        !item.id.includes(needle)
      ) {
        return false;
      }
      return true;
    });
    const pageSize = query.pageSize ?? 20;
    const page = query.page ?? 1;
    const start = (page - 1) * pageSize;
    const slice = filtered.slice(start, start + pageSize);
    const nextStart = start + pageSize;
    return ok({
      items: slice,
      total: filtered.length,
      ...(nextStart < filtered.length ? { nextPage: page + 1 } : {}),
    });
  }

  async fetch(
    item: FakeSearchItem,
    _options: { readonly resolution?: "1k" | "2k" | "4k"; readonly format?: string },
    blobs: BlobStore,
    signal: AbortSignal,
  ): Promise<Result<FakeFetchedAsset, TesseraError>> {
    if (signal.aborted) {
      return err(tesseraError("CANCELLED", "fetch cancelled"));
    }
    if (this.failFetch !== undefined) {
      return err(this.failFetch);
    }
    await delay(this.latencyMs);
    const written = await blobs.write(
      new Uint8Array([1, 2, 3, 4]),
      mimeFor(item.kind),
      `${item.id}.bin`,
      signal,
    );
    if (!written.ok) {
      return written;
    }
    const importedAt = this.clock?.nowIso() ?? "2026-01-01T00:00:00.000Z";
    return ok({
      blobs: [written.value],
      license: item.license,
      provenance: {
        source: this.descriptor.id,
        sourceId: item.id,
        importedAt,
        ...(item.author === undefined ? {} : { author: item.author }),
      },
      attribution: `${item.author ?? this.descriptor.displayName} — ${item.license}`,
    });
  }
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function mimeFor(kind: FakeAssetSourceKind): string {
  if (kind === "model") {
    return "model/gltf-binary";
  }
  if (kind === "hdri") {
    return "image/vnd.radiance";
  }
  return "image/jpeg";
}
