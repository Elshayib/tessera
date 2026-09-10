/**
 * Deterministic `crypto.getRandomValues` so eval `newId` calls replay (Q-0157).
 *
 * @example
 * ```ts
 * const restore = installSeededCrypto(1);
 * restore();
 * ```
 *
 * @public
 */
export function installSeededCrypto(seed: number): () => void {
  const cryptoObj = globalThis.crypto;
  const original = cryptoObj.getRandomValues.bind(cryptoObj);
  let state = seed === 0 ? 1 : seed >>> 0;
  const patched = <T extends ArrayBufferView>(array: T): T => {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    for (let i = 0; i < bytes.length; i += 1) {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      bytes[i] = state >>> 24;
    }
    return array;
  };
  cryptoObj.getRandomValues = patched;
  return () => {
    cryptoObj.getRandomValues = original;
  };
}

/**
 * FNV-1a seed from a stable eval key.
 *
 * @public
 */
export function seedFromKey(key: string): number {
  let hash = 2_166_136_261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}
