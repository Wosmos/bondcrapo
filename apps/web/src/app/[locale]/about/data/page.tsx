import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContentPage } from "@/components/content/ContentPage";
import { BOND_SOURCES, MARKET_SOURCES, type SourceRef } from "@/components/content/sources";
import { Link } from "@/i18n/navigation";
import { paths } from "@/i18n/paths";
import { pageMetadata } from "@/i18n/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common.data" });
  return pageMetadata({ locale, path: paths.data, title: t("metaTitle"), description: t("metaDescription") });
}

export default async function DataSourcesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "common.data" });

  const list = (sources: SourceRef[]) => (
    <ul className="not-prose mt-4 grid list-none gap-3 ps-0 sm:grid-cols-2">
      {sources.map((s) => (
        <li key={s.id} className="m-0 rounded-2xl border border-line bg-surface p-4">
          <p className="m-0 font-semibold text-ink">{t(`sources.${s.id}.name`)}</p>
          <p className="mt-1 mb-0 text-sm text-ink-2">{t(`sources.${s.id}.role`)}</p>
          {t.has(`sources.${s.id}.credit`) ? (
            <p className="mt-2 mb-0 text-sm font-medium text-ink" lang="en">
              <a href={s.url} rel="noopener">
                {t(`sources.${s.id}.credit`)}
              </a>
            </p>
          ) : null}
          <p className="mt-2 mb-0 text-sm">
            <a href={s.url} rel="noopener noreferrer" className="inline-flex min-h-6 items-center">
              <bdi dir="ltr">{new URL(s.url).host.replace(/^www\./, "")}</bdi>
            </a>
          </p>
        </li>
      ))}
    </ul>
  );

  return (
    <ContentPage title={t("title")} lead={t("lead")}>
      <h2>{t("bondsHeading")}</h2>
      {list(BOND_SOURCES)}
      <h2>{t("marketsHeading")}</h2>
      {list(MARKET_SOURCES)}

      <h2>{t("checksHeading")}</h2>
      <ul>
        {(t.raw("checks") as string[]).map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>

      <h2>{t("statusHeading")}</h2>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
        {(t.raw("status") as { term: string; text: string }[]).map((s) => (
          <div key={s.term} className="contents">
            <dt className="font-semibold text-ink">{s.term}</dt>
            <dd className="m-0 text-ink-2">{s.text}</dd>
          </div>
        ))}
      </dl>

      <h2>{t("crawlerHeading")}</h2>
      <p>{t("crawler")}</p>
      <p>
        <Link href={paths.coverage}>{t("coverageLink")}</Link>
      </p>
    </ContentPage>
  );
}
