import "fake-indexeddb/auto";
import { createLogger, createMemorySink, isErr, isOk, redact } from "@tessera/std";
import { FakeClock } from "@tessera/testing";
import { afterEach, expect, test } from "vitest";
import {
  createIndexedDbKeyVault,
  VAULT_DB_NAME,
  VAULT_PBKDF2_ITERATIONS,
} from "./indexeddb-key-vault.js";

const CANARY = "canary-secret-sk-live-not-for-logs";

afterEach(() => {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(VAULT_DB_NAME);
    request.onsuccess = () => {
      resolve();
    };
    request.onblocked = () => {
      resolve();
    };
    request.onerror = () => {
      reject(request.error ?? new Error("deleteDatabase"));
    };
  });
});

function vaultDeps(passphrase?: string) {
  const sink = createMemorySink();
  return {
    sink,
    deps: {
      clock: new FakeClock(),
      logger: createLogger([sink.write]),
      ...(passphrase === undefined ? {} : { passphrase }),
    },
  };
}

test("INV-PRV-02 get reads the secret at call time from tessera-vault", async () => {
  const first = await createIndexedDbKeyVault(vaultDeps().deps);
  expect(isOk(first)).toBe(true);
  if (!isOk(first)) {
    return;
  }
  const stored = await first.value.set("openai-key", CANARY);
  expect(isOk(stored)).toBe(true);
  const second = await createIndexedDbKeyVault(vaultDeps().deps);
  expect(isOk(second)).toBe(true);
  if (!isOk(second)) {
    return;
  }
  const names = await indexedDB.databases();
  expect(names.some((entry) => entry.name === VAULT_DB_NAME)).toBe(true);
  const got = await second.value.get("openai-key");
  expect(isOk(got) && got.value === CANARY).toBe(true);
});

test("set/get/delete/list round-trip without passphrase", async () => {
  const created = await createIndexedDbKeyVault(vaultDeps().deps);
  expect(isOk(created)).toBe(true);
  if (!isOk(created)) {
    return;
  }
  const vault = created.value;
  expect(vault.locked).toBe(false);
  expect(isOk(await vault.set("ref-a", "secret-a"))).toBe(true);
  const listed = await vault.list();
  expect(isOk(listed)).toBe(true);
  if (!isOk(listed)) {
    return;
  }
  expect(listed.value).toEqual([{ ref: "ref-a", createdAt: new FakeClock().nowIso() }]);
  const got = await vault.get("ref-a");
  expect(isOk(got) && got.value === "secret-a").toBe(true);
  expect(isOk(await vault.delete("ref-a"))).toBe(true);
  const after = await vault.list();
  expect(isOk(after) && after.value.length === 0).toBe(true);
  const missing = await vault.get("ref-a");
  expect(isErr(missing) && missing.error.code === "PERMISSION_DENIED").toBe(true);
});

test("passphrase: AES-GCM; locked after reopen until unlock", async () => {
  const opened = await createIndexedDbKeyVault(vaultDeps("phrase-one").deps);
  expect(isOk(opened)).toBe(true);
  if (!isOk(opened)) {
    return;
  }
  expect(opened.value.locked).toBe(false);
  expect(isOk(await opened.value.set("ref-b", "enc-secret"))).toBe(true);
  const reopened = await createIndexedDbKeyVault(vaultDeps().deps);
  expect(isOk(reopened)).toBe(true);
  if (!isOk(reopened)) {
    return;
  }
  expect(reopened.value.locked).toBe(true);
  expect(isOk(await reopened.value.unlock("phrase-one"))).toBe(true);
  expect(reopened.value.locked).toBe(false);
  const got = await reopened.value.get("ref-b");
  expect(isOk(got) && got.value === "enc-secret").toBe(true);
});

test("get while locked is PERMISSION_DENIED", async () => {
  const opened = await createIndexedDbKeyVault(vaultDeps("phrase-two").deps);
  expect(isOk(opened)).toBe(true);
  if (!isOk(opened)) {
    return;
  }
  expect(isOk(await opened.value.set("ref-c", "hidden"))).toBe(true);
  const reopened = await createIndexedDbKeyVault(vaultDeps().deps);
  expect(isOk(reopened)).toBe(true);
  if (!isOk(reopened)) {
    return;
  }
  const got = await reopened.value.get("ref-c");
  expect(isErr(got) && got.error.code === "PERMISSION_DENIED").toBe(true);
  const setLocked = await reopened.value.set("ref-d", "nope");
  expect(isErr(setLocked) && setLocked.error.code === "PERMISSION_DENIED").toBe(true);
  const deleted = await reopened.value.delete("ref-c");
  expect(isErr(deleted) && deleted.error.code === "PERMISSION_DENIED").toBe(true);
});

