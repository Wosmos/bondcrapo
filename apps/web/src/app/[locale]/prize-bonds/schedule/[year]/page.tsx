import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState, PageHeader } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/features/bonds/components/Breadcrumbs";
import { ScheduleTable } from "@/features/bonds/components/ScheduleTable";
import { Unavailable } from "@/features/bonds/components/Unavailable";
import { todayInPakistan } from "@/features/bonds/format";
import { alternates } from "@/features/bonds/seo";
import { attempt, loadSchedule } from "@/features/bonds/server/pages";

export const revalidate = 21600;

type Props = { params: Promise<{ locale: string; year: string }> };

const FIRST_YEAR = 2000;

function parseYear(value: string): number | null {
  const y = /^\d{4}$/.test(value) ? Number(value) : NaN;
  return y >= FIRST_YEAR && y <= Number(todayInPakistan().slice(0, 4)) + 1 ? y : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, year } = await params;
  const y = parseYear(year);
  if (!y) return {};
  const t = await getTranslations({ locale, namespace: "bonds.schedule" });
  return { title: t("metaTitle", { year: y }), description: t("metaDescription", { year: y }), alternates: alternates(locale, `/prize-bonds/schedule/${y}`) };
}

export default async function SchedulePage({ params }: Props) {
  const { locale, year } = await params;
  const y = parseYear(year);
  if (!y) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "bonds" });
  const today = todayInPakistan();
  const data = await attempt(() => loadSchedule(y));
  const last = Number(today.slice(0, 4)) + 1;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ href: "/prize-bonds", label: t("nav.title") }, { label: t("schedule.title", { year: y }) }]} />
      <PageHeader title={t("schedule.title", { year: y })} description={t("schedule.description")} />
      <nav aria-label={t("schedule.yearNav")} className="flex justify-between gap-3">
        {y > FIRST_YEAR ? (
          <Link href={`/prize-bonds/schedule/${y - 1}`} rel="prev" className="inline-flex min-h-11 items-center gap-1 underline underline-offset-4">
            <span aria-hidden="true" className="rtl:rotate-180">←</span> {t("schedule.previousYear", { year: y - 1 })}
          </Link>
        ) : (
          <span />
        )}
        {y < last ? (
          <Link href={`/prize-bonds/schedule/${y + 1}`} rel="next" className="inline-flex min-h-11 items-center gap-1 underline underline-offset-4">
            {t("schedule.nextYear", { year: y + 1 })} <span aria-hidden="true" className="rtl:rotate-180">→</span>
          </Link>
        ) : null}
      </nav>
      {!data.ok ? (
        <Unavailable retryHref={`/${locale}/prize-bonds/schedule/${y}`} />
      ) : data.value.length ? (
        <ScheduleTable draws={data.value} caption={t("schedule.caption", { year: y })} today={today} />
      ) : (
        <EmptyState title={t("schedule.empty", { year: y })} />
      )}
    </div>
  );
}
