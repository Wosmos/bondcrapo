import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LogoMark } from "./Logo";
import { MainNav } from "./MainNav";
import type { ShellNavItem } from "./nav-items";
import { ThemeToggle } from "./ThemeToggle";

export async function SiteHeader({ locale, items }: { locale: string; items: ShellNavItem[] }) {
  const t = await getTranslations({ locale, namespace: "common" });
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" aria-label={t("a11y.homeLink")} className="flex shrink-0 items-center gap-2.5 rounded-lg">
          <LogoMark className="size-9" />
          <span className="font-display text-xl font-semibold tracking-tight text-ink">{t("appName")}</span>
        </Link>
        <MainNav items={items} label={t("a11y.mainNav")} />
        <div className="flex items-center gap-2">
          <LanguageSwitcher label={t("languageSwitch.toLabel")} text={t("languageSwitch.to")} />
          <ThemeToggle
            labels={{
              system: t("theme.system"),
              light: t("theme.light"),
              dark: t("theme.dark"),
              button: t.raw("theme.button") as string,
            }}
          />
        </div>
      </div>
    </header>
  );
}
