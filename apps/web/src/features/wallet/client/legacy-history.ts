import { normalizeDenomination } from "@bondcheck/shared/wallet/parse";

/**
 * One-time migration of the previous app's local history (`bondcheck_history` IndexedDB, written
 * by `lib/history-db.ts`). It only ever reads that database and never creates it.
 */

const LEGACY_DB = "bondcheck_history";
const LEGACY_STORE = "history";
const DONE_KEY = "bc_legacy_history_handled";

interface LegacyEntry {
  bondNumbers?: unknown;
  results?: Record<string, { denomination?: unknown }[]>;
}

export interface LegacyBond {
  bondNumber: string;
  /** Known when the old check found a win in a denomination; otherwise the person picks one. */
  denominationCode: string | null;
}

function openExisting(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(LEGACY_DB);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      // The database did not exist: abort so the browser does not create an empty one.
      req.transaction?.abort();
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

export function legacyHistoryHandled(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === "1";
  } catch {
    return true;
  }
}

export function markLegacyHistoryHandled(): void {
  try {
    localStorage.setItem(DONE_KEY, "1");
  } catch {
    /* storage unavailable: the banner may show again, which is harmless */
  }
}

export async function readLegacyBonds(): Promise<LegacyBond[]> {
  if (typeof indexedDB === "undefined" || legacyHistoryHandled()) return [];
  const db = await openExisting();
  if (!db) return [];
  try {
    if (!db.objectStoreNames.contains(LEGACY_STORE)) return [];
    const entries = await new Promise<LegacyEntry[]>((resolve) => {
      const req = db.transaction(LEGACY_STORE, "readonly").objectStore(LEGACY_STORE).getAll();
      req.onsuccess = () => resolve((req.result as LegacyEntry[]) ?? []);
      req.onerror = () => resolve([]);
    });
    return collectLegacyBonds(entries);
  } finally {
    db.close();
  }
}

/** Pure part, exported for tests: unique numbers, with every denomination a past win revealed. */
export function collectLegacyBonds(entries: readonly LegacyEntry[]): LegacyBond[] {
  const out = new Map<string, LegacyBond>();
  for (const e of entries) {
    const numbers = Array.isArray(e.bondNumbers) ? e.bondNumbers : [];
    for (const raw of numbers) {
      const n = String(raw).trim();
      if (!/^\d{6}$/.test(n)) continue;
      const denoms = new Set(
        (e.results?.[n] ?? []).map((r) => normalizeDenomination(r.denomination as string | number)).filter(Boolean),
      );
      if (denoms.size === 0) {
        if (![...out.values()].some((b) => b.bondNumber === n)) out.set(`?:${n}`, { bondNumber: n, denominationCode: null });
      } else {
        out.delete(`?:${n}`);
        for (const d of denoms) out.set(`${d}:${n}`, { bondNumber: n, denominationCode: d as string });
      }
    }
  }
  return [...out.values()];
}
