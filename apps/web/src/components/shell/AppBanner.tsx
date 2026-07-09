"use client";

import { DeviceMobileIcon, XIcon } from "@phosphor-icons/react";
import { useSyncExternalStore } from "react";
import { Link, usePathname } from "@/i18n/navigation";

const KEY = "bc-app-banner";
const listeners = new Set<() => void>();
/** Set when the visitor closes the banner, so it also goes away where storage is blocked. */
let closedThisVisit = false;

function eligible(): boolean {
  const android = /Android/i.test(navigator.userAgent);
  const installed = window.matchMedia("(display-mode: standalone)").matches;
  let dismissed = false;
  try {
    dismissed = localStorage.getItem(KEY) === "1";
  } catch {
    // Private mode: the banner simply comes back next visit.
  }
  return android && !installed && !dismissed && !closedThisVisit;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Invites visitors on an Android phone to get the app. It shows only in the browser (not in the
 * installed app or PWA), never on the download page itself, and stays away once dismissed. It sits
 * above the header in the normal page flow, so it covers nothing and needs no layout shift fix.
 */
export function AppBanner({ labels }: { labels: { title: string; body: string; cta: string; close: string } }) {
  const pathname = usePathname();
  // False on the server and during hydration, so the page never mismatches; true only on Android.
  const show = useSyncExternalStore(subscribe, eligible, () => false);

  if (!show || pathname.startsWith("/download")) return null;

  return (
    <aside aria-label={labels.title} className="flex items-center gap-3 border-b border-line bg-surface-2 px-4 py-2.5 md:hidden">
      <DeviceMobileIcon aria-hidden="true" className="size-6 shrink-0 text-brand" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{labels.title}</p>
        <p className="text-xs text-ink-2">{labels.body}</p>
      </div>
      <Link href="/download" className="shrink-0 text-sm font-semibold text-brand underline underline-offset-4">
        {labels.cta}
      </Link>
      <button
        type="button"
        aria-label={labels.close}
        onClick={() => {
          closedThisVisit = true;
          try {
            localStorage.setItem(KEY, "1");
          } catch {
            // Dismissed for this visit only.
          }
          listeners.forEach((l) => l());
        }}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-line"
      >
        <XIcon aria-hidden="true" className="size-4" />
      </button>
    </aside>
  );
}
