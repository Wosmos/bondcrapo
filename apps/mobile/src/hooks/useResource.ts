import { useCallback, useEffect, useRef, useState } from "react";
import { readCache, writeCache } from "@/lib/cache";

export type ResourceStatus = "loading" | "ready" | "error";

export interface Resource<T> {
  status: ResourceStatus;
  data: T | undefined;
  error: unknown;
  /** Data came from the offline cache and the latest refresh failed or is still running. */
  stale: boolean;
  savedAt: number | null;
  refreshing: boolean;
  refresh: () => Promise<void>;
}

/**
 * Cache-then-network loader: shows the last saved copy immediately, then refreshes. An error
 * is only surfaced as `status: "error"` when there is nothing cached to show.
 */
export function useResource<T>(
  key: string | null,
  load: () => Promise<T>,
  { persist = true }: { persist?: boolean } = {},
): Resource<T> {
  const [state, setState] = useState<Omit<Resource<T>, "refresh">>({
    status: "loading",
    data: undefined,
    error: undefined,
    stale: false,
    savedAt: null,
    refreshing: false,
  });
  const loadRef = useRef(load);
  loadRef.current = load;
  const generation = useRef(0);

  const fetchFresh = useCallback(
    async (currentKey: string, gen: number) => {
      setState((s) => ({ ...s, refreshing: true }));
      try {
        const value = await loadRef.current();
        if (gen !== generation.current) return;
        setState({ status: "ready", data: value, error: undefined, stale: false, savedAt: Date.now(), refreshing: false });
        if (persist) await writeCache(currentKey, value);
      } catch (error) {
        if (gen !== generation.current) return;
        setState((s) =>
          s.data !== undefined
            ? { ...s, error, stale: true, refreshing: false }
            : { ...s, status: "error", error, refreshing: false },
        );
      }
    },
    [persist],
  );

  useEffect(() => {
    if (!key) return;
    const gen = ++generation.current;
    setState({ status: "loading", data: undefined, error: undefined, stale: false, savedAt: null, refreshing: false });
    void (async () => {
      if (persist) {
        const cached = await readCache<T>(key);
        if (cached && gen === generation.current) {
          setState({ status: "ready", data: cached.value, error: undefined, stale: true, savedAt: cached.savedAt, refreshing: true });
        }
      }
      await fetchFresh(key, gen);
    })();
  }, [key, persist, fetchFresh]);

  const refresh = useCallback(async () => {
    if (!key) return;
    await fetchFresh(key, generation.current);
  }, [key, fetchFresh]);

  return { ...state, refresh };
}
