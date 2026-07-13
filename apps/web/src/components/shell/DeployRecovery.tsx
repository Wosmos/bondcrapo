"use client";

import { useEffect } from "react";

const KEY = "bc-deploy-reload";
const PATTERN = /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i;

/**
 * After a deploy, a tab that was already open may ask for code files the new deployment no longer
 * has, and the navigation stalls. When that happens the page reloads once (at most every 30
 * seconds, so a real outage cannot cause a reload loop) and continues on the new version.
 */
export function DeployRecovery() {
  useEffect(() => {
    const recover = (message: string) => {
      if (!PATTERN.test(message)) return;
      try {
        const last = Number(sessionStorage.getItem(KEY) ?? 0);
        if (Date.now() - last < 30_000) return;
        sessionStorage.setItem(KEY, String(Date.now()));
      } catch {
        // Storage blocked: reload anyway; the browser's own back-off applies.
      }
      location.reload();
    };
    const onError = (e: ErrorEvent) => recover(`${e.error?.name ?? ""} ${e.message ?? ""}`);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as { name?: string; message?: string } | undefined;
      recover(`${r?.name ?? ""} ${r?.message ?? String(r ?? "")}`);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
