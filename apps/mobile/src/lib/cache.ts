import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "bondcheck.cache.v1:";

export interface CacheEntry<T> {
  value: T;
  savedAt: number;
}

/** Last good response per key, so screens open instantly and work offline. */
export async function readCache<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    return typeof entry?.savedAt === "number" ? entry : null;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify({ value, savedAt: Date.now() }));
  } catch {
    // A full disk must never break the screen; the data is still shown from memory.
  }
}

export async function clearCache(keys?: string[]): Promise<void> {
  const all = await AsyncStorage.getAllKeys();
  const ours = all.filter((k) => k.startsWith(PREFIX) && (!keys || keys.some((key) => k === PREFIX + key)));
  if (ours.length) await AsyncStorage.multiRemove(ours);
}
