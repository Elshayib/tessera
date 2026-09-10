import type { KeyVault } from "@tessera/llm";
import type { Clock, Logger, Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";

/**
 * IndexedDB database name (`07` §6).
 *
 * @public
 */
export const VAULT_DB_NAME = "tessera-vault" as const;

/**
 * PBKDF2 iteration count (`07` §6).
 *
 * @public
 */
export const VAULT_PBKDF2_ITERATIONS = 600_000;

/**
 * Per-vault salt length in bytes (Q-0119).
 *
 * @public
 */
export const VAULT_SALT_BYTES = 16;

/**
 * AES-GCM IV length in bytes (Q-0119).
 *
 * @public
 */
export const VAULT_IV_BYTES = 12;

const DB_VERSION = 1;
const META_STORE = "meta";
const SECRET_STORE = "secrets";
const META_KEY = "config";
const VERIFIER = "tessera-vault";
const AES_LENGTH = 256;

/**
 * Clock and logger for {@link createIndexedDbKeyVault}. Passphrase is optional (`07` §6).
 *
 * @public
 */
export interface IndexedDbKeyVaultDeps {
  readonly clock: Clock;
  readonly logger: Logger;
  readonly passphrase?: string;
}

interface MetaRecord {
  readonly encrypted: boolean;
  readonly salt?: readonly number[];
  readonly checkIv?: readonly number[];
  readonly checkCipher?: readonly number[];
}

interface SecretRecord {
  readonly createdAt: string;
  readonly plaintext?: string;
  readonly iv?: readonly number[];
  readonly ciphertext?: readonly number[];
}

function ioError(message: string): TesseraError {
  return tesseraError("IO_ERROR", message);
}

function denied(message: string): TesseraError {
  return tesseraError("PERMISSION_DENIED", message);
}

function bytesToList(bytes: Uint8Array): number[] {
  return [...bytes];
}

function listToBytes(list: readonly number[]): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(list.length));
  for (let index = 0; index < list.length; index++) {
    const value = list[index];
    if (value === undefined) {
      continue;
    }
    bytes[index] = value;
  }
  return bytes;
}

function copyBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copy.set(bytes);
  return copy;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return copyBytes(bytes).buffer;
}

function isNumberList(value: unknown): value is readonly number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}

function parseMeta(value: unknown): Result<MetaRecord | undefined, TesseraError> {
  if (value === undefined) {
    return ok(undefined);
  }
  if (typeof value !== "object" || value === null || !("encrypted" in value)) {
    return err(ioError("vault meta is invalid"));
  }
  const encrypted = value.encrypted;
  if (typeof encrypted !== "boolean") {
    return err(ioError("vault meta is invalid"));
  }
  if (!encrypted) {
    return ok({ encrypted: false });
  }
  if (!("salt" in value) || !("checkIv" in value) || !("checkCipher" in value)) {
    return err(ioError("vault meta is invalid"));
  }
  if (
    !isNumberList(value.salt) ||
    !isNumberList(value.checkIv) ||
    !isNumberList(value.checkCipher)
  ) {
    return err(ioError("vault meta is invalid"));
  }
  return ok({
    encrypted: true,
    salt: value.salt,
    checkIv: value.checkIv,
    checkCipher: value.checkCipher,
  });
}

function parseSecret(value: unknown): Result<SecretRecord, TesseraError> {
  if (typeof value !== "object" || value === null || !("createdAt" in value)) {
    return err(ioError("vault secret record is invalid"));
  }
  const createdAt = value.createdAt;
  if (typeof createdAt !== "string") {
    return err(ioError("vault secret record is invalid"));
  }
  if ("plaintext" in value && typeof value.plaintext === "string") {
    return ok({ createdAt, plaintext: value.plaintext });
  }
  if (
    "iv" in value &&
    "ciphertext" in value &&
    isNumberList(value.iv) &&
    isNumberList(value.ciphertext)
  ) {
    return ok({ createdAt, iv: value.iv, ciphertext: value.ciphertext });
  }
  return err(ioError("vault secret record is invalid"));
}

function idbRequest<T>(request: IDBRequest<T>): Promise<Result<T, TesseraError>> {
  return new Promise((resolve) => {
    request.onsuccess = () => {
      resolve(ok(request.result));
    };
    request.onerror = () => {
      resolve(err(ioError("indexedDB request failed")));
    };
  });
}

function openDatabase(): Promise<Result<IDBDatabase, TesseraError>> {
  return new Promise((resolve) => {
    const request = indexedDB.open(VAULT_DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
      if (!db.objectStoreNames.contains(SECRET_STORE)) {
        db.createObjectStore(SECRET_STORE);
      }
    };
    request.onsuccess = () => {
      resolve(ok(request.result));
    };
    request.onerror = () => {
      resolve(err(ioError("failed to open tessera-vault")));
    };
  });
}

