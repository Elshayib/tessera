import "fake-indexeddb/auto";
import { createLogger, isOk } from "@tessera/std";
import { FakeClock } from "@tessera/testing";
import { afterEach, expect, test } from "vitest";
import { createBrowserKeyVault } from "./browser-key-vault.js";

const CANARY = "canary-secret-sk-web-vault";
const VAULT_DB = "tessera-vault";

afterEach(() => {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(VAULT_DB);
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

test("INV-PRV-02 browser vault persists across façade instances", async () => {
  const clock = new FakeClock();
  const logger = createLogger([]);
  const first = createBrowserKeyVault({ clock, logger });
  const stored = await first.set("openrouter", CANARY);
  expect(isOk(stored)).toBe(true);
  const second = createBrowserKeyVault({ clock, logger });
  const loaded = await second.get("openrouter");
  expect(isOk(loaded)).toBe(true);
  if (!isOk(loaded)) {
    return;
  }
  expect(loaded.value).toBe(CANARY);
});

test("browser vault falls back to memory when open fails", async () => {
  const vault = createBrowserKeyVault({
    clock: new FakeClock(),
    logger: createLogger([]),
    open: async () => ({
      ok: false,
      error: { code: "IO_ERROR", message: "no indexeddb" },
    }),
  });
  const stored = await vault.set("openai", CANARY);
  expect(isOk(stored)).toBe(true);
  const loaded = await vault.get("openai");
  expect(isOk(loaded)).toBe(true);
  if (!isOk(loaded)) {
    return;
  }
  expect(loaded.value).toBe(CANARY);
});
