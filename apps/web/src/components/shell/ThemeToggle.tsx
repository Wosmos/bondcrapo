"use client";

import { useLocale } from "next-intl";
import { useLayoutEffect, useSyncExternalStore } from "react";
import { Icon } from "./icons";
import { THEME_STORAGE_KEY as KEY } from "./theme-script";

type Mode = "light" | "dark";
const listeners = new Set<() => void>();

/** The stored choice, else the device setting (only until the visitor picks one). */
function read(): Mode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    // Private mode: fall through to the device setting.
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(mode: Mode) {
  document.documentElement.dataset.theme = mode;
}

function write(mode: Mode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  apply(mode);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/**
 * Switches between Light and Dark. The inline script in the layout applies a stored choice before
 * the first paint. Changing language re-renders the root layout, and React 19 resets the <html>
 * attributes it does not own (data-theme among them), so the choice is applied again before paint
 * on every locale.
 */
export function ThemeToggle({ labels }: { labels: Record<Mode, string> & { button: string } }) {
  const locale = useLocale();
  const mode = useSyncExternalStore(subscribe, read, () => "light" as Mode);
  useLayoutEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v === "light" || v === "dark") apply(v);
    } catch {
      // Nothing stored: the device setting applies through CSS.
    }
  }, [locale]);
  const next: Mode = mode === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => write(next)}
      aria-label={labels.button.replace("{mode}", labels[mode])}
      title={labels[mode]}
      className="inline-flex size-11 items-center justify-center rounded-full border border-line text-ink hover:border-line-strong hover:bg-surface-2"
    >
      <Icon name={mode === "dark" ? "moon" : "sun"} className="size-5" />
    </button>
  );
}