async function withDb<T>(
  run: (db: IDBDatabase) => Promise<Result<T, TesseraError>>,
): Promise<Result<T, TesseraError>> {
  const opened = await openDatabase();
  if (!opened.ok) {
    return opened;
  }
  try {
    return await run(opened.value);
  } finally {
    opened.value.close();
  }
}

async function readMeta(db: IDBDatabase): Promise<Result<MetaRecord | undefined, TesseraError>> {
  const tx = db.transaction(META_STORE, "readonly");
  const got = await idbRequest(tx.objectStore(META_STORE).get(META_KEY));
  if (!got.ok) {
    return got;
  }
  return parseMeta(got.value);
}

async function writeMeta(db: IDBDatabase, meta: MetaRecord): Promise<Result<void, TesseraError>> {
  const tx = db.transaction(META_STORE, "readwrite");
  const put = await idbRequest(tx.objectStore(META_STORE).put(meta, META_KEY));
  if (!put.ok) {
    return put;
  }
  return ok(undefined);
}

async function deriveAesKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(new TextEncoder().encode(passphrase)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations: VAULT_PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: AES_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encrypt(
  key: CryptoKey,
  plaintext: string,
): Promise<{ iv: Uint8Array<ArrayBuffer>; ciphertext: Uint8Array<ArrayBuffer> }> {
  const iv = copyBytes(crypto.getRandomValues(new Uint8Array(VAULT_IV_BYTES)));
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(new TextEncoder().encode(plaintext)),
  );
  return { iv, ciphertext: copyBytes(new Uint8Array(sealed)) };
}

async function decrypt(
  key: CryptoKey,
  iv: Uint8Array<ArrayBuffer>,
  ciphertext: Uint8Array<ArrayBuffer>,
): Promise<string> {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(ciphertext),
  );
  return new TextDecoder().decode(plain);
}

async function unlockWith(
  passphrase: string,
  meta: MetaRecord,
): Promise<Result<CryptoKey, TesseraError>> {
  if (meta.salt === undefined || meta.checkIv === undefined || meta.checkCipher === undefined) {
    return err(ioError("vault meta is invalid"));
  }
  const key = await deriveAesKey(passphrase, listToBytes(meta.salt));
  try {
    const check = await decrypt(key, listToBytes(meta.checkIv), listToBytes(meta.checkCipher));
    if (check !== VERIFIER) {
      return err(denied("vault passphrase is incorrect"));
    }
    return ok(key);
  } catch {
    return err(denied("vault passphrase is incorrect"));
  }
}

/**
 * Browser IndexedDB {@link KeyVault} (`07` §6). Desktop OS keychain is T-0505.
 *
 * @example
 * ```ts
 * const vault = await createIndexedDbKeyVault({ clock, logger, passphrase: "x" });
 * ```
 *
 * @public
 */
