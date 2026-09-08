import type { BlobRef, License, Provenance } from "@tessera/schema";
import type { Clock, Result, TesseraError } from "@tessera/std";
import { abortError, err, ok, tesseraError } from "@tessera/std";
import type { BlobStore } from "@tessera/storage";

const API_ROOT = "https://api.polyhaven.com";
const LICENSE: License = "CC0-1.0";
const SOURCE_ID = "polyhaven";
const DOCS_URL = "https://polyhaven.com/";
const DESCRIPTION_MAX = 500;
const KIND_QUERY = {
  hdri: "hdris",
  texture: "textures",
  model: "models",
} as const;

/**
 * Kinds Poly Haven can supply (`08` §6).
 *
 * @public
 */
export type AssetSourceKind = "model" | "texture" | "hdri";

/**
 * One search hit (`08` §6).
 *
 * @public
 */
export interface SearchItem {
  readonly id: string;
  readonly name: string;
  readonly kind: AssetSourceKind;
  readonly thumbnailUrl: string;
  readonly tags: readonly string[];
  readonly license: License;
  readonly author?: string;
  readonly sizeHint?: { readonly meters?: number; readonly triangles?: number };
  readonly untrustedDescription?: string;
}

/**
 * A page of {@link SearchItem}.
 *
 * @public
 */
export interface SearchPage {
  readonly items: readonly SearchItem[];
  readonly total?: number;
  readonly nextPage?: number;
}

/**
 * Bytes written by {@link AssetSource.fetch}.
 *
 * @public
 */
export interface FetchedAsset {
  readonly blobs: readonly BlobRef[];
  readonly license: License;
  readonly provenance: Provenance;
  readonly attribution?: string;
}

/**
 * Built-in or plugin asset library (`08` §6).
 *
 * @public
 */
export interface AssetSource {
  readonly descriptor: {
    readonly id: string;
    readonly displayName: string;
    readonly kinds: readonly AssetSourceKind[];
    readonly defaultLicense: License;
    readonly requiresKey: boolean;
    readonly attributionRequired: boolean;
    readonly docsUrl: string;
  };
  search(
    query: {
      readonly text: string;
      readonly kind: AssetSourceKind;
      readonly tags?: readonly string[];
      readonly page?: number;
      readonly pageSize?: number;
    },
    signal: AbortSignal,
  ): Promise<Result<SearchPage, TesseraError>>;
  fetch(
    item: SearchItem,
    options: { readonly resolution?: "1k" | "2k" | "4k"; readonly format?: string },
    blobs: BlobStore,
    signal: AbortSignal,
  ): Promise<Result<FetchedAsset, TesseraError>>;
}

/**
 * Injected HTTP for Poly Haven. Tests replay fixtures; production uses {@link createFetchTransport}.
 *
 * @public
 */
export interface PolyHavenTransport {
  getJson(url: string, signal: AbortSignal): Promise<Result<unknown, TesseraError>>;
  getBytes(url: string, signal: AbortSignal): Promise<Result<Uint8Array, TesseraError>>;
}

/**
 * Wraps third-party text for the agent (`06` §12, SEC-05).
 *
 * @example
 * ```ts
 * wrapUntrusted("polyhaven:search", "hi").includes("<untrusted");
 * ```
 *
 * @public
 */
export function wrapUntrusted(source: string, text: string): string {
  const clipped = text.length <= DESCRIPTION_MAX ? text : text.slice(0, DESCRIPTION_MAX);
  const escaped = clipped.replaceAll("<", "‹");
  return `<untrusted source="${source}">${escaped}</untrusted>`;
}

/**
 * Browser `fetch` transport. Unused in unit tests.
 *
 * @public
 */
