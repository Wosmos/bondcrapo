/**
 * Local-first copy of the wallet in IndexedDB (ADR 0004): the last good snapshot is shown
 * instantly and stays readable offline. Holds only what the server already returned for this
 * device; never the token (that lives in the httpOnly cookie).
 */
import type { WalletSnapshot } from "./types";

const DB_NAME = "bondcheck_wallet";
const DB_VERSION = 1;
const STORE = "kv";
const SNAPSHOT_KEY = "snapshot";
const PENDING_CODE_KEY = "pendingSyncCode";

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  if (!hasIndexedDb()) return undefined;
  const db = await open();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Storage failures (private mode, quota) must never break the wallet, so they resolve quietly. */
async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

export const readSnapshot = () =>
  safe(run<WalletSnapshot>("readonly", (s) => s.get(SNAPSHOT_KEY) as IDBRequest<WalletSnapshot>), undefined);

export const writeSnapshot = (snapshot: WalletSnapshot) =>
  safe(run("readwrite", (s) => void s.put(snapshot, SNAPSHOT_KEY)), undefined);

/** The sync code returned on create or restore, kept until the person confirms they saved it. */
export const readPendingSyncCode = () =>
  safe(run<string>("readonly", (s) => s.get(PENDING_CODE_KEY) as IDBRequest<string>), undefined);

export const writePendingSyncCode = (code: string | null) =>
  safe(
    run("readwrite", (s) => void (code ? s.put(code, PENDING_CODE_KEY) : s.delete(PENDING_CODE_KEY))),
    undefined,
  );

export const clearWalletCache = () => safe(run("readwrite", (s) => void s.clear()), undefined);