export async function createIndexedDbKeyVault(
  deps: IndexedDbKeyVaultDeps,
): Promise<Result<KeyVault, TesseraError>> {
  let cryptoKey: CryptoKey | undefined;
  let encrypted = false;
  let locked = false;

  const initialized = await withDb(async (db) => {
    const metaResult = await readMeta(db);
    if (!metaResult.ok) {
      return metaResult;
    }
    const existing = metaResult.value;
    if (existing === undefined) {
      if (deps.passphrase === undefined) {
        const written = await writeMeta(db, { encrypted: false });
        if (!written.ok) {
          return written;
        }
        encrypted = false;
        locked = false;
        deps.logger.info("providers_llm.vault.opened", { encrypted: false });
        return ok(undefined);
      }
      const salt = crypto.getRandomValues(new Uint8Array(VAULT_SALT_BYTES));
      const key = await deriveAesKey(deps.passphrase, salt);
      const check = await encrypt(key, VERIFIER);
      const written = await writeMeta(db, {
        encrypted: true,
        salt: bytesToList(salt),
        checkIv: bytesToList(check.iv),
        checkCipher: bytesToList(check.ciphertext),
      });
      if (!written.ok) {
        return written;
      }
      cryptoKey = key;
      encrypted = true;
      locked = false;
      deps.logger.info("providers_llm.vault.opened", { encrypted: true });
      return ok(undefined);
    }
    encrypted = existing.encrypted;
    if (!existing.encrypted) {
      locked = false;
      deps.logger.info("providers_llm.vault.opened", { encrypted: false });
      return ok(undefined);
    }
    if (deps.passphrase === undefined) {
      locked = true;
      deps.logger.info("providers_llm.vault.opened", { encrypted: true, locked: true });
      return ok(undefined);
    }
    const unlocked = await unlockWith(deps.passphrase, existing);
    if (!unlocked.ok) {
      return unlocked;
    }
    cryptoKey = unlocked.value;
    locked = false;
    deps.logger.info("providers_llm.vault.opened", { encrypted: true });
    return ok(undefined);
  });
  if (!initialized.ok) {
    return initialized;
  }

  const requireUnlocked = (): Result<void, TesseraError> => {
    if (locked) {
      return err(denied("vault is locked"));
    }
    return ok(undefined);
  };

  const vault: KeyVault = {
    get locked() {
      return locked;
    },
    async get(ref) {
      const gate = requireUnlocked();
      if (!gate.ok) {
        return gate;
      }
      deps.logger.info("providers_llm.vault.get", { ref });
      return withDb(async (db) => {
        const tx = db.transaction(SECRET_STORE, "readonly");
        const got = await idbRequest(tx.objectStore(SECRET_STORE).get(ref));
        if (!got.ok) {
          return got;
        }
        if (got.value === undefined) {
          return err(denied("vault secret missing"));
        }
        const record = parseSecret(got.value);
        if (!record.ok) {
          return record;
        }
        if (record.value.plaintext !== undefined) {
          return ok(record.value.plaintext);
        }
        if (
          cryptoKey === undefined ||
          record.value.iv === undefined ||
          record.value.ciphertext === undefined
        ) {
          return err(denied("vault is locked"));
        }
        try {
          const secret = await decrypt(
            cryptoKey,
            listToBytes(record.value.iv),
            listToBytes(record.value.ciphertext),
          );
          return ok(secret);
        } catch {
          return err(denied("vault is locked"));
        }
      });
    },
    async set(ref, secret) {
      const gate = requireUnlocked();
      if (!gate.ok) {
        return gate;
      }
      deps.logger.info("providers_llm.vault.set", { ref });
      return withDb(async (db) => {
        let createdAt = deps.clock.nowIso();
        const existingReq = await idbRequest(
          db.transaction(SECRET_STORE, "readonly").objectStore(SECRET_STORE).get(ref),
        );
        if (!existingReq.ok) {
          return existingReq;
        }
        if (existingReq.value !== undefined) {
          const existing = parseSecret(existingReq.value);
          if (existing.ok) {
            createdAt = existing.value.createdAt;
          }
        }
        let record: SecretRecord;
        if (encrypted) {
          if (cryptoKey === undefined) {
            return err(denied("vault is locked"));
          }
          const sealed = await encrypt(cryptoKey, secret);
          record = {
            createdAt,
            iv: bytesToList(sealed.iv),
            ciphertext: bytesToList(sealed.ciphertext),
          };
        } else {
          record = { createdAt, plaintext: secret };
        }
        const put = await idbRequest(
          db.transaction(SECRET_STORE, "readwrite").objectStore(SECRET_STORE).put(record, ref),
        );
        if (!put.ok) {
          return put;
        }
        return ok(undefined);
      });
    },
    async delete(ref) {
      const gate = requireUnlocked();
      if (!gate.ok) {
        return gate;
      }
      deps.logger.info("providers_llm.vault.delete", { ref });
      return withDb(async (db) => {
        const del = await idbRequest(
          db.transaction(SECRET_STORE, "readwrite").objectStore(SECRET_STORE).delete(ref),
        );
        if (!del.ok) {
          return del;
        }
        return ok(undefined);
      });
    },
    async list() {
      return withDb(async (db) => {
        const tx = db.transaction(SECRET_STORE, "readonly");
        const store = tx.objectStore(SECRET_STORE);
        const keys = await idbRequest(store.getAllKeys());
        if (!keys.ok) {
          return keys;
        }
        const items: { ref: string; createdAt: string }[] = [];
        for (const key of keys.value) {
          if (typeof key !== "string") {
            continue;
          }
          const got = await idbRequest(store.get(key));
          if (!got.ok) {
            return got;
          }
          if (got.value === undefined) {
            continue;
          }
          const record = parseSecret(got.value);
          if (!record.ok) {
            return record;
          }
          items.push({ ref: key, createdAt: record.value.createdAt });
        }
        return ok(items);
      });
    },
    async unlock(passphrase) {
      if (!encrypted) {
        locked = false;
        return ok(undefined);
      }
      const metaResult = await withDb(readMeta);
      if (!metaResult.ok) {
        return metaResult;
      }
      if (metaResult.value === undefined) {
        return err(ioError("vault meta is invalid"));
      }
      const unlocked = await unlockWith(passphrase, metaResult.value);
      if (!unlocked.ok) {
        deps.logger.info("providers_llm.vault.unlock_failed", {});
        return unlocked;
      }
      cryptoKey = unlocked.value;
      locked = false;
      deps.logger.info("providers_llm.vault.unlocked", {});
      return ok(undefined);
    },
  };
  return ok(vault);
}
