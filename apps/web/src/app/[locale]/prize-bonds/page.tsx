import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { LatestDrawCard } from "@/features/bonds/components/LatestDrawCard";
import { QuickCheck } from "@/features/bonds/components/QuickCheck";
import { Unavailable } from "@/features/bonds/components/Unavailable";
import { daysUntil, formatDrawDate, todayInPakistan } from "@/features/bonds/format";
import { ACTIVE_CODES, DISPLAY_ORDER, denominationSlug } from "@/features/bonds/labels";
import { alternates } from "@/features/bonds/seo";
import { attempt, loadHub } from "@/features/bonds/server/pages";

export const revalidate = 21600;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "bonds.hub" });
  return { title: t("metaTitle"), description: t("metaDescription"), alternates: alternates(locale, "/prize-bonds") };
}

export default async function PrizeBondsHub({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "bonds" });
  const today = todayInPakistan();
  const data = await attempt(() => loadHub(today));
  const latest = data.ok ? [...data.value.latest].sort((a, b) => DISPLAY_ORDER.indexOf(a.draw.code as never) - DISPLAY_ORDER.indexOf(b.draw.code as never)) : [];
  const active = latest.filter((l) => (ACTIVE_CODES as readonly string[]).includes(l.draw.code));
  const discontinued = DISPLAY_ORDER.filter((c) => !(ACTIVE_CODES as readonly string[]).includes(c));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("hub.title")} description={t("hub.description")} />
      <QuickCheck action={`/${locale}/prize-bonds/check`} />

      <section aria-labelledby="latest">
        <h2 id="latest" className="mb-3 text-xl font-semibold text-ink">
          {t("hub.latestTitle")}
        </h2>
        {data.ok ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((l) => (
              <LatestDrawCard key={l.draw.id} draw={l.draw} firstPrizes={l.firstPrizes} />
            ))}
          </ul>
        ) : (
          <Unavailable retryHref={`/${locale}/prize-bonds`} />
        )}
        <p className="mt-3 text-sm text-ink-2">{t("hub.sourceNote")}</p>
      </section>

      {data.ok ? (
        <section aria-labelledby="upcoming">
          <h2 id="upcoming" className="mb-3 text-xl font-semibold text-ink">
            {t("hub.upcomingTitle")}
          </h2>
          {data.value.upcoming.length ? (
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
              {data.value.upcoming.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <Link href={`/prize-bonds/${denominationSlug(d.code)}`} className="font-medium text-ink underline-offset-4 hover:underline">
                    {t(`common.denomination.${d.code}`)}
                  </Link>
                  <span className="text-sm text-ink-2">
                    <time dateTime={d.drawDate}>{formatDrawDate(d.drawDate, locale)}</time>
                    {d.city ? ` · ${d.city}` : ""} · {t("common.inDays", { days: daysUntil(d.drawDate, today) })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-2">{t("hub.upcomingEmpty")}</p>
          )}
          <p className="mt-3">
            <Link href={`/prize-bonds/schedule/${today.slice(0, 4)}`} className="font-medium underline underline-offset-4 hover:no-underline">
              {t("hub.scheduleLink")}
            </Link>
          </p>
        </section>
      ) : null}

      <section aria-labelledby="denominations">
        <h2 id="denominations" className="mb-3 text-xl font-semibold text-ink">
          {t("hub.denominationsTitle")}
        </h2>
        <ul className="flex flex-wrap gap-2">
          {ACTIVE_CODES.map((c) => (
            <li key={c}>
              <Link href={`/prize-bonds/${denominationSlug(c)}`} className="inline-flex min-h-11 items-center rounded-md border border-line-strong bg-surface px-4 font-medium text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                {t(`common.denomination.${c}`)}
              </Link>
            </li>
          ))}
        </ul>
        <h3 className="mt-5 text-base font-semibold text-ink">{t("hub.discontinuedTitle")}</h3>
        <p className="mb-2 text-sm text-ink-2">{t("hub.discontinuedNote")}</p>
        <ul className="flex flex-wrap gap-2">
          {discontinued.map((c) => (
            <li key={c}>
              <Link href={`/prize-bonds/${denominationSlug(c)}`} className="inline-flex min-h-11 items-center rounded-md border border-line bg-surface-2 px-4 text-ink hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                {t(`common.denomination.${c}`)}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-5">
          <Link href="/prize-bonds/coverage" className="underline underline-offset-4 hover:no-underline">
            {t("hub.coverageLink")}
          </Link>
        </p>
      </section>
    </div>
  );
}
