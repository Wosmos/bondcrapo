import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Icon } from "@/components/shell/icons";
import { Link } from "@/i18n/navigation";
import { pageMetadata } from "@/i18n/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common.offline" });
  return pageMetadata({ locale, path: "/offline", title: t("metaTitle"), description: t("body"), noIndex: true });
}

/** Precached by the service worker and served for navigations that fail with no cached copy. */
export default async function OfflinePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "common.offline" });
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center">
      <span className="flex size-20 items-center justify-center rounded-full bg-surface-2 text-brand">
        <Icon name="offline" className="size-10" />
      </span>
      <h1 className="font-display mt-6 text-3xl font-semibold text-ink">{t("title")}</h1>
      <p className="mt-3 text-ink-2">{t("body")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {/* A plain link reloads through the network; no JavaScript needed. */}
        <a
          href={`/${locale}/offline`}
          className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 font-semibold text-on-brand hover:bg-brand-strong"
        >
          {t("retry")}
        </a>
        <Link href="/" className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-5 font-semibold text-ink hover:bg-surface-2">
          {t("home")}
        </Link>
      </div>
    </div>
  );
}
