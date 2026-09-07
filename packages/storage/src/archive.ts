import type { BlobRef, Document } from "@tessera/schema";
import { canonicalize, DocumentSchema } from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { blobHash, cancelledResult, copyToArrayBuffer, sha256Hex } from "./internal.js";
import type { ArchiveLimits, BlobStore } from "./types.js";
import { DEFAULT_ARCHIVE_LIMITS } from "./types.js";

const PROJECT_JSON = "project.tessera.json";
const MANIFEST_JSON = "manifest.json";
const BLOBS_INDEX = "blobs/index.json";
const BLOB_PATH = /^blobs\/(sha256-[0-9a-f]{64})$/;
const ALLOWED_PATH =
  /^(project\.tessera\.json|manifest\.json|blobs\/index\.json|blobs\/sha256-[0-9a-f]{64})$/;

interface ArchiveManifest {
  readonly format: "tessera-archive";
  readonly version: 1;
  readonly documentVersion: string;
  readonly createdAt: string;
  readonly generator: string;
}

interface BlobIndexEntry {
  readonly mime: string;
  readonly size: number;
  readonly fileName?: string;
}

/**
 * Packs a canonical snapshot and blobs into a `.tessera` ZIP (`03` §10).
 *
 * @public
 */
export async function encodeTesseraArchive(
  snapshot: Document,
  blobs: BlobStore,
  createdAt: string,
  signal?: AbortSignal,
): Promise<Result<Blob, TesseraError>> {
  const cancelled = cancelledResult(signal);
  if (cancelled !== undefined) {
    return cancelled;
  }
  const listed = await blobs.list();
  if (!listed.ok) {
    return listed;
  }
  const files: Record<string, Uint8Array> = {};
  const index: Record<string, BlobIndexEntry> = {};
  for (const ref of listed.value) {
    const body = await blobs.read(ref.hash, signal);
    if (!body.ok) {
      return body;
    }
    const bytes = new Uint8Array(await body.value.arrayBuffer());
    files[`blobs/${ref.hash}`] = bytes;
    index[ref.hash] =
      ref.fileName === undefined
        ? { mime: ref.mime, size: ref.size }
        : { mime: ref.mime, size: ref.size, fileName: ref.fileName };
  }
  const manifest: ArchiveManifest = {
    format: "tessera-archive",
    version: 1,
    documentVersion: snapshot.version,
    createdAt,
    generator: snapshot.meta.generator,
  };
  files[PROJECT_JSON] = strToU8(canonicalize(snapshot));
  files[MANIFEST_JSON] = strToU8(canonicalize(manifest));
  files[BLOBS_INDEX] = strToU8(canonicalize(index));
  const zipped = zipSync(files);
  const copy = new Uint8Array(zipped.byteLength);
  copy.set(zipped);
  return ok(new Blob([copy], { type: "application/zip" }));
}

export interface DecodedArchive {
  readonly snapshot: Document;
  readonly blobs: readonly { readonly ref: BlobRef; readonly bytes: Uint8Array }[];
}

/**
 * Unzips a `.tessera` archive with SEC-08 path and size checks (`03` §10, Q-0032).
 *
 * @public
 */
