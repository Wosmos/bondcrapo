"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

const TABS = [
  { href: "/prize-bonds/check", key: "check" },
  { href: "/my/bonds", key: "mine" },
  { href: "/my/wins", key: "wins" },
  { href: "/prize-bonds", key: "results" },
  // Straight to this year's page, skipping the redirect at /prize-bonds/schedule.
  { href: `/prize-bonds/schedule/${new Date().getFullYear()}`, key: "schedule" },
  { href: "/my/settings", key: "settings" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** Which tab a page belongs to: the checker and the saved bonds are one section. */
function currentTab(pathname: string): TabKey {
  if (pathname.startsWith("/prize-bonds/check")) return "check";
  if (pathname.startsWith("/prize-bonds/schedule")) return "schedule";
  if (pathname.startsWith("/prize-bonds")) return "results";
  if (pathname.startsWith("/my/wins") || pathname.startsWith("/my/near-misses")) return "wins";
  if (pathname.startsWith("/my/settings") || pathname.startsWith("/my/restore")) return "settings";
  return "mine";
}

/**
 * The one row of tabs over every prize bond page, public or personal, so checking bonds, the
 * saved list, wins and results feel like one place.
 */
export function BondTabs({ newWins = 0 }: { newWins?: number }) {
  const t = useTranslations("common.bondTabs");
  const active = currentTab(usePathname());
  return (
    <nav aria-label={t("label")} className="-mx-1 overflow-x-auto pb-1">
      <ul className="flex min-w-max gap-1 border-b border-line px-1">
        {TABS.map((tab) => {
          const current = tab.key === active;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={`relative -mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                  current ? "border-brand text-ink" : "border-transparent text-ink-2 hover:text-ink"
                }`}
              >
                {t(tab.key)}
                {tab.key === "wins" && newWins > 0 ? (
                  <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-on-brand">
                    <span aria-hidden="true">{newWins}</span>
                    <span className="sr-only">{t("newWins", { count: newWins })}</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
