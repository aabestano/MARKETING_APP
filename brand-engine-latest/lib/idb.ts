import type { StateStorage } from "zustand/middleware";

const DB_NAME = "brand-engine";
const STORE = "kv";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("IndexedDB failed to open"));
      req.onblocked = () => reject(new Error("IndexedDB is blocked by another tab"));
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
        tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
      }),
  );
}

export const idbAvailable = () => typeof indexedDB !== "undefined";

export function idbGet(key: string): Promise<string | null> {
  return run<unknown>("readonly", (s) => s.get(key)).then((v) => (typeof v === "string" ? v : null));
}

export function idbSet(key: string, value: string): Promise<void> {
  return run("readwrite", (s) => s.put(value, key)).then(() => undefined);
}

export function idbDelete(key: string): Promise<void> {
  return run("readwrite", (s) => s.delete(key)).then(() => undefined);
}

export const STORAGE_ERROR_EVENT = "brand-engine:storage-error";

function reportStorageError(detail: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, { detail }));
}

/**
 * Zustand storage backed by IndexedDB. On first load it adopts any data the previous
 * localStorage-based version saved under the same key, then removes the legacy copy once the
 * IndexedDB write has succeeded. Falls back to localStorage when IndexedDB is unavailable.
 */
const WRITE_DELAY_MS = 500;

export function createIdbStorage(): StateStorage {
  // The whole workspace is one value, so every change rewrites it. Coalescing rapid edits (typing, sliders)
  // keeps large libraries responsive, and the last write is flushed when the tab is hidden or closed.
  const pending = new Map<string, string>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const writeNow = async (name: string, value: string) => {
    if (!idbAvailable()) {
      try {
        localStorage.setItem(name, value);
      } catch {
        reportStorageError("Browser storage is full. Delete large files from your brand books to keep saving.");
      }
      return;
    }
    try {
      await idbSet(name, value);
      try {
        localStorage.removeItem(name);
      } catch {
        /* ignore */
      }
    } catch {
      reportStorageError("Couldn't save to browser storage (it may be full or blocked). Export your workspace as a backup.");
    }
  };

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const entries = [...pending.entries()];
    pending.clear();
    return Promise.all(entries.map(([name, value]) => writeNow(name, value)));
  };

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => void flush());
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && void flush());
  }

  return {
    getItem: async (name) => {
      const queued = pending.get(name);
      if (queued !== undefined) return queued;
      if (!idbAvailable()) return localStorage.getItem(name);
      try {
        const stored = await idbGet(name);
        if (stored !== null) return stored;
      } catch {
        return localStorage.getItem(name);
      }
      return localStorage.getItem(name);
    },
    setItem: (name, value) => {
      pending.set(name, value);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush(), WRITE_DELAY_MS);
    },
    removeItem: async (name) => {
      pending.delete(name);
      try {
        if (idbAvailable()) await idbDelete(name);
      } finally {
        localStorage.removeItem(name);
      }
    },
  };
}
