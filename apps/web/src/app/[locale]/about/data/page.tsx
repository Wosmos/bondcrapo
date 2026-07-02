import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContentPage } from "@/components/content/ContentPage";
import { BOND_SOURCES, MARKET_SOURCES, type SourceRef } from "@/components/content/sources";
import { Link } from "@/i18n/navigation";
import { paths } from "@/i18n/paths";
import { pageMetadata } from "@/i18n/seo";
import { attributionFor } from "@bondcheck/ingest/markets/sources";
import { DataTable } from "@/components/ui";
import { formatDate, formatDateTime } from "@/features/markets/lib/format";
import { loadFreshness, type DatasetFreshness } from "@/server/freshness";

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
  const freshness = await loadFreshness();

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
      <h2>{t("freshness.heading")}</h2>
      <p>{t("freshness.lead")}</p>
      {freshness ? null : <p>{t("freshness.unavailable")}</p>}
      <div className="not-prose">
        <DataTable
          caption={t("freshness.caption")}
          getRowKey={(r: DatasetFreshness) => r.id}
          rows={freshness ?? FRESHNESS_IDS.map((id) => ({ id, sources: [], latest: null }))}
          columns={[
            {
              key: "what",
              header: t("freshness.what"),
              cell: (r: DatasetFreshness) => (
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium text-ink">{t(`freshness.rows.${r.id}.what`)}</span>
                  <span className="text-xs text-ink-2">{t(`freshness.rows.${r.id}.how`)}</span>
                </span>
              ),
            },
            { key: "source", header: t("freshness.source"), cell: (r: DatasetFreshness) => <SourceNames ids={r.sources} /> },
            {
              key: "latest",
              header: t("freshness.latest"),
              cell: (r: DatasetFreshness) =>
                r.latest ? (
                  <span className="flex flex-col gap-0.5">
                    <time dateTime={r.latest} className="whitespace-nowrap text-ink">
                      {r.latest.length > 10 ? formatDateTime(locale, r.latest) : formatDate(locale, r.latest, "long")}
                    </time>
                    {r.count ? <span className="text-xs text-ink-2">{t("freshness.draws", { count: r.count })}</span> : null}
                  </span>
                ) : (
                  <span className="text-ink-2">{t("freshness.none")}</span>
                ),
            },
          ]}
        />
      </div>

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

const FRESHNESS_IDS: DatasetFreshness["id"][] = ["bonds", "pkReported", "estimates", "spot", "openMarket", "interbank", "fx"];

/** Source names with links: bond sources from this page's list, market sources from the ingest registry. */
async function SourceNames({ ids }: { ids: string[] }) {
  const t = await getTranslations("common.data");
  const items = ids.flatMap((id) => {
    const bond = BOND_SOURCES.find((s) => s.id === id);
    if (bond) return [{ name: t(`sources.${bond.id}.name`), url: bond.url }];
    // "derived" is our own calculation: named, not linked to one of its inputs.
    return attributionFor([id]).map((a) => ({ name: a.name, url: id === "derived" ? undefined : a.url }));
  });
  if (items.length === 0) return <span className="text-ink-2">-</span>;
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {items.map((s) => (
        <li key={s.name} className="m-0">
          {s.url ? (
            <a href={s.url} rel="noopener noreferrer external" target="_blank" className="font-medium text-ink underline underline-offset-2">
              {s.name}
            </a>
          ) : (
            <span className="font-medium text-ink">{s.name}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
