import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LogoMark } from "./Logo";
import type { ShellNavItem } from "./nav-items";

export async function SiteFooter({ locale, items }: { locale: string; items: ShellNavItem[] }) {
  const t = await getTranslations({ locale, namespace: "common" });
  const linkClass = "inline-flex min-h-11 items-center text-ink-2 underline-offset-4 hover:text-ink hover:underline md:min-h-9";
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-8" />
            <span className="font-display text-lg font-semibold text-ink">{t("appName")}</span>
          </div>
          <p className="mt-3 max-w-sm text-sm text-ink-2">{t("footer.blurb")}</p>
          <p className="mt-3 max-w-sm text-xs text-ink-2">{t("footer.installHint")}</p>
        </div>
        <nav aria-label={t("a11y.footerNav")} className="contents">
          <div>
            <h2 className="text-xs font-semibold tracking-widest text-gold-ink uppercase">{t("footer.explore")}</h2>
            <ul className="mt-3 space-y-1 text-sm">
              {items.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-xs font-semibold tracking-widest text-gold-ink uppercase">{t("footer.company")}</h2>
            <ul className="mt-3 space-y-1 text-sm">
              <li>
                <Link href="/about" className={linkClass}>
                  {t("footer.about")}
                </Link>
              </li>
              <li>
                <Link href="/about/data" className={linkClass}>
                  {t("footer.data")}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className={linkClass}>
                  {t("footer.privacy")}
                </Link>
              </li>
              <li>
                <Link href="/terms" className={linkClass}>
                  {t("footer.terms")}
                </Link>
              </li>
            </ul>
          </div>
        </nav>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 text-xs text-ink-2 sm:px-6">
          <p className="max-w-3xl">{t("footer.disclaimer")}</p>
          <p>{t("footer.copyright", { year: String(new Date().getFullYear()) })}</p>
        </div>
      </div>
    </footer>
  );
}
