import type { KeyVault } from "@tessera/llm";
import type { Clock, Logger, Result, TesseraError } from "@tessera/std";
import { err, tesseraError } from "@tessera/std";
import { createMemoryKeyVault } from "@tessera/ui";

/**
 * Inputs for {@link createBrowserKeyVault}.
 *
 * @public
 */
export interface BrowserKeyVaultInput {
  readonly clock: Clock;
  readonly logger: Logger;
  readonly open?: () => Promise<Result<KeyVault, TesseraError>>;
}

async function defaultOpen(input: BrowserKeyVaultInput): Promise<Result<KeyVault, TesseraError>> {
  try {
    const providers = await import("@tessera/providers-llm");
    return await providers.createIndexedDbKeyVault({
      clock: input.clock,
      logger: input.logger,
    });
  } catch {
    return err(tesseraError("IO_ERROR", "indexeddb vault unavailable"));
  }
}

/**
 * Sync {@link KeyVault} that opens IndexedDB `tessera-vault` on first use (`07` §6, Q-0166).
 *
 * @example
 * ```ts
 * const vault = createBrowserKeyVault({ clock, logger });
 * await vault.set("openrouter", secret);
 * ```
 *
 * @public
 */
export function createBrowserKeyVault(input: BrowserKeyVaultInput): KeyVault {
  let inner: KeyVault | undefined;
  let pending: Promise<KeyVault> | undefined;

  const resolve = (): Promise<KeyVault> => {
    if (inner !== undefined) {
      return Promise.resolve(inner);
    }
    if (pending === undefined) {
      pending = (async () => {
        const opener = input.open ?? (() => defaultOpen(input));
        const opened = await opener();
        inner = opened.ok ? opened.value : createMemoryKeyVault();
        return inner;
      })();
    }
    return pending;
  };

  return {
    get locked() {
      return inner === undefined ? false : inner.locked;
    },
    async get(ref) {
      const vault = await resolve();
      return vault.get(ref);
    },
    async set(ref, secret) {
      const vault = await resolve();
      return vault.set(ref, secret);
    },
    async delete(ref) {
      const vault = await resolve();
      return vault.delete(ref);
    },
    async list() {
      const vault = await resolve();
      return vault.list();
    },
    async unlock(passphrase) {
      const vault = await resolve();
      return vault.unlock(passphrase);
    },
  };
}