export function createFetchTransport(): PolyHavenTransport {
  return {
    async getJson(url, signal) {
      const cancelled = abortIf(signal);
      if (cancelled !== undefined) {
        return cancelled;
      }
      try {
        const response = await fetch(url, { signal });
        if (!response.ok) {
          return err(
            tesseraError("PROVIDER_ERROR", "polyhaven json request failed", {
              status: response.status,
            }),
          );
        }
        return ok(await response.json());
      } catch (caught) {
        return transportError(caught, signal);
      }
    },
    async getBytes(url, signal) {
      const cancelled = abortIf(signal);
      if (cancelled !== undefined) {
        return cancelled;
      }
      try {
        const response = await fetch(url, { signal });
        if (!response.ok) {
          return err(
            tesseraError("PROVIDER_ERROR", "polyhaven bytes request failed", {
              status: response.status,
            }),
          );
        }
        return ok(new Uint8Array(await response.arrayBuffer()));
      } catch (caught) {
        return transportError(caught, signal);
      }
    },
  };
}

/**
 * Options for {@link createPolyHavenSource}.
 *
 * @public
 */
export interface CreatePolyHavenSourceOptions {
  readonly transport: PolyHavenTransport;
  readonly clock: Clock;
}

/**
 * Poly Haven `AssetSource` id `polyhaven` (`08` §6).
 *
 * @example
 * ```ts
 * const source = createPolyHavenSource({ transport, clock });
 * ```
 *
 * @public
 */
export function createPolyHavenSource(options: CreatePolyHavenSourceOptions): AssetSource {
  const { transport, clock } = options;
  const descriptor = {
    id: SOURCE_ID,
    displayName: "Poly Haven",
    kinds: ["model", "texture", "hdri"] as const,
    defaultLicense: LICENSE,
    requiresKey: false,
    attributionRequired: false,
    docsUrl: DOCS_URL,
  };
  return {
    descriptor,
    async search(query, signal) {
      const cancelled = abortIf(signal);
      if (cancelled !== undefined) {
        return cancelled;
      }
      const type = KIND_QUERY[query.kind];
      const listed = await transport.getJson(`${API_ROOT}/assets?t=${type}`, signal);
      if (!listed.ok) {
        return listed;
      }
      if (!isRecord(listed.value)) {
        return err(tesseraError("PROVIDER_ERROR", "polyhaven assets payload is not an object"));
      }
      const filtered = filterEntries(listed.value, query);
      const pageSize = query.pageSize ?? 20;
      const page = query.page ?? 1;
      const start = (page - 1) * pageSize;
      const slice = filtered.slice(start, start + pageSize);
      const items = slice.map((entry) => toSearchItem(entry, query.kind));
      const nextStart = start + pageSize;
      return ok({
        items,
        total: filtered.length,
        ...(nextStart < filtered.length ? { nextPage: page + 1 } : {}),
      });
    },
    async fetch(item, fetchOptions, blobs, signal) {
      const cancelled = abortIf(signal);
      if (cancelled !== undefined) {
        return cancelled;
      }
      const files = await transport.getJson(`${API_ROOT}/files/${item.id}`, signal);
      if (!files.ok) {
        return files;
      }
      const picked = pickDownload(files.value, item.kind, fetchOptions.resolution ?? "1k");
      if (!picked.ok) {
        return picked;
      }
      const bytes = await transport.getBytes(picked.value.url, signal);
      if (!bytes.ok) {
        return bytes;
      }
      const written = await blobs.write(
        bytes.value,
        picked.value.mime,
        picked.value.fileName,
        signal,
      );
      if (!written.ok) {
        return written;
      }
      const importedAt = clock.nowIso();
      const provenance: Provenance = {
        source: SOURCE_ID,
        sourceId: item.id,
        sourceUrl: `${DOCS_URL}a/${item.id}`,
        importedAt,
        ...(item.author === undefined ? {} : { author: item.author }),
      };
      const attribution = `${item.author ?? "Poly Haven"} — ${LICENSE}`;
      return ok({
        blobs: [written.value],
        license: LICENSE,
        provenance,
        attribution,
      });
    },
  };
}

function abortIf(signal: AbortSignal): Result<never, TesseraError> | undefined {
  if (signal.aborted) {
    return err(abortError());
  }
  return undefined;
}