export async function decodeTesseraArchive(
  archive: Blob,
  limits: ArchiveLimits = DEFAULT_ARCHIVE_LIMITS,
  signal?: AbortSignal,
): Promise<Result<DecodedArchive, TesseraError>> {
  const cancelled = cancelledResult(signal);
  if (cancelled !== undefined) {
    return cancelled;
  }
  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(new Uint8Array(await archive.arrayBuffer()));
  } catch {
    return err(tesseraError("IO_ERROR", "archive is not a zip"));
  }
  let total = 0;
  for (const [name, bytes] of Object.entries(unzipped)) {
    if (!ALLOWED_PATH.test(name)) {
      return err(tesseraError("INVALID_INPUT", "archive entry name is not allowed", { name }));
    }
    if (bytes.byteLength > limits.maxEntryBytes) {
      return err(tesseraError("INVALID_INPUT", "archive entry exceeds size limit", { name }));
    }
    total += bytes.byteLength;
    if (total > limits.maxTotalBytes) {
      return err(tesseraError("INVALID_INPUT", "archive exceeds total size limit"));
    }
  }
  const projectBytes = unzipped[PROJECT_JSON];
  const manifestBytes = unzipped[MANIFEST_JSON];
  if (projectBytes === undefined || manifestBytes === undefined) {
    return err(tesseraError("INVALID_INPUT", "archive is missing project or manifest"));
  }
  const manifestParsed = parseManifest(strFromU8(manifestBytes));
  if (!manifestParsed.ok) {
    return manifestParsed;
  }
  let snapshotJson: unknown;
  try {
    snapshotJson = JSON.parse(strFromU8(projectBytes));
  } catch {
    return err(tesseraError("INVALID_INPUT", "project.tessera.json is not JSON"));
  }
  const parsed = DocumentSchema.safeParse(snapshotJson);
  if (!parsed.success) {
    return err(tesseraError("INVALID_INPUT", "project snapshot failed schema"));
  }
  const indexBytes = unzipped[BLOBS_INDEX];
  const index = parseBlobIndex(indexBytes === undefined ? undefined : strFromU8(indexBytes));
  if (!index.ok) {
    return index;
  }
  const blobs: { readonly ref: BlobRef; readonly bytes: Uint8Array }[] = [];
  for (const [name, bytes] of Object.entries(unzipped)) {
    const match = BLOB_PATH.exec(name);
    if (match === null) {
      continue;
    }
    const expectedHash = match[1];
    if (expectedHash === undefined) {
      return err(tesseraError("INVALID_INPUT", "blob path missing hash", { name }));
    }
    const hex = await sha256Hex(copyToArrayBuffer(bytes));
    const actualHash = blobHash(hex);
    if (actualHash !== expectedHash) {
      return err(tesseraError("INVALID_INPUT", "blob hash mismatch", { name }));
    }
    const meta = index.value[expectedHash];
    const mime = meta?.mime ?? "application/octet-stream";
    const fileName = meta?.fileName;
    const ref: BlobRef =
      fileName === undefined
        ? { hash: actualHash, size: bytes.byteLength, mime }
        : { hash: actualHash, size: bytes.byteLength, mime, fileName };
    blobs.push({ ref, bytes });
  }
  return ok({ snapshot: parsed.data, blobs });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseManifest(text: string): Result<ArchiveManifest, TesseraError> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return err(tesseraError("INVALID_INPUT", "manifest.json is not JSON"));
  }
  if (!isRecord(raw)) {
    return err(tesseraError("INVALID_INPUT", "manifest.json is not an object"));
  }
  if (
    raw["format"] !== "tessera-archive" ||
    raw["version"] !== 1 ||
    typeof raw["documentVersion"] !== "string" ||
    typeof raw["createdAt"] !== "string" ||
    typeof raw["generator"] !== "string"
  ) {
    return err(tesseraError("INVALID_INPUT", "manifest.json is not a tessera archive"));
  }
  return ok({
    format: "tessera-archive",
    version: 1,
    documentVersion: raw["documentVersion"],
    createdAt: raw["createdAt"],
    generator: raw["generator"],
  });
}

function parseBlobIndex(
  text: string | undefined,
): Result<Record<string, BlobIndexEntry>, TesseraError> {
  if (text === undefined) {
    return ok({});
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return err(tesseraError("INVALID_INPUT", "blobs/index.json is not JSON"));
  }
  if (!isRecord(raw)) {
    return err(tesseraError("INVALID_INPUT", "blobs/index.json is not an object"));
  }
  const out: Record<string, BlobIndexEntry> = {};
  for (const [hash, value] of Object.entries(raw)) {
    if (!isRecord(value)) {
      return err(tesseraError("INVALID_INPUT", "blobs/index.json entry is invalid", { hash }));
    }
    const mime = value["mime"];
    const size = value["size"];
    if (typeof mime !== "string" || typeof size !== "number") {
      return err(tesseraError("INVALID_INPUT", "blobs/index.json entry is invalid", { hash }));
    }
    const fileName = value["fileName"];
    out[hash] = typeof fileName === "string" ? { mime, size, fileName } : { mime, size };
  }
  return ok(out);
}
