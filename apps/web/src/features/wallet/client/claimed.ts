/**
 * "Claimed" marks for wins, kept on this device only (the server has no such field and does not
 * need one). Exposed as a tiny external store for `useSyncExternalStore`.
 */
const KEY = "bc_claimed_wins";
const listeners = new Set<() => void>();

export const claimedKey = (m: { drawId: number; bondNumber: string }) => `${m.drawId}:${m.bondNumber}`;

/** Snapshot as a stable string ("a|b|c") so React can compare it cheaply. */
export function readClaimed(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function isClaimed(snapshot: string, m: { drawId: number; bondNumber: string }): boolean {
  return snapshot.split("|").includes(claimedKey(m));
}

export function toggleClaimed(m: { drawId: number; bondNumber: string }): void {
  const set = new Set(readClaimed().split("|").filter(Boolean));
  const k = claimedKey(m);
  if (set.has(k)) set.delete(k);
  else set.add(k);
  try {
    localStorage.setItem(KEY, [...set].join("|"));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

export function subscribeClaimed(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
