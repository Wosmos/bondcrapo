"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Icon } from "./icons";

/** Links to the same page in the other locale. The visible label is written in that language. */
export function LanguageSwitcher({ label, text }: { label: string; text: string }) {
  const pathname = usePathname();
  const locale = useLocale();
  const target = locale === "ur" ? "en" : "ur";
  return (
    <Link
      href={pathname}
      locale={target}
      hrefLang={target}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-3 text-sm font-semibold text-ink hover:border-line-strong hover:bg-surface-2"
    >
      <Icon name="language" className="size-4.5" />
      {/* Visible text first so the accessible name starts with it (WCAG 2.5.3, label in name). */}
      {/* System Arabic font on English pages: Nastaliq is only downloaded for Urdu pages. */}
      <span lang={target} className="leading-none">
        {text}
      </span>
      <span className="sr-only">{label}</span>
    </Link>
  );
}
