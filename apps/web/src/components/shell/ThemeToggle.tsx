"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "./icons";
import { THEME_STORAGE_KEY as KEY } from "./theme-script";

type Mode = "system" | "light" | "dark";
const ORDER: Mode[] = ["system", "light", "dark"];
const listeners = new Set<() => void>();

function read(): Mode {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function write(mode: Mode) {
  try {
    if (mode === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, mode);
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  if (mode === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = mode;
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

const ICON: Record<Mode, string> = { system: "system", light: "sun", dark: "moon" };

/** Cycles System, Light and Dark. The inline script in the layout applies the choice before paint. */
export function ThemeToggle({ labels }: { labels: Record<Mode, string> & { button: string } }) {
  const mode = useSyncExternalStore(subscribe, read, () => "system" as Mode);
  const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
  return (
    <button
      type="button"
      onClick={() => write(next)}
      aria-label={labels.button.replace("{mode}", labels[mode])}
      title={labels[mode]}
      className="inline-flex size-11 items-center justify-center rounded-full border border-line text-ink hover:border-line-strong hover:bg-surface-2"
    >
      <Icon name={ICON[mode]} className="size-5" />
    </button>
  );
}

