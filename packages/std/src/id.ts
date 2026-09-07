import { invariant } from "./invariant.js";

const ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const ID_BODY_LENGTH = 10;
const ID_MAX_RANDOM = 252;

/**
 * Id prefixes used across Tessera documents and runs.
 *
 * @public
 */
export type IdPrefix = "e" | "a" | "b" | "t" | "r" | "j" | "p";

const ID_PATTERN = new RegExp(`^([eabtrjp])_([${ID_ALPHABET}]{${String(ID_BODY_LENGTH)}})$`);

function randomBody(): string {
  invariant(globalThis.crypto !== undefined, "globalThis.crypto is required for newId");
  let body = "";
  while (body.length < ID_BODY_LENGTH) {
    const bytes = new Uint8Array(ID_BODY_LENGTH);
    globalThis.crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte < ID_MAX_RANDOM) {
        const index = byte % ID_ALPHABET.length;
        const char = ID_ALPHABET[index];
        invariant(char !== undefined, "id alphabet index in range");
        body += char;
        if (body.length === ID_BODY_LENGTH) {
          break;
        }
      }
    }
  }
  return body;
}

/**
 * Allocates an opaque id: `prefix` + `_` + 10 characters from `[0-9a-z]`.
 *
 * @example
 * ```ts
 * const entityId = newId("e");
 * ```
 *
 * @public
 */
export function newId(prefix: IdPrefix): string {
  return `${prefix}_${randomBody()}`;
}

/**
 * Returns whether `value` is an id with `prefix` and a 10-character body.
 *
 * @example
 * ```ts
 * isId("e", "e_abcdefghij");
 * ```
 *
 * @public
 */
export function isId(prefix: IdPrefix, value: string): boolean {
  const match = ID_PATTERN.exec(value);
  return match !== null && match[1] === prefix;
}