function transportError(caught: unknown, signal: AbortSignal): Result<never, TesseraError> {
  if (signal.aborted) {
    return err(abortError());
  }
  const message = caught instanceof Error ? caught.message : "polyhaven request failed";
  return err(tesseraError("PROVIDER_ERROR", message));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function filterEntries(
  payload: Record<string, unknown>,
  query: {
    readonly text: string;
    readonly tags?: readonly string[];
  },
): { readonly id: string; readonly value: Record<string, unknown> }[] {
  const needle = query.text.trim().toLowerCase();
  const wantedTags = query.tags ?? [];
  const rows: { readonly id: string; readonly value: Record<string, unknown> }[] = [];
  for (const id of Object.keys(payload).sort()) {
    const value = payload[id];
    if (!isRecord(value)) {
      continue;
    }
    const name = readString(field(value, "name")) ?? id;
    const tags = readStringArray(field(value, "tags"));
    const haystack = `${id} ${name} ${tags.join(" ")}`.toLowerCase();
    if (needle.length > 0 && !haystack.includes(needle)) {
      continue;
    }
    if (wantedTags.some((tag) => !tags.includes(tag))) {
      continue;
    }
    rows.push({ id, value });
  }
  return rows;
}

function toSearchItem(
  entry: { readonly id: string; readonly value: Record<string, unknown> },
  kind: AssetSourceKind,
): SearchItem {
  const name = readString(field(entry.value, "name")) ?? entry.id;
  const tags = readStringArray(field(entry.value, "tags"));
  const author = firstAuthor(field(entry.value, "authors"));
  const raw = readString(field(entry.value, "description")) ?? name;
  return {
    id: entry.id,
    name,
    kind,
    thumbnailUrl: `https://cdn.polyhaven.com/asset_img/thumbs/${entry.id}.png`,
    tags,
    license: LICENSE,
    ...(author === undefined ? {} : { author }),
    untrustedDescription: wrapUntrusted("polyhaven:search", raw),
  };
}

function firstAuthor(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const keys = Object.keys(value);
  return keys[0];
}

function field(record: Record<string, unknown>, key: string): unknown {
  return record[key];
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const tags: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      tags.push(entry);
    }
  }
  return tags;
}

function pickDownload(
  payload: unknown,
  kind: AssetSourceKind,
  resolution: "1k" | "2k" | "4k",
): Result<
  { readonly url: string; readonly mime: string; readonly fileName: string },
  TesseraError
> {
  if (!isRecord(payload)) {
    return err(tesseraError("PROVIDER_ERROR", "polyhaven files payload is not an object"));
  }
  if (kind === "hdri") {
    return pickNested(field(payload, "hdri"), resolution, "hdr", "image/vnd.radiance", ".hdr");
  }
  if (kind === "model") {
    return pickNested(field(payload, "gltf"), resolution, "glb", "model/gltf-binary", ".glb");
  }
  const maps = Object.keys(payload);
  const preferred = maps.includes("Diffuse") ? "Diffuse" : maps[0];
  if (preferred === undefined) {
    return err(tesseraError("NOT_FOUND", "polyhaven texture has no maps"));
  }
  return pickNested(payload[preferred], resolution, "jpg", "image/jpeg", ".jpg");
}

function pickNested(
  node: unknown,
  resolution: string,
  format: string,
  mime: string,
  extension: string,
): Result<
  { readonly url: string; readonly mime: string; readonly fileName: string },
  TesseraError
> {
  if (!isRecord(node)) {
    return err(tesseraError("NOT_FOUND", "polyhaven files missing kind"));
  }
  const res = node[resolution];
  if (!isRecord(res)) {
    return err(tesseraError("NOT_FOUND", "polyhaven files missing resolution"));
  }
  const file = res[format];
  if (!isRecord(file)) {
    return err(tesseraError("NOT_FOUND", "polyhaven files missing format"));
  }
  const url = field(file, "url");
  if (typeof url !== "string" || url.length === 0) {
    return err(tesseraError("NOT_FOUND", "polyhaven files missing url"));
  }
  return ok({ url, mime, fileName: `polyhaven${extension}` });
}
