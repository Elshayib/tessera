import { tesseraError } from "@tessera/std";

export function openDatabase(
  name: string,
  version: number,
  upgrade: (db: IDBDatabase) => void,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = () => {
      upgrade(request.result);
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      const error = request.error;
      reject(error ?? tesseraError("IO_ERROR", "failed to open indexedDB", { name }));
    };
  });
}

export function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      const error = request.error;
      reject(error ?? tesseraError("IO_ERROR", "indexedDB request failed"));
    };
  });
}

export async function persistStorage(): Promise<void> {
  const storage = globalThis.navigator?.storage;
  if (storage !== undefined && typeof storage.persist === "function") {
    await storage.persist();
  }
}

export async function estimateQuota(): Promise<number | undefined> {
  const storage = globalThis.navigator?.storage;
  if (storage === undefined || typeof storage.estimate !== "function") {
    return undefined;
  }
  const estimate = await storage.estimate();
  return estimate.quota;
}

export function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => {
      resolve();
    };
    request.onblocked = () => {
      resolve();
    };
    request.onerror = () => {
      const error = request.error;
      reject(error ?? tesseraError("IO_ERROR", "failed to delete indexedDB", { name }));
    };
  });
}
