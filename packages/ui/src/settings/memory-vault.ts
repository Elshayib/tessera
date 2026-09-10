import type { KeyVault } from "@tessera/llm";
import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";

/**
 * In-memory {@link KeyVault} for tests and sync bootstrap (Q-0142 pattern).
 *
 * @example
 * ```ts
 * createMemoryKeyVault().set("openai", "sk-test");
 * ```
 *
 * @public
 */
export function createMemoryKeyVault(options: { readonly locked?: boolean } = {}): KeyVault {
  const secrets = new Map<string, { readonly secret: string; readonly createdAt: string }>();
  let locked = options.locked === true;
  return {
    get locked() {
      return locked;
    },
    async get(ref) {
      if (locked) {
        return err(tesseraError("PERMISSION_DENIED", "vault is locked"));
      }
      const row = secrets.get(ref);
      if (row === undefined) {
        return err(tesseraError("NOT_FOUND", "no secret for ref"));
      }
      return ok(row.secret);
    },
    async set(ref, secret) {
      if (locked) {
        return err(tesseraError("PERMISSION_DENIED", "vault is locked"));
      }
      secrets.set(ref, { secret, createdAt: "2026-01-01T00:00:00.000Z" });
      return ok(undefined);
    },
    async delete(ref) {
      if (locked) {
        return err(tesseraError("PERMISSION_DENIED", "vault is locked"));
      }
      secrets.delete(ref);
      return ok(undefined);
    },
    async list(): Promise<Result<readonly { ref: string; createdAt: string }[], TesseraError>> {
      if (locked) {
        return err(tesseraError("PERMISSION_DENIED", "vault is locked"));
      }
      return ok([...secrets.entries()].map(([ref, row]) => ({ ref, createdAt: row.createdAt })));
    },
    async unlock(passphrase) {
      if (passphrase.length === 0) {
        return err(tesseraError("PERMISSION_DENIED", "passphrase required"));
      }
      locked = false;
      return ok(undefined);
    },
  };
}
