import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatBondNumber } from "@bondcheck/shared";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/features/bonds/components/Breadcrumbs";
import { FindInDraw } from "@/features/bonds/components/FindInDraw";
import { JsonLd } from "@/features/bonds/components/JsonLd";
import { PrizeTable } from "@/features/bonds/components/PrizeTable";
import { SourcesList } from "@/features/bonds/components/SourcesList";
import { CompletenessBadge, StatusBadge } from "@/features/bonds/components/StatusBadge";
import { ThirdPrizeList } from "@/features/bonds/components/ThirdPrizeList";
import { TopPrizes } from "@/features/bonds/components/TopPrizes";
import { Unavailable } from "@/features/bonds/components/Unavailable";
import { formatDrawDate } from "@/features/bonds/format";
import { codeFromSlug, denominationSlug } from "@/features/bonds/labels";
import { alternates, breadcrumbLd } from "@/features/bonds/seo";
import { attempt, loadDraw, recentDrawParams } from "@/features/bonds/server/pages";

export const revalidate = 21600;

type Props = { params: Promise<{ locale: string; denomination: string; drawNumber: string }> };

/** The latest 8 draws of each denomination are built ahead; the rest render on first request. */
export async function generateStaticParams() {
  return (await recentDrawParams(8)).map((p) => ({ denomination: denominationSlug(p.code), drawNumber: String(p.drawNumber) }));
}

function parse(denomination: string, drawNumber: string) {
  const code = codeFromSlug(denomination);
  const n = /^\d{1,4}$/.test(drawNumber) ? Number(drawNumber) : NaN;
  return code && n > 0 ? { code, n } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, denomination, drawNumber } = await params;
  const p = parse(denomination, drawNumber);
  if (!p) return {};
  const t = await getTranslations({ locale, namespace: "bonds" });
  const bond = t("common.bondName", { denomination: t(`common.denomination.${p.code}`) });
  const data = await attempt(() => loadDraw(p.code, p.n));
  const path = `/prize-bonds/${denominationSlug(p.code)}/${p.n}`;
  if (!data.ok || !data.value) return { title: t("draw.title", { bond, number: p.n }), alternates: alternates(locale, path) };
  const d = data.value;
  const date = formatDrawDate(d.draw.drawDate, locale);
  return {
    title: t("draw.metaTitle", { bond, number: p.n, date }),
    description: t("draw.metaDescription", {
      bond,
      number: p.n,
      date,
      city: d.draw.city ?? "",
      first: d.tier1.map((n) => formatBondNumber(n)).join(", ") || "-",
    }),
    alternates: alternates(locale, path),
  };
}

