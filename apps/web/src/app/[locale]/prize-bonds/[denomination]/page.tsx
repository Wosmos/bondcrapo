import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DENOMINATION_CODES } from "@bondcheck/shared";
import { Card, PageHeader } from "@/components/ui";
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
  const years = data.ok ? [...new Set(data.value.draws.map((d) => d.drawDate.slice(0, 4)))] : [];

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ href: "/prize-bonds", label: t("nav.title") }, { label: t(`common.denomination.${code}`) }]} />
      <JsonLd data={breadcrumbLd([{ name: t("nav.title"), path: "/prize-bonds" }, { name: bond, path: `/prize-bonds/${slug}` }], locale)} />
      <PageHeader
        title={t("denomination.title", { bond })}
        description={notes ?? undefined}
        actions={denom ? <span className="text-sm text-slate-700">{t(`common.kind.${denom.kind}`)} · {denom.status === "active" ? t("common.active") : t("common.discontinued")}</span> : undefined}
      />

      {!data.ok ? (
        <Unavailable retryHref={`/${locale}/prize-bonds/${slug}`} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card title={t("denomination.nextDraw")}>
              {data.value.next ? (
                <p className="text-slate-900">
                  <time dateTime={data.value.next.drawDate} className="font-semibold">
                    {formatDrawDate(data.value.next.drawDate, locale)}
                  </time>
                  {data.value.next.city ? ` · ${data.value.next.city}` : ""}
                  <span className="block text-sm text-slate-600">
                    {data.value.next.drawNumber ? `${t("common.drawNumber", { number: data.value.next.drawNumber })} · ` : ""}
                    {t("common.inDays", { days: daysUntil(data.value.next.drawDate, today) })}
                  </span>
                </p>
              ) : (
                <p className="text-slate-600">{t("denomination.noNextDraw")}</p>
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
            <h2 id="all-draws" className="mb-2 text-xl font-semibold text-slate-900">
              {t("denomination.drawsTitle")}
            </h2>
            {data.value.draws.length === 0 ? (
              <p className="text-slate-600">{t("denomination.noDraws")}</p>
            ) : (
              <>
                {years.length > 4 ? (
                  <nav aria-label={t("denomination.jumpToYear")} className="mb-3">
                    <ul className="flex flex-wrap gap-1">
                      {years.map((y) => (
                        <li key={y}>
                          <a href={`#y${y}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 text-sm tabular-nums text-slate-800 underline-offset-4 hover:bg-slate-100 hover:underline focus-visible:outline-2 focus-visible:outline-slate-900">
                            {y}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </nav>
                ) : null}
                <div tabIndex={0} role="region" aria-label={t("denomination.drawsCaption", { bond })} className="overflow-x-auto rounded-lg border border-slate-200 bg-white focus-visible:outline-2 focus-visible:outline-slate-900">
                  <table className="w-full border-collapse text-sm">
                    <caption className="p-3 text-start text-sm font-medium text-slate-700">{t("denomination.drawsCaption", { bond })}</caption>
                    <thead>
                      <tr className="border-y border-slate-200 bg-slate-50">
                        {(["draw", "date", "city", "firstPrize", "results", "status"] as const).map((k) => (
                          <th key={k} scope="col" className="px-3 py-2 text-start font-semibold text-slate-700">
                            {t(`denomination.columns.${k}`)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.value.draws.map((d, i, all) => {
                        const firstOfYear = i === 0 || all[i - 1]!.drawDate.slice(0, 4) !== d.drawDate.slice(0, 4);
                        const link = d.drawNumber && d.completeness !== "none";
                        return (
                          <tr key={d.id} id={firstOfYear ? `y${d.drawDate.slice(0, 4)}` : undefined} className="scroll-mt-24 border-b border-slate-100">
                            <th scope="row" className="px-3 py-2 text-start font-medium tabular-nums">
                              {link ? (
                                <Link href={`/prize-bonds/${slug}/${d.drawNumber}`} className="underline underline-offset-4 hover:no-underline">
                                  {t("common.drawNumber", { number: d.drawNumber! })}
                                </Link>
                              ) : d.drawNumber ? (
                                t("common.drawNumber", { number: d.drawNumber })
                              ) : (
                                <span className="font-normal text-slate-500">{t("common.drawNumberUnknown")}</span>
                              )}
                            </th>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <time dateTime={d.drawDate}>{formatDrawDate(d.drawDate, locale, "short")}</time>
                            </td>
                            <td className="px-3 py-2">{d.city ?? "–"}</td>
                            <td className="px-3 py-2">
                              {d.firstPrizes.length ? (
                                <span className="flex flex-wrap gap-x-2">
                                  {d.firstPrizes.map((n) => (
                                    <BondNumber key={n} value={n} />
                                  ))}
                                </span>
                              ) : (
                                "–"
                              )}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-slate-700">{t(`common.completeness.${d.completeness}`)}</td>
                            <td className="px-3 py-2">
                              <StatusBadge status={d.status} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
