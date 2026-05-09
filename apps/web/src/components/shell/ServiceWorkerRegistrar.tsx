"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js after load, in production builds only (dev reloads must never be cached).
 * On the first visit the worker is not in control yet, so the page tells it which same-origin
 * URLs it already loaded; they are cached for offline use right away.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        const ready = await navigator.serviceWorker.ready;
        const urls = [
          location.href,
          ...performance
            .getEntriesByType("resource")
            .map((e) => e.name)
            .filter((u) => u.startsWith(location.origin)),
        ];
        ready.active?.postMessage({ type: "CACHE_URLS", urls });
      } catch {
        // Offline support is an enhancement; the site works without it.
      }
    };
    if (document.readyState === "complete") void register();
    else window.addEventListener("load", () => void register(), { once: true });
  }, []);
  return null;
}