test("PBKDF2 iteration count is 600000", () => {
  expect(VAULT_PBKDF2_ITERATIONS).toBe(600_000);
});

test("INV-SEC-02 canary secret absent from redact(logs) and TesseraError", async () => {
  const { sink, deps } = vaultDeps("phrase-canary");
  const opened = await createIndexedDbKeyVault(deps);
  expect(isOk(opened)).toBe(true);
  if (!isOk(opened)) {
    return;
  }
  expect(isOk(await opened.value.set("vault-ref", CANARY))).toBe(true);
  const failed = await opened.value.get("missing-ref");
  expect(isErr(failed)).toBe(true);
  if (!isErr(failed)) {
    return;
  }
  const logged = JSON.stringify(sink.entries);
  expect(logged.includes(CANARY)).toBe(false);
  expect(JSON.stringify(redact(sink.entries)).includes(CANARY)).toBe(false);
  expect(failed.error.message.includes(CANARY)).toBe(false);
  expect(JSON.stringify(failed.error).includes(CANARY)).toBe(false);
});

function putRecord(storeName: string, key: IDBValidKey, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(VAULT_DB_NAME, 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(storeName, "readwrite");
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error("putRecord"));
      };
      tx.objectStore(storeName).put(value, key);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("open"));
    };
  });
}

test("factory passphrase unlocks an existing encrypted vault", async () => {
  const opened = await createIndexedDbKeyVault(vaultDeps("phrase-factory").deps);
  expect(isOk(opened)).toBe(true);
  if (!isOk(opened)) {
    return;
  }
  expect(isOk(await opened.value.set("ref-e", "via-factory"))).toBe(true);
  const again = await createIndexedDbKeyVault(vaultDeps("phrase-factory").deps);
  expect(isOk(again)).toBe(true);
  if (!isOk(again)) {
    return;
  }
  expect(again.value.locked).toBe(false);
  const got = await again.value.get("ref-e");
  expect(isOk(got) && got.value === "via-factory").toBe(true);
});

test("wrong passphrase on open and unlock is PERMISSION_DENIED", async () => {
  const opened = await createIndexedDbKeyVault(vaultDeps("phrase-right").deps);
  expect(isOk(opened)).toBe(true);
  if (!isOk(opened)) {
    return;
  }
  const wrongOpen = await createIndexedDbKeyVault(vaultDeps("phrase-wrong").deps);
  expect(isErr(wrongOpen) && wrongOpen.error.code === "PERMISSION_DENIED").toBe(true);
  const locked = await createIndexedDbKeyVault(vaultDeps().deps);
  expect(isOk(locked)).toBe(true);
  if (!isOk(locked)) {
    return;
  }
  const unlocked = await locked.value.unlock("nope");
  expect(isErr(unlocked) && unlocked.error.code === "PERMISSION_DENIED").toBe(true);
  expect(isOk(await locked.value.unlock("phrase-right"))).toBe(true);
});

test("unlock on plaintext vault is ok", async () => {
  const created = await createIndexedDbKeyVault(vaultDeps().deps);
  expect(isOk(created)).toBe(true);
  if (!isOk(created)) {
    return;
  }
  expect(isOk(await created.value.unlock("ignored"))).toBe(true);
  expect(created.value.locked).toBe(false);
});

test("overwrite keeps createdAt", async () => {
  const clock = new FakeClock();
  const created = await createIndexedDbKeyVault({
    clock,
    logger: createLogger([createMemorySink().write]),
  });
  expect(isOk(created)).toBe(true);
  if (!isOk(created)) {
    return;
  }
  expect(isOk(await created.value.set("ref-f", "first"))).toBe(true);
  clock.advance(1000);
  expect(isOk(await created.value.set("ref-f", "second"))).toBe(true);
  const listed = await created.value.list();
  expect(isOk(listed) && listed.value[0]?.createdAt === new FakeClock().nowIso()).toBe(true);
  const got = await created.value.get("ref-f");
  expect(isOk(got) && got.value === "second").toBe(true);
});

test("corrupt meta and secret records are IO_ERROR", async () => {
  const created = await createIndexedDbKeyVault(vaultDeps().deps);
  expect(isOk(created)).toBe(true);
  if (!isOk(created)) {
    return;
  }
  await putRecord("secrets", "bad", { createdAt: 1 });
  const got = await created.value.get("bad");
  expect(isErr(got) && got.error.code === "IO_ERROR").toBe(true);
  const listed = await created.value.list();
  expect(isErr(listed) && listed.error.code === "IO_ERROR").toBe(true);
  await putRecord("meta", "config", { encrypted: "yes" });
  const reopened = await createIndexedDbKeyVault(vaultDeps().deps);
  expect(isErr(reopened) && reopened.error.code === "IO_ERROR").toBe(true);
});
