import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DENOMINATION_CODES } from "@bondcheck/shared";
import { Card, DataTable, PageHeader } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { BondNumber } from "@/features/bonds/components/BondNumber";
import { Breadcrumbs } from "@/features/bonds/components/Breadcrumbs";
import { JsonLd } from "@/features/bonds/components/JsonLd";
import { PrizeTable } from "@/features/bonds/components/PrizeTable";
import { StatusBadge } from "@/features/bonds/components/StatusBadge";
import { Unavailable } from "@/features/bonds/components/Unavailable";
import { daysUntil, formatDrawDate, todayInPakistan } from "@/features/bonds/format";
import { codeFromSlug, denominationSlug } from "@/features/bonds/labels";
import { alternates, breadcrumbLd } from "@/features/bonds/seo";
import { attempt, loadDenomination, loadDenominations } from "@/features/bonds/server/pages";

export const revalidate = 3600;

type Props = { params: Promise<{ locale: string; denomination: string }> };

export function generateStaticParams() {
  return DENOMINATION_CODES.map((c) => ({ denomination: denominationSlug(c) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, denomination } = await params;
  const code = codeFromSlug(denomination);
  if (!code) return {};
  const t = await getTranslations({ locale, namespace: "bonds" });
  const bond = t("common.bondName", { denomination: t(`common.denomination.${code}`) });
  return {
    title: t("denomination.metaTitle", { bond }),
    description: t("denomination.metaDescription", { bond }),
    alternates: alternates(locale, `/prize-bonds/${denominationSlug(code)}`),
  };
}

export default async function DenominationPage({ params }: Props) {
  const { locale, denomination } = await params;
  const code = codeFromSlug(denomination);
  if (!code) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "bonds" });
  const today = todayInPakistan();
  const bond = t("common.bondName", { denomination: t(`common.denomination.${code}`) });
  const slug = denominationSlug(code);
  const [info, data] = await Promise.all([attempt(() => loadDenominations()), attempt(() => loadDenomination(code, today))]);
  const denom = info.ok ? info.value.find((d) => d.code === code) : undefined;
  const notes = denom ? (locale === "ur" ? denom.notesUr : denom.notesEn) : null;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ href: "/prize-bonds", label: t("nav.title") }, { label: t(`common.denomination.${code}`) }]} />
      <JsonLd data={breadcrumbLd([{ name: t("nav.title"), path: "/prize-bonds" }, { name: bond, path: `/prize-bonds/${slug}` }], locale)} />
      <PageHeader
        title={t("denomination.title", { bond })}
        description={notes ?? undefined}
        actions={denom ? <span className="text-sm text-ink-2">{t(`common.kind.${denom.kind}`)} · {denom.status === "active" ? t("common.active") : t("common.discontinued")}</span> : undefined}
      />

      {!data.ok ? (
        <Unavailable retryHref={`/${locale}/prize-bonds/${slug}`} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card title={t("denomination.nextDraw")}>
              {data.value.next ? (
                <p className="text-ink">
                  <time dateTime={data.value.next.drawDate} className="font-semibold">
                    {formatDrawDate(data.value.next.drawDate, locale)}
                  </time>
                  {data.value.next.city ? ` · ${data.value.next.city}` : ""}
                  <span className="block text-sm text-ink-2">
                    {data.value.next.drawNumber ? `${t("common.drawNumber", { number: data.value.next.drawNumber })} · ` : ""}
                    {t("common.inDays", { days: daysUntil(data.value.next.drawDate, today) })}
                  </span>
                </p>
              ) : (
                <p className="text-ink-2">{t("denomination.noNextDraw")}</p>
              )}
            </Card>
            {data.value.latestPrizes?.prizes.length ? (
              <Card title={t("denomination.prizeTableTitle")}>
                <PrizeTable
                  prizes={data.value.latestPrizes.prizes}
                  caption={t("denomination.prizeTableCaption", { date: formatDrawDate(data.value.latestPrizes.drawDate, locale) })}
                />
              </Card>
            ) : null}
          </div>

          <section aria-labelledby="all-draws">
            <h2 id="all-draws" className="mb-2 text-xl font-semibold text-ink">
              {t("denomination.drawsTitle")}
            </h2>
            {data.value.draws.length === 0 ? (
              <p className="text-ink-2">{t("denomination.noDraws")}</p>
            ) : (
              <DataTable
                caption={t("denomination.drawsCaption", { bond })}
                rows={data.value.draws}
                getRowKey={(d) => d.id}
                fileName={`bondcheck-${slug}-draws.csv`}
                columns={[
                  {
                    key: "draw",
                    header: t("denomination.columns.draw"),
                    value: (d) => d.drawNumber ?? null,
                    filter: "range",
                    cell: (d) =>
                      d.drawNumber && d.completeness !== "none" ? (
                        <Link href={`/prize-bonds/${slug}/${d.drawNumber}`} className="font-medium underline underline-offset-4 hover:no-underline">
                          {t("common.drawNumber", { number: d.drawNumber })}
                        </Link>
                      ) : d.drawNumber ? (
                        t("common.drawNumber", { number: d.drawNumber })
                      ) : (
                        <span className="text-ink-2">{t("common.drawNumberUnknown")}</span>
                      ),
                  },
                  {
                    key: "date",
                    header: t("denomination.columns.date"),
                    value: (d) => d.drawDate,
                    filter: "text",
                    cell: (d) => (
                      <time dateTime={d.drawDate} className="whitespace-nowrap">
                        {formatDrawDate(d.drawDate, locale, "short")}
                      </time>
                    ),
                  },
                  { key: "city", header: t("denomination.columns.city"), cell: (d) => d.city ?? "–" },
                  {
                    key: "firstPrize",
                    header: t("denomination.columns.firstPrize"),
                    value: (d) => d.firstPrizes.join(" "),
                    cell: (d) =>
                      d.firstPrizes.length ? (
                        <span className="flex flex-wrap gap-x-2">
                          {d.firstPrizes.map((n) => (
                            <BondNumber key={n} value={n} />
                          ))}
                        </span>
                      ) : (
                        "–"
                      ),
                  },
                  { key: "results", header: t("denomination.columns.results"), filter: "select", cell: (d) => <span className="whitespace-nowrap text-ink-2">{t(`common.completeness.${d.completeness}`)}</span> },
                  { key: "status", header: t("denomination.columns.status"), filter: "select", value: (d) => d.status, cell: (d) => <StatusBadge status={d.status} /> },
                ]}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