export default async function DrawPage({ params }: Props) {
  const { locale, denomination, drawNumber } = await params;
  const p = parse(denomination, drawNumber);
  if (!p) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "bonds" });
  const slug = denominationSlug(p.code);
  const bond = t("common.bondName", { denomination: t(`common.denomination.${p.code}`) });
  const path = `/prize-bonds/${slug}/${p.n}`;
  const data = await attempt(() => loadDraw(p.code, p.n));
  const crumbs = [
    { href: "/prize-bonds", label: t("nav.title") },
    { href: `/prize-bonds/${slug}`, label: t(`common.denomination.${p.code}`) },
    { label: t("common.drawNumber", { number: p.n }) },
  ];

  if (!data.ok) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumbs items={crumbs} />
        <PageHeader title={t("draw.title", { bond, number: p.n })} />
        <Unavailable retryHref={`/${locale}${path}`} />
      </div>
    );
  }
  if (!data.value) notFound();
  const d = data.value;
  const date = formatDrawDate(d.draw.drawDate, locale);
  const amounts = Object.fromEntries(d.prizes.map((x) => [x.tier, x.amountPkr]));
  const listUrl = `/api/v1/bonds/draws/${slug}/${p.n}/results.txt`;
  const base = process.env.APP_BASE_URL ?? "";

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={crumbs} />
      <JsonLd data={breadcrumbLd([{ name: t("nav.title"), path: "/prize-bonds" }, { name: bond, path: `/prize-bonds/${slug}` }, { name: t("common.drawNumber", { number: p.n }), path }], locale)} />
      {d.draw.completeness !== "none" ? (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Dataset",
            name: t("draw.title", { bond, number: p.n }),
            description: t("draw.metaDescription", { bond, number: p.n, date, city: d.draw.city ?? "", first: d.tier1.map((n) => formatBondNumber(n)).join(", ") }),
            temporalCoverage: d.draw.drawDate,
            spatialCoverage: d.draw.city ? { "@type": "Place", name: `${d.draw.city}, Pakistan` } : undefined,
            isAccessibleForFree: true,
            creator: { "@type": "GovernmentOrganization", name: "National Savings Pakistan", url: "https://savings.gov.pk" },
            distribution: [{ "@type": "DataDownload", encodingFormat: "text/plain", contentUrl: `${base}${listUrl}` }],
            url: `${base}/${locale}${path}`,
          }}
        />
      ) : null}

      <PageHeader
        title={t("draw.title", { bond, number: p.n })}
        description={d.draw.city ? t("draw.heldOn", { date, city: d.draw.city }) : t("draw.heldOnNoCity", { date })}
        actions={
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={d.draw.status} />
            <CompletenessBadge completeness={d.draw.completeness} />
          </div>
        }
      />

      {d.draw.status === "disputed" ? (
        <div role="note" className="flex gap-3 rounded-lg border border-warning bg-warning/10 p-4 text-warning">
          <span aria-hidden="true" className="font-bold">!</span>
          <div>
            <p className="font-semibold">{t("draw.disputedTitle")}</p>
            <p className="text-sm">{t("common.statusHelp.disputed")}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-2">{t(`common.statusHelp.${d.draw.status}`)}</p>
      )}

      {d.draw.completeness === "none" ? (
        <EmptyState title={t("draw.noResults")} />
      ) : (
        <>
          <TopPrizes tier1={d.tier1} tier2={d.tier2} />
          <FindInDraw listUrl={listUrl} amounts={amounts} />
          <div className="grid gap-4 md:grid-cols-2">
            <Card title={t("draw.prizeTableTitle")}>
              {d.prizes.length ? (
                <PrizeTable prizes={d.prizes} caption={t("draw.prizeTableCaption")} />
              ) : (
                <p className="text-sm text-ink-2">{t("draw.amountsUnknownNote")}</p>
              )}
            </Card>
            <Card title={t("draw.downloadTitle")}>
              <p>
                <a href={listUrl} download className="inline-flex min-h-11 items-center rounded-md border border-line-strong bg-surface px-4 font-medium text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                  {t("draw.downloadTxt")}
                </a>
              </p>
              <p className="mt-2 text-sm text-ink-2">{t("draw.downloadHint")}</p>
              {d.draw.checksum ? (
                <p className="mt-2 text-xs text-ink-2">
                  {t("draw.checksum")}:{" "}
                  <code dir="ltr" className="break-all">
                    {d.draw.checksum}
                  </code>
                </p>
              ) : null}
            </Card>
          </div>
          {d.tier3.length ? <ThirdPrizeList numbers={d.tier3} /> : <p className="text-ink-2">{t("draw.noThird")}</p>}
        </>
      )}

      <SourcesList sources={d.sources} />
      <p className="text-sm text-ink-2">{t("draw.claimNote")}</p>

      <nav aria-label={t("common.allDenominations")} className="flex flex-wrap justify-between gap-3 border-t border-line pt-4">
        {d.previous?.drawNumber ? (
          <Link href={`/prize-bonds/${slug}/${d.previous.drawNumber}`} rel="prev" className="inline-flex min-h-11 items-center gap-1 underline underline-offset-4">
            <span aria-hidden="true" className="rtl:rotate-180">←</span> {t("draw.previous")} ({t("common.drawNumber", { number: d.previous.drawNumber })})
          </Link>
        ) : (
          <span />
        )}
        {d.next?.drawNumber && d.next.completeness !== "none" ? (
          <Link href={`/prize-bonds/${slug}/${d.next.drawNumber}`} rel="next" className="inline-flex min-h-11 items-center gap-1 underline underline-offset-4">
            {t("draw.next")} ({t("common.drawNumber", { number: d.next.drawNumber })}) <span aria-hidden="true" className="rtl:rotate-180">→</span>
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
