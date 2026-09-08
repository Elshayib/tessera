import type { Result, TesseraError } from "@tessera/std";
import { abortError, err } from "@tessera/std";

export function cancelledResult(
  signal: AbortSignal | undefined,
): Result<never, TesseraError> | undefined {
  if (signal?.aborted === true) {
    return err(abortError());
  }
  return undefined;
}

export async function toBytes(data: Blob | Uint8Array): Promise<Uint8Array> {
  if (data instanceof Uint8Array) {
    return data;
  }
  return new Uint8Array(await data.arrayBuffer());
}

export function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

/**
 * SHA-256 hex digest via WebCrypto (`08` §3).
 */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const view = new Uint8Array(digest);
  let hex = "";
  for (const byte of view) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

export function blobHash(hex: string): string {
  return `sha256-${hex}`;
}
